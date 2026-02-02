"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatManager = void 0;
const database_1 = require("../../db/database");
const utils_1 = require("../../utils");
const TrafficManager_1 = require("./TrafficManager");
class ChatManager {
    instanceId;
    request;
    io;
    constructor(instanceId, request, io) {
        this.instanceId = instanceId;
        this.request = request;
        this.io = io;
    }
    async modifyChat(jid, action) {
        const db = (0, database_1.getDb)();
        const normalized = (0, utils_1.normalizeJid)(jid);
        const lastMsg = db.prepare('SELECT whatsapp_id, timestamp, is_from_me FROM messages WHERE instance_id = ? AND chat_jid = ? ORDER BY timestamp DESC LIMIT 1').get(this.instanceId, normalized);
        const lastMessages = lastMsg ? [{ key: { id: lastMsg.whatsapp_id, remoteJid: normalized, fromMe: !!lastMsg.is_from_me }, messageTimestamp: Math.floor(new Date(lastMsg.timestamp).getTime() / 1000) }] : [];
        if (action === 'archive') {
            await this.request(async (sock) => await sock.chatModify({ archive: true, lastMessages: lastMessages }, normalized), TrafficManager_1.Priority.MEDIUM);
            db.prepare('UPDATE chats SET is_archived = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        }
        else if (action === 'pin') {
            await this.request(async (sock) => await sock.chatModify({ pin: true, lastMessages: lastMessages }, normalized), TrafficManager_1.Priority.MEDIUM);
            db.prepare('UPDATE chats SET is_pinned = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        }
        else if (action === 'delete') {
            await this.request(async (sock) => await sock.chatModify({ delete: true, lastMessages: lastMessages }, normalized), TrafficManager_1.Priority.MEDIUM);
            db.prepare('DELETE FROM messages WHERE instance_id = ? AND chat_jid = ?').run(this.instanceId, normalized);
            db.prepare('DELETE FROM chats WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        }
        this.io.emit('chat_update', { instanceId: this.instanceId });
    }
    async createGroup(title, participants) {
        return await this.request(async (sock) => await sock.groupCreate(title, participants.map(p => (0, utils_1.normalizeJid)(p))), TrafficManager_1.Priority.MEDIUM);
    }
    async updateGroupParticipants(jid, participants, action) {
        return await this.request(async (sock) => await sock.groupParticipantsUpdate((0, utils_1.normalizeJid)(jid), participants.map(p => (0, utils_1.normalizeJid)(p)), action), TrafficManager_1.Priority.MEDIUM);
    }
    async updateGroupMetadata(jid, update) {
        const normalized = (0, utils_1.normalizeJid)(jid);
        if (update.subject)
            await this.request(async (sock) => await sock.groupUpdateSubject(normalized, update.subject), TrafficManager_1.Priority.MEDIUM);
        if (update.description)
            await this.request(async (sock) => await sock.groupUpdateDescription(normalized, update.description), TrafficManager_1.Priority.MEDIUM);
    }
}
exports.ChatManager = ChatManager;
