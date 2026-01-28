import { WASocket } from '@whiskeysockets/baileys';
import { getDb } from '../../db/database';
import { normalizeJid } from '../../utils';

export class ChatManager {
    constructor(private instanceId: number, private sock: WASocket, private io: any) {}

    async modifyChat(jid: string, action: 'archive' | 'pin' | 'mute' | 'delete') {
        const db = getDb();
        const normalized = normalizeJid(jid);
        const lastMsg = db.prepare('SELECT whatsapp_id, timestamp, is_from_me FROM messages WHERE instance_id = ? AND chat_jid = ? ORDER BY timestamp DESC LIMIT 1').get(this.instanceId, normalized) as any;
        const lastMessages = lastMsg ? [{ key: { id: lastMsg.whatsapp_id, remoteJid: normalized, fromMe: !!lastMsg.is_from_me }, messageTimestamp: Math.floor(new Date(lastMsg.timestamp).getTime()/1000) }] : [];

        if (action === 'archive') {
            await this.sock.chatModify({ archive: true, lastMessages: lastMessages as any }, normalized);
            db.prepare('UPDATE chats SET is_archived = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        } else if (action === 'pin') {
            await this.sock.chatModify({ pin: true, lastMessages: lastMessages as any }, normalized);
            db.prepare('UPDATE chats SET is_pinned = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        } else if (action === 'delete') {
            await this.sock.chatModify({ delete: true, lastMessages: lastMessages as any }, normalized);
            db.prepare('DELETE FROM messages WHERE instance_id = ? AND chat_jid = ?').run(this.instanceId, normalized);
            db.prepare('DELETE FROM chats WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalized);
        }
        this.io.emit('chat_update', { instanceId: this.instanceId });
    }

    async createGroup(title: string, participants: string[]) {
        return await this.sock.groupCreate(title, participants.map(p => normalizeJid(p)));
    }

    async updateGroupParticipants(jid: string, participants: string[], action: 'add' | 'remove' | 'promote' | 'demote') {
        return await this.sock.groupParticipantsUpdate(normalizeJid(jid), participants.map(p => normalizeJid(p)), action);
    }

    async updateGroupMetadata(jid: string, update: { subject?: string, description?: string }) {
        const normalized = normalizeJid(jid);
        if (update.subject) await this.sock.groupUpdateSubject(normalized, update.subject);
        if (update.description) await this.sock.groupUpdateDescription(normalized, update.description);
    }
}
