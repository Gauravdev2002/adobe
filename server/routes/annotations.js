const express = require("express");
const Annotation = require("../models/Annotation");
const Document = require("../models/Document");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { canAccessDocument } = require("../services/access");
const { logAudit } = require("../services/audit");

const router = express.Router();

router.get("/documents/:documentId/annotations", requireAuth, async (req, res, next) => {
    try {
        const document = await Document.findById(req.params.documentId);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }
        if (!canAccessDocument(req.user, document)) {
            return res.status(403).json({ error: "Access denied" });
        }
        const annotations = await Annotation.find({ documentId: document.id }).sort({ createdAt: 1 });
        return res.json(annotations);
    } catch (error) {
        return next(error);
    }
});

router.post(
    "/documents/:documentId/annotations",
    requireAuth,
    requireRole("lawyer"),
    async (req, res, next) => {
        try {
            const { clauseId, page, x, y, width, height } = req.body;
            const document = await Document.findById(req.params.documentId);
            if (!document) {
                return res.status(404).json({ error: "Document not found" });
            }
            if (!canAccessDocument(req.user, document)) {
                return res.status(403).json({ error: "Access denied" });
            }
            if (!clauseId || page === undefined || x === undefined || y === undefined) {
                return res.status(400).json({ error: "Annotation fields are required" });
            }

            const annotation = await Annotation.create({
                documentId: document.id,
                clauseId,
                page: Number(page),
                x: Number(x),
                y: Number(y),
                width: Number(width),
                height: Number(height),
                createdBy: req.user.id
            });

            await logAudit({
                actorId: req.user.id,
                actorRole: req.user.role,
                action: "CLAUSE_ANNOTATION_ADD",
                entityType: "DOCUMENT",
                entityId: document.id,
                metadata: { clauseId, page }
            });

            return res.status(201).json(annotation);
        } catch (error) {
            return next(error);
        }
    }
);

module.exports = router;
