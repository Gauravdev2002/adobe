const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Document = require("../models/Document");
const Clause = require("../models/Clause");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { canAccessDocument } = require("../services/access");
const { logAudit } = require("../services/audit");

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = req.app.locals.uploadDir;
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const safeName = file.originalname.replace(/\s+/g, "_");
        cb(null, `${uniqueSuffix}-${safeName}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (!allowed.includes(file.mimetype)) {
        return cb(new Error("Only PDF and DOCX files are allowed"), false);
    }
    return cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }
});

router.post("/", requireAuth, requireRole("lawyer"), upload.single("file"), async (req, res, next) => {
    try {
        const { title, parentId, clientCommentingAllowed, readOnlyForClients } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: "Document file is required" });
        }

        const documentTitle = title || req.file.originalname;
        let version = 1;
        let resolvedParentId = null;

        if (parentId) {
            const parent = await Document.findById(parentId);
            if (!parent) {
                return res.status(404).json({ error: "Parent document not found" });
            }
            const latest = await Document.find({ parentId }).sort({ version: -1 }).limit(1);
            version = (latest[0]?.version || parent.version || 1) + 1;
            resolvedParentId = parentId;
        }

        const document = await Document.create({
            title: documentTitle,
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            storagePath: path.resolve(req.file.path),
            uploadedBy: req.user.id,
            version,
            parentId: resolvedParentId,
            access: {
                lawyers: [req.user.id],
                clients: [],
                government: []
            },
            readOnlyForClients: readOnlyForClients !== "false",
            clientCommentingAllowed: clientCommentingAllowed === "true"
        });

        await logAudit({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "DOCUMENT_UPLOAD",
            entityType: "DOCUMENT",
            entityId: document.id,
            metadata: { filename: document.filename, version: document.version }
        });

        return res.status(201).json(document);
    } catch (error) {
        return next(error);
    }
});

router.get("/", requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        let query = {};

        if (req.user.role === "lawyer") {
            query = {
                $or: [{ uploadedBy: userId }, { "access.lawyers": userId }]
            };
        } else if (req.user.role === "client") {
            query = { "access.clients": userId };
        } else if (req.user.role === "government") {
            query = { "access.government": userId };
        }

        const documents = await Document.find(query).sort({ createdAt: -1 });
        return res.json(documents);
    } catch (error) {
        return next(error);
    }
});

router.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (!canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }

        return res.json(document);
    } catch (error) {
        return next(error);
    }
});

router.get("/:id/versions", requireAuth, async (req, res, next) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }
        if (!canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const rootId = document.parentId || document.id;
        const versions = await Document.find({
            $or: [{ _id: rootId }, { parentId: rootId }]
        }).sort({ version: 1 });

        return res.json({ rootId, versions });
    } catch (error) {
        return next(error);
    }
});

router.get("/:id/compare/:otherId", requireAuth, async (req, res, next) => {
    try {
        const document = await Document.findById(req.params.id);
        const other = await Document.findById(req.params.otherId);
        if (!document || !other) {
            return res.status(404).json({ error: "Document not found" });
        }
        if (!canAccessDocument(req.user, document) || !canAccessDocument(req.user, other)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const baseClauses = await Clause.find({ documentId: document.id }).sort({ index: 1 });
        const compareClauses = await Clause.find({ documentId: other.id }).sort({ index: 1 });

        const max = Math.max(baseClauses.length, compareClauses.length);
        const changedIndexes = [];
        for (let i = 0; i < max; i += 1) {
            const baseText = baseClauses[i]?.text?.trim() || "";
            const compareText = compareClauses[i]?.text?.trim() || "";
            if (baseText !== compareText) {
                changedIndexes.push(i);
            }
        }

        return res.json({
            baseId: document.id,
            compareId: other.id,
            changedIndexes
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/:id/file", requireAuth, async (req, res, next) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (!canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }

        return res.sendFile(path.resolve(document.storagePath));
    } catch (error) {
        return next(error);
    }
});

router.put("/:id/access", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const { lawyerIds, clientIds, governmentIds } = req.body;
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (!canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }

        document.access = {
            lawyers: Array.isArray(lawyerIds) ? lawyerIds : document.access.lawyers,
            clients: Array.isArray(clientIds) ? clientIds : document.access.clients,
            government: Array.isArray(governmentIds) ? governmentIds : document.access.government
        };
        await document.save();

        await logAudit({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "DOCUMENT_ACCESS_UPDATE",
            entityType: "DOCUMENT",
            entityId: document.id,
            metadata: { access: document.access }
        });

        return res.json(document);
    } catch (error) {
        return next(error);
    }
});

router.post("/:id/clauses/split", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const { clauses } = req.body;
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (!Array.isArray(clauses) || clauses.length === 0) {
            return res.status(400).json({ error: "Clauses array is required" });
        }

        if (!canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const created = await Clause.insertMany(
            clauses.map((text, index) => ({
                documentId: document.id,
                index,
                text: String(text).trim()
            }))
        );

        await logAudit({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "CLAUSE_SPLIT",
            entityType: "DOCUMENT",
            entityId: document.id,
            metadata: { clauses: created.length }
        });

        return res.status(201).json(created);
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
