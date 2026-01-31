import React, { useState, useEffect } from 'react';
import { Settings, X, AlertTriangle, ShieldAlert, Clock, Plus, Trash2, Activity, UserPlus } from 'lucide-react';
import { api } from '../../api';

interface SettingsModalProps {
  onClose: () => void;
  selectedInstanceId?: number;
  geminiKey: string;
  setGeminiKey: (k: string) => void;
  autoNudge: boolean;
  setAutoNudge: (n: boolean) => void;
  syncDelay: number;
  setSyncDelay: (d: number) => void;
  ephemeralStart: string;
  setEphemeralStart: (s: string) => void;
  ephemeralStop: string;
  setEphemeralStop: (s: string) => void;
  onSave: () => void;
  onReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  onClose, 
  selectedInstanceId,
  geminiKey, 
  setGeminiKey, 
  autoNudge, 
  setAutoNudge, 
  syncDelay,
  setSyncDelay,
  ephemeralStart,
  setEphemeralStart,
  ephemeralStop,
  setEphemeralStop,
  onSave, 
  onReset 
}) => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [trackedContacts, setTrackedContacts] = useState<any[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [isAddingStealth, setIsAddingStealth] = useState(false);
  const [isAddingTracked, setIsAddingTracked] = useState(false);
  const [newSchedule, setNewStealth] = useState({ name: 'Stealth Mode', start_time: '18:00', end_time: '09:00', days: [1,2,3,4,5], mode: 'GLOBAL_NOBODY' });
  const [selectedContactToTrack, setSelectedContactToTrack] = useState('');

  useEffect(() => {
    if (selectedInstanceId) {
        api.getStealthSchedules(selectedInstanceId).then(res => setSchedules(res.data));
        api.getTrackedContacts(selectedInstanceId).then(res => setTrackedContacts(res.data));
        api.getContacts(selectedInstanceId).then(res => setAllContacts(res.data));
    }
  }, [selectedInstanceId]);

  const handleAddStealth = async () => {
    if (!selectedInstanceId) return;
    await api.createStealthSchedule({ ...newSchedule, instanceId: selectedInstanceId });
    setIsAddingStealth(false);
    api.getStealthSchedules(selectedInstanceId).then(res => setSchedules(res.data));
  };

  const handleDeleteStealth = async (id: number) => {
    await api.deleteStealthSchedule(id);
    if (selectedInstanceId) api.getStealthSchedules(selectedInstanceId).then(res => setSchedules(res.data));
  };

  const handleTrackContact = async () => {
    if (!selectedInstanceId || !selectedContactToTrack) return;
    await api.trackContact(selectedInstanceId, selectedContactToTrack);
    setIsAddingTracked(false);
    api.getTrackedContacts(selectedInstanceId).then(res => setTrackedContacts(res.data));
  };

  const handleUntrack = async (jid: string) => {
    if (!selectedInstanceId) return;
    await api.untrackContact(selectedInstanceId, jid);
    api.getTrackedContacts(selectedInstanceId).then(res => setTrackedContacts(res.data));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-[500px] border border-slate-100 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-black text-2xl flex items-center gap-3 text-slate-800 uppercase tracking-tighter">
            <Settings className="text-teal-600" /> System Config
          </h3>
          <button onClick={onClose} className="bg-slate-50 p-2 rounded-xl text-slate-400 hover:text-red-500 transition-all">
            <X size={24} />
          </button>
        </div>
        <div className="space-y-8">
          {/* AI Settings */}
          <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Gemini AI Engine</label>
            <input 
              type="password" 
              value={geminiKey} 
              onChange={(e) => setGeminiKey(e.target.value)} 
              placeholder="Google AI Studio Key..." 
              className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-teal-500 transition-all text-sm font-mono shadow-sm" 
            />
          </div>

          {/* Social Sensors */}
          <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-600"><Activity size={80} /></div>
            <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-blue-600"><Activity size={16} /> Social Sensors</h4>
                    <button onClick={() => setIsAddingTracked(!isAddingTracked)} className="p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all"><UserPlus size={16} /></button>
                </div>

                <div className="space-y-2 mb-4">
                    {trackedContacts.map(t => (
                        <div key={t.jid} className="bg-white p-3 rounded-xl flex justify-between items-center border border-blue-100 shadow-sm">
                            <div>
                                <div className="text-xs font-bold text-slate-700">{t.name || t.jid.split('@')[0]}</div>
                                <div className="text-[8px] opacity-50 font-black uppercase tracking-widest">Today: {Math.floor(t.today_duration / 60)}m</div>
                            </div>
                            <button onClick={() => handleUntrack(t.jid)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                    ))}
                    {trackedContacts.length === 0 && <div className="text-center py-4 text-blue-300 text-[10px] font-bold uppercase">No tracked contacts</div>}
                </div>

                {isAddingTracked && (
                    <div className="bg-white p-4 rounded-2xl space-y-4 border border-blue-200 animate-in slide-in-from-top-2">
                        <select 
                            value={selectedContactToTrack} 
                            onChange={(e) => setSelectedContactToTrack(e.target.value)} 
                            className="w-full bg-slate-50 p-3 rounded-xl text-xs border border-slate-200 outline-none"
                        >
                            <option value="">Select Contact...</option>
                            {allContacts.map(c => <option key={c.jid} value={c.jid}>{c.name || c.jid}</option>)}
                        </select>
                        <button onClick={handleTrackContact} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase">Track Presence</button>
                    </div>
                )}
            </div>
          </div>

          {/* Stealth Mode Scheduler */}
          <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldAlert size={80} /></div>
            <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-teal-400"><Clock size={16} /> Stealth Scheduler</h4>
                    <button onClick={() => setIsAddingStealth(!isAddingStealth)} className="p-1 bg-teal-600 rounded-lg hover:bg-teal-500 transition-all"><Plus size={16} /></button>
                </div>

                <div className="space-y-3 mb-4">
                    {schedules.map(s => (
                        <div key={s.id} className="bg-slate-800 p-3 rounded-xl flex justify-between items-center border border-slate-700">
                            <div>
                                <div className="text-[10px] font-black uppercase text-teal-400">{s.name}</div>
                                <div className="text-xs font-bold">{s.start_time} - {s.end_time}</div>
                                <div className="text-[8px] opacity-50 font-black uppercase">Mode: {s.mode === 'GLOBAL_NOBODY' ? 'Incognito (Everyone)' : 'Targeted'}</div>
                            </div>
                            <button onClick={() => handleDeleteStealth(s.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                    ))}
                    {schedules.length === 0 && <div className="text-center py-4 text-slate-500 text-[10px] font-bold uppercase">No active schedules</div>}
                </div>

                {isAddingStealth && (
                    <div className="bg-slate-800 p-4 rounded-2xl space-y-4 border-2 border-teal-500/30 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Start</label>
                                <input type="time" value={newSchedule.start_time} onChange={e => setNewStealth({...newSchedule, start_time: e.target.value})} className="w-full bg-slate-900 p-2 rounded-lg text-xs border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">End</label>
                                <input type="time" value={newSchedule.end_time} onChange={e => setNewStealth({...newSchedule, end_time: e.target.value})} className="w-full bg-slate-900 p-2 rounded-lg text-xs border border-slate-700" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Mode</label>
                            <select value={newSchedule.mode} onChange={e => setNewStealth({...newSchedule, mode: e.target.value})} className="w-full bg-slate-900 p-2 rounded-lg text-xs border border-slate-700">
                                <option value="GLOBAL_NOBODY">Hide from Everyone</option>
                                <option value="SPECIFIC_CONTACTS">Hide from Specific Contacts (Coming Soon)</option>
                            </select>
                        </div>
                        <button onClick={handleAddStealth} className="w-full bg-teal-600 py-2 rounded-xl text-[10px] font-black uppercase">Create Schedule</button>
                    </div>
                )}
            </div>
          </div>

          {/* Ephemeral Settings */}
          <div className="p-6 bg-purple-50 rounded-[2rem] border border-purple-100">
            <label className="block text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-4">Ephemeral Trigger Emojis</label>
            <div className="flex gap-4">
                <div className="flex-1 bg-white p-3 rounded-2xl border border-purple-100 text-center">
                    <span className="text-[8px] text-purple-600 font-bold uppercase block mb-1">Start</span>
                    <input 
                      type="text" 
                      value={ephemeralStart} 
                      onChange={(e) => setEphemeralStart(e.target.value)} 
                      className="w-full bg-transparent outline-none text-center text-xl" 
                      maxLength={2}
                    />
                </div>
                <div className="flex-1 bg-white p-3 rounded-2xl border border-purple-100 text-center">
                    <span className="text-[8px] text-red-500 font-bold uppercase block mb-1">Stop</span>
                    <input 
                      type="text" 
                      value={ephemeralStop} 
                      onChange={(e) => setEphemeralStop(e.target.value)} 
                      className="w-full bg-transparent outline-none text-center text-xl" 
                      maxLength={2}
                    />
                </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Sync performance</label>
                    <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{(syncDelay / 1000).toFixed(1)}s</span>
                </div>
                <input 
                    type="range" 
                    min="1000" 
                    max="30000" 
                    step="500" 
                    value={syncDelay} 
                    onChange={(e) => setSyncDelay(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-600"
                />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 shadow-sm">
                <div>
                    <h4 className="text-xs font-black text-slate-700 uppercase">Auto-Nudge Health Check</h4>
                    <p className="text-[9px] text-slate-400 font-bold">Automatically restart stalled syncs</p>
                </div>
                <button 
                    onClick={() => setAutoNudge(!autoNudge)} 
                    className={`w-12 h-6 rounded-full transition-all relative ${autoNudge ? 'bg-teal-600' : 'bg-slate-300'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoNudge ? 'left-7' : 'left-1'}`}></div>
                </button>
            </div>

            <button onClick={onSave} className="w-full bg-teal-600 text-white p-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-teal-700 shadow-xl transition-all active:scale-[0.98]">
                Update All Configs
            </button>
          </div>
          
          <div className="pt-6 border-t border-slate-100 mt-6 text-center">
            <button onClick={onReset} className="w-full bg-white text-red-500 border-2 border-red-100 p-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2">
              <AlertTriangle size={16} /> Factory System Wipe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};