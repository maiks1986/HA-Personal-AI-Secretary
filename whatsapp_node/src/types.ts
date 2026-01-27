export interface Instance {
    id: number;
    name: string;
    ha_user_id?: string | null;
    status: string;
    qr?: string | null;
    last_seen?: string | null;
}

export interface Contact {
    instance_id: number;
    jid: string;
    name: string;
}

export interface Chat {
    instance_id: number;
    jid: string;
    name: string;
    unread_count: number;
    last_message_text?: string | null;
    last_message_timestamp?: string | null;
}

export interface Message {
    id: number;
    instance_id: number;
    chat_jid: string;
    sender_jid: string;
    sender_name: string;
    text: string;
    timestamp: string;
    is_from_me: number;
}

export interface AuthUser {
    id: string;
    isAdmin: boolean;
    source: 'ingress' | 'direct';
}

export interface AddonConfig {
    password?: string;
    debug_logging?: boolean | string;
    reset_database?: boolean | string;
    gemini_api_key?: string;
}
