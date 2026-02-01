"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatManager = void 0;
const database_1 = require("../../db/database");
const utils_1 = require("../../utils");
class ChatManager {
    instanceId;
    sock;
    io;
    constructor(instanceId, sock, io) {
        this.instanceId = instanceId;
        this.sock = sock;
        this.io = io;
    }
    async modifyChat(jid, action) {
        const db = (0, database_1.getDb)();
        const normalized = (0, utils_1.normalizeJid)(jid);
        const lastMsg = db.prepare('SELECT whatsapp_id, timestamp, is_from_me FROM messages WHERE instance_id = ? AND chat_jid = ? ORDER BY timestamp DESC LIMIT 1').get(this.instanceId, normalized);
        const lastMessages = lastMsg ? [{ key: { id: lastMsg.whatsapp_id, remoteJid: normalized, fromMe: !!lastMsg.is_from_me }, messageTimestamp: Math.floor(new Date(lastMsg.timestamp).getTime() / 1000) }] : [];
        if (action === 'archive') {
            await this.sock.chatModify({ archive: true, lastMessages: lastMessages }, normalized);
            db.prepare('UPDATE chats SET is_archived = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        }
        else if (action === 'pin') {
            await this.sock.chatModify({ pin: true, lastMessages: lastMessages }, normalized);
            db.prepare('UPDATE chats SET is_pinned = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        }
        else if (action === 'delete') {
            await this.sock.chatModify({ delete: true, lastMessages: lastMessages }, normalized);
            db.prepare('DELETE FROM messages WHERE instance_id = ? AND chat_jid = ?').run(this.instanceId, normalized);
            db.prepare('DELETE FROM chats WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        }
        this.io.emit('chat_update', { instanceId: this.instanceId });
    }
    async createGroup(title, participants) {
        return await this.sock.groupCreate(title, participants.map(p => (0, utils_1.normalizeJid)(p)));
    }
    async updateGroupParticipants(jid, participants, action) {
        return await this.sock.groupParticipantsUpdate((0, utils_1.normalizeJid)(jid), participants.map(p => (0, utils_1.normalizeJid)(p)), action);
    }
    async updateGroupMetadata(jid, update) {
        const normalized = (0, utils_1.normalizeJid)(jid);
        if (update.subject)
            await this.sock.groupUpdateSubject(normalized, update.subject);
        if (update.description)
            await this.sock.groupUpdateDescription(normalized, update.description);
    }
}
exports.ChatManager = ChatManager;
