const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { query } = require("../db/postgres");

const router = express.Router();

router.get("/logs", requireAuth, requireRole("government"), async (req, res, next) => {
    try {
        const limit = Math.min(Number(req.query.limit || 50), 200);
        const offset = Number(req.query.offset || 0);
        const sql = `
            SELECT id, actor_id, actor_role, action, entity_type, entity_id, metadata, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2;
        `;
        const result = await query(sql, [limit, offset]);
        return res.json({ logs: result.rows });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
