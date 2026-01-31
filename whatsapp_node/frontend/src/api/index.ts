import axios from 'axios';
import { 
  Instance, 
  Chat, 
  Contact, 
  Message, 
  StatusUpdate,
  AuthStatusResponse, 
  LoginResponse 
} from '../types';

export const updateAxiosAuth = (token: string | null) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

export const api = {
  // Auth
  getStatus: () => axios.get<AuthStatusResponse>('api/auth/status'),
  login: (password: string) => axios.post<LoginResponse>('api/auth/login', { password }),
  haLogin: (haUrl: string, haToken: string) => axios.post<LoginResponse>('api/auth/ha_login', { haUrl, haToken }),

  // Instances
  getInstances: () => axios.get<Instance[]>('api/instances'),
  createInstance: (name: string) => axios.post('api/instances', { name }),
  deleteInstance: (id: number) => axios.delete(`api/instances/${id}`),
  reconnect: (id: number) => axios.post(`api/instances/${id}/reconnect`),
  setPresence: (id: number, presence: 'available' | 'unavailable') => axios.post(`api/instances/${id}/presence`, { presence }),

  // Chats & Contacts
  getChats: (instanceId: number) => axios.get<Chat[]>(`api/chats/${instanceId}`),
  getContacts: (instanceId: number) => axios.get<Contact[]>(`api/contacts/${instanceId}`),
  modifyChat: (instanceId: number, jid: string, action: 'archive' | 'pin' | 'delete') => 
    axios.post(`api/chats/${instanceId}/${jid}/modify`, { action }),
  
  toggleEphemeral: (instanceId: number, jid: string, enabled: boolean, timer: number = 60) =>
    axios.post(`api/chats/${instanceId}/${jid}/ephemeral`, { enabled, timer }),

  // Messages
  getMessages: (instanceId: number, jid: string) => axios.get<Message[]>(`api/messages/${instanceId}/${jid}`),
  sendMessage: (instanceId: number, jid: string, message: string) => 
    axios.post('api/send_message', { instanceId, contact: jid, message }),
  searchMessages: (instanceId: number, query: string, jid?: string) => {
    let url = `api/messages/${instanceId}/search?query=${query}`;
    if (jid) url += `&jid=${jid}`;
    return axios.get<Message[]>(url);
  },

  // Groups
  createGroup: (instanceId: number, title: string, participants: string[]) => 
    axios.post(`api/groups/${instanceId}`, { title, participants }),

  // Status
  getStatuses: (instanceId: number) => axios.get<StatusUpdate[]>(`api/status/${instanceId}`),

  // Settings
  getSetting: (key: string, instanceId: number = 0) => axios.get<{ value: string }>(`api/settings/${key}?instanceId=${instanceId}`),
  saveSetting: (key: string, value: string, instanceId: number = 0) => axios.post('api/settings', { key, value, instanceId }),
  resetSystem: () => axios.post('api/system/reset'),

  // Stealth Scheduler
  getStealthSchedules: (instanceId: number) => axios.get(`api/stealth/schedules/${instanceId}`),
  createStealthSchedule: (data: any) => axios.post('api/stealth/schedules', data),
  deleteStealthSchedule: (id: number) => axios.delete(`api/stealth/schedules/${id}`),

  // Social Sensors
  getTrackedContacts: (instanceId: number) => axios.get(`api/social/tracked/${instanceId}`),
  trackContact: (instanceId: number, jid: string) => axios.post('api/social/tracked', { instanceId, jid }),
  untrackContact: (instanceId: number, jid: string) => axios.delete(`api/social/tracked/${instanceId}/${jid}`)
};
