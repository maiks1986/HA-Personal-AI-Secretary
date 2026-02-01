"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeJid = normalizeJid;
exports.isJidValid = isJidValid;
function normalizeJid(jid) {
    if (!jid)
        return jid;
    // user:1@s.whatsapp.net -> user@s.whatsapp.net
    // user:1@lid -> user@lid
    if (jid.includes(':')) {
        return jid.replace(/:[0-9]+@/, '@');
    }
    return jid;
}
function isJidValid(jid) {
    return !!(jid && !jid.includes('@broadcast') && jid !== 'status@broadcast');
}
