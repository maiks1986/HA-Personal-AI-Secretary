import axios from 'axios';
import { ApiResponse } from '../types/shared_schemas';

const API_BASE = window.location.pathname.replace(/\/+$/, '') + '/';

export const api = {
    getHealth: async () => {
        const res = await axios.get(`${API_BASE}health`);
        return res.data;
    },
    getAddons: async () => {
        const res = await axios.get<ApiResponse<any[]>>(`${API_BASE}registry/addons`);
        return res.data;
    },
    getKeys: async () => {
        const res = await axios.get<ApiResponse<any[]>>(`${API_BASE}keys`);
        return res.data;
    },
    addKey: async (provider: string, key: string, label?: string, type: 'static' | 'oauth' = 'static') => {
        const res = await axios.post<ApiResponse>(`${API_BASE}keys`, { provider, key, label, type });
        return res.data;
    },
    deleteKey: async (id: number) => {
        const res = await axios.delete<ApiResponse>(`${API_BASE}keys/${id}`);
        return res.data;
    },
    getSettings: async () => {
        const res = await axios.get<ApiResponse<Record<string, string>>>(`${API_BASE}settings`);
        return res.data;
    },
    updateSetting: async (key: string, value: string) => {
        const res = await axios.post<ApiResponse>(`${API_BASE}settings`, { key, value });
        return res.data;
    },
    // OAuth Bridge (Points to Auth Node via Ingress or direct port if local)
    // In HA, we should probably use a relative path or the configured Auth Node URL.
    // For now, let's assume it's reachable at /api/hassio_ingress/auth_node/api/oauth...
    // But since we are in the AI Gateway UI, we need to know where the Auth Node is.
    getAuthUrl: async (providerId: string) => {
        // We use the same base logic but target the OAuth bridge on the Auth Node
        const authBase = window.location.origin + window.location.pathname.replace(/ai_gateway\/?$/, 'auth_node');
        return { success: true, data: { url: `${authBase}/api/oauth/start/${providerId}` } };
    },
    getTokens: async (providerName: string) => {
        const authBase = window.location.origin + window.location.pathname.replace(/ai_gateway\/?$/, 'auth_node');
        const res = await axios.get<ApiResponse<{token: string}>>(`${authBase}/api/oauth/token/${providerName}`);
        return res.data;
    }
};
