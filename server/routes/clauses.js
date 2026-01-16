const express = require("express");
const Clause = require("../models/Clause");
const Comment = require("../models/Comment");
const Document = require("../models/Document");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { canAccessDocument, canCommentOnDocument } = require("../services/access");
const { logAudit } = require("../services/audit");

const router = express.Router();

router.get("/documents/:documentId/clauses", requireAuth, async (req, res, next) => {
    try {
        const document = await Document.findById(req.params.documentId);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (!canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const clauses = await Clause.find({ documentId: document.id }).sort({ index: 1 });
        return res.json(clauses);
    } catch (error) {
        return next(error);
    }
});

router.patch("/clauses/:id/status", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const { status, disputeReason, reviewer } = req.body;
        const allowed = ["AGREED", "PENDING", "DISPUTED"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const clause = await Clause.findById(req.params.id);
        if (!clause) {
            return res.status(404).json({ error: "Clause not found" });
        }

        const document = await Document.findById(clause.documentId);
        if (!document || !canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }

        clause.status = status;
        clause.disputeReason = disputeReason || "";
        clause.reviewer = {
            name: reviewer?.name || req.user.name,
            designation: reviewer?.designation || "",
            organization: reviewer?.organization || ""
        };
        clause.updatedBy = req.user.id;
        await clause.save();

        await logAudit({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "CLAUSE_STATUS_CHANGE",
            entityType: "CLAUSE",
            entityId: clause.id,
            metadata: { status: clause.status }
        });

        return res.json(clause);
    } catch (error) {
        return next(error);
    }
});

router.post("/clauses/:id/comments", requireAuth, async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Comment text is required" });
        }

        const clause = await Clause.findById(req.params.id);
        if (!clause) {
            return res.status(404).json({ error: "Clause not found" });
        }

        const document = await Document.findById(clause.documentId);
        if (!document || !canCommentOnDocument(req.user, document)) {
            return res.status(403).json({ error: "Commenting not allowed" });
        }

        const comment = await Comment.create({
            clauseId: clause.id,
            documentId: document.id,
            authorId: req.user.id,
            text: String(text).trim()
        });

        await logAudit({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "COMMENT_ADD",
            entityType: "CLAUSE",
            entityId: clause.id,
            metadata: { documentId: document.id }
        });

        return res.status(201).json(comment);
    } catch (error) {
        return next(error);
    }
});

router.get("/clauses/:id/comments", requireAuth, async (req, res, next) => {
    try {
        const clause = await Clause.findById(req.params.id);
        if (!clause) {
            return res.status(404).json({ error: "Clause not found" });
        }
        const document = await Document.findById(clause.documentId);
        if (!document || !canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }
        const comments = await Comment.find({ clauseId: clause.id }).sort({ createdAt: 1 });
        return res.json(comments);
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
