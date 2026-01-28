import React from 'react';
import { X, Check } from 'lucide-react';
import { Contact } from '../../types';

interface GroupModalProps {
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  setTitle: (t: string) => void;
  contacts: Contact[];
  selectedContacts: string[];
  setSelectedContacts: React.Dispatch<React.SetStateAction<string[]>>;
}

export const GroupModal: React.FC<GroupModalProps> = ({ 
  onClose, 
  onSubmit, 
  title, 
  setTitle, 
  contacts, 
  selectedContacts, 
  setSelectedContacts 
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[150] backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-[400px] border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-xl text-slate-800 uppercase">Create New Group</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-all"><X size={24} /></button>
        </div>
        <input 
          placeholder="Group Title" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl mb-4 outline-none focus:border-teal-500" 
        />
        <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl p-2 mb-6">
          {contacts.map(c => (
            <div 
              key={c.jid} 
              onClick={() => setSelectedContacts(prev => prev.includes(c.jid) ? prev.filter(j => j !== c.jid) : [...prev, c.jid])} 
              className={`p-3 flex items-center gap-3 rounded-lg cursor-pointer transition-all ${selectedContacts.includes(c.jid) ? 'bg-teal-50 border-teal-200' : 'hover:bg-slate-50'}`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedContacts.includes(c.jid) ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'}`}>
                {selectedContacts.includes(c.jid) && <Check size={12} />}
              </div>
              <span className="text-sm font-bold text-slate-700">{c.name}</span>
            </div>
          ))}
        </div>
        <button onClick={onSubmit} className="w-full bg-teal-600 text-white p-4 rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95">
          Deploy Group
        </button>
      </div>
    </div>
  );
};
