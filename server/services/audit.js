const { query } = require("../db/postgres");

const logAudit = async ({
    actorId,
    actorRole,
    action,
    entityType,
    entityId,
    metadata = {}
}) => {
    const sql = `
        INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6);
    `;
    await query(sql, [
        actorId,
        actorRole,
        action,
        entityType,
        entityId || null,
        metadata
    ]);
};

module.exports = { logAudit };
