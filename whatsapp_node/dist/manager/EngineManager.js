"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.engineManager = void 0;
const database_1 = require("../db/database");
const WhatsAppInstance_1 = require("./WhatsAppInstance");
class EngineManager {
    instances = new Map();
    debugEnabled = false;
    io = null;
    async init(io, debugEnabled = false) {
        console.log('TRACE [EngineManager]: init() called');
        this.io = io;
        this.debugEnabled = debugEnabled;
        const db = (0, database_1.getDb)();
        // Load all instances from DB
        const rows = db.prepare('SELECT id, name, presence FROM instances').all();
        for (const row of rows) {
            await this.startInstance(row.id, row.name, row.presence);
        }
        console.log(`TRACE [EngineManager]: initialized with ${this.instances.size} instances.`);
    }
    async startInstance(id, name, presence = 'unavailable') {
        console.log(`TRACE [EngineManager]: startInstance(${id}, ${name}, ${presence}) called`);
        if (this.instances.has(id)) {
            console.log(`TRACE [EngineManager]: Instance ${id} already exists.`);
            return this.instances.get(id);
        }
        const instance = new WhatsAppInstance_1.WhatsAppInstance(id, name, this.io, this.debugEnabled, presence);
        await instance.init();
        this.instances.set(id, instance);
        return instance;
    }
    getInstance(id) {
        return this.instances.get(id);
    }
    getAllInstances() {
        return Array.from(this.instances.values());
    }
    async stopInstance(id) {
        console.log(`TRACE [EngineManager]: stopInstance(${id}) called`);
        const instance = this.instances.get(id);
        if (instance) {
            await instance.close();
            this.instances.delete(id);
        }
    }
}
exports.engineManager = new EngineManager();
