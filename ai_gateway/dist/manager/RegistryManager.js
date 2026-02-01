"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistryManager = void 0;
const database_1 = require("../db/database");
class RegistryManager {
    static registerAddon(details) {
        const db = (0, database_1.getDb)();
        db.prepare(`
            INSERT INTO addons (slug, port, version, capabilities, last_seen)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(slug) DO UPDATE SET
                port = excluded.port,
                version = excluded.version,
                capabilities = excluded.capabilities,
                last_seen = CURRENT_TIMESTAMP
        `).run(details.slug, details.port, details.version, JSON.stringify(details.capabilities));
    }
    static getAddon(slug) {
        const db = (0, database_1.getDb)();
        const row = db.prepare('SELECT * FROM addons WHERE slug = ?').get(slug);
        if (row) {
            row.capabilities = JSON.parse(row.capabilities);
        }
        return row;
    }
    static listAddons() {
        const db = (0, database_1.getDb)();
        const rows = db.prepare('SELECT * FROM addons').all();
        return rows.map(row => ({
            ...row,
            capabilities: JSON.parse(row.capabilities)
        }));
    }
}
exports.RegistryManager = RegistryManager;
