import { WASocket } from '@whiskeysockets/baileys';
import { getDb } from '../../db/database';
import { normalizeJid } from '../../utils';
import { Priority } from './TrafficManager';

export class ChatManager {
    constructor(
        private instanceId: number, 
        private request: <T>(execute: (sock: WASocket) => Promise<T>, priority?: Priority) => Promise<T>, 
        private io: any
    ) {}

    async modifyChat(jid: string, action: 'archive' | 'pin' | 'mute' | 'delete') {
        const db = getDb();
        const normalized = normalizeJid(jid);
        const lastMsg = db.prepare('SELECT whatsapp_id, timestamp, is_from_me FROM messages WHERE instance_id = ? AND chat_jid = ? ORDER BY timestamp DESC LIMIT 1').get(this.instanceId, normalized) as any;
        const lastMessages = lastMsg ? [{ key: { id: lastMsg.whatsapp_id, remoteJid: normalized, fromMe: !!lastMsg.is_from_me }, messageTimestamp: Math.floor(new Date(lastMsg.timestamp).getTime()/1000) }] : [];

        if (action === 'archive') {
            await this.request(async (sock) => await sock.chatModify({ archive: true, lastMessages: lastMessages as any }, normalized), Priority.MEDIUM);
            db.prepare('UPDATE chats SET is_archived = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        } else if (action === 'pin') {
            await this.request(async (sock) => await sock.chatModify({ pin: true, lastMessages: lastMessages as any }, normalized), Priority.MEDIUM);
            db.prepare('UPDATE chats SET is_pinned = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        } else if (action === 'delete') {
            await this.request(async (sock) => await sock.chatModify({ delete: true, lastMessages: lastMessages as any }, normalized), Priority.MEDIUM);
            db.prepare('DELETE FROM messages WHERE instance_id = ? AND chat_jid = ?').run(this.instanceId, normalized);
            db.prepare('DELETE FROM chats WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        }
        this.io.emit('chat_update', { instanceId: this.instanceId });
    }

    async createGroup(title: string, participants: string[]) {
        return await this.request(async (sock) => await sock.groupCreate(title, participants.map(p => normalizeJid(p))), Priority.MEDIUM);
    }

    async updateGroupParticipants(jid: string, participants: string[], action: 'add' | 'remove' | 'promote' | 'demote') {
        return await this.request(async (sock) => await sock.groupParticipantsUpdate(normalizeJid(jid), participants.map(p => normalizeJid(p)), action), Priority.MEDIUM);
    }

    async updateGroupMetadata(jid: string, update: { subject?: string, description?: string }) {
        const normalized = normalizeJid(jid);
        if (update.subject) await this.request(async (sock) => await sock.groupUpdateSubject(normalized, update.subject), Priority.MEDIUM);
        if (update.description) await this.request(async (sock) => await sock.groupUpdateDescription(normalized, update.description), Priority.MEDIUM);
    }
}
