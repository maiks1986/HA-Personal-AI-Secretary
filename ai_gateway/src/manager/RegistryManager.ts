import { getDb } from '../db/database';
import { RegistrationRequest } from '../shared_schemas';

export class RegistryManager {
    static registerAddon(details: RegistrationRequest) {
        const db = getDb();
        db.prepare(`
            INSERT INTO addons (slug, port, version, capabilities, last_seen)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(slug) DO UPDATE SET
                port = excluded.port,
                version = excluded.version,
                capabilities = excluded.capabilities,
                last_seen = CURRENT_TIMESTAMP
        `).run(
            details.slug,
            details.port,
            details.version,
            JSON.stringify(details.capabilities)
        );
    }

    static getAddon(slug: string) {
        const db = getDb();
        const row = db.prepare('SELECT * FROM addons WHERE slug = ?').get(slug) as any;
        if (row) {
            row.capabilities = JSON.parse(row.capabilities);
        }
        return row;
    }

    static listAddons() {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM addons').all() as any[];
        return rows.map(row => ({
            ...row,
            capabilities: JSON.parse(row.capabilities)
        }));
    }
}
