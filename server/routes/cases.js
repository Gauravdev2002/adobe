const express = require("express");
const Case = require("../models/Case");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { canAccessCase } = require("../services/access");
const { logAudit } = require("../services/audit");

const router = express.Router();

router.post("/", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const { title, description, lawyerIds, clientIds, governmentIds, documentIds } = req.body;
        if (!title) {
            return res.status(400).json({ error: "Case title is required" });
        }

        const caseFile = await Case.create({
            title: String(title).trim(),
            description: description || "",
            createdBy: req.user.id,
            members: {
                lawyers: Array.isArray(lawyerIds) ? lawyerIds : [req.user.id],
                clients: Array.isArray(clientIds) ? clientIds : [],
                government: Array.isArray(governmentIds) ? governmentIds : []
            },
            documents: Array.isArray(documentIds) ? documentIds : []
        });

        await logAudit({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "CASE_CREATE",
            entityType: "CASE",
            entityId: caseFile.id,
            metadata: { title: caseFile.title }
        });

        return res.status(201).json(caseFile);
    } catch (error) {
        return next(error);
    }
});

router.get("/", requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const query =
            req.user.role === "lawyer"
                ? { $or: [{ createdBy: userId }, { "members.lawyers": userId }] }
                : req.user.role === "client"
                ? { "members.clients": userId }
                : { "members.government": userId };
        const cases = await Case.find(query).sort({ createdAt: -1 });
        return res.json(cases);
    } catch (error) {
        return next(error);
    }
});

router.put("/:id/assign", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const caseFile = await Case.findById(req.params.id);
        if (!caseFile) {
            return res.status(404).json({ error: "Case not found" });
        }

        if (!canAccessCase(req.user, caseFile)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const { lawyerIds, clientIds, governmentIds, documentIds, status } = req.body;
        if (Array.isArray(lawyerIds)) {
            caseFile.members.lawyers = lawyerIds;
        }
        if (Array.isArray(clientIds)) {
            caseFile.members.clients = clientIds;
        }
        if (Array.isArray(governmentIds)) {
            caseFile.members.government = governmentIds;
        }
        if (Array.isArray(documentIds)) {
            caseFile.documents = documentIds;
        }
        if (status && ["ACTIVE", "ON_HOLD", "CLOSED"].includes(status)) {
            caseFile.status = status;
        }
        await caseFile.save();

        await logAudit({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "CASE_ASSIGN_UPDATE",
            entityType: "CASE",
            entityId: caseFile.id,
            metadata: { status: caseFile.status }
        });

        return res.json(caseFile);
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
