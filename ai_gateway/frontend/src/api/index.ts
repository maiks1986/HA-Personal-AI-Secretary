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
    getAuthUrl: async () => {
        const res = await axios.get<ApiResponse<{url: string}>>(`${API_BASE}auth/google/url`);
        return res.data;
    }
};
