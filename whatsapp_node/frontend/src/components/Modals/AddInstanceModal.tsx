import React from 'react';
import { X } from 'lucide-react';

interface AddInstanceModalProps {
  onClose: () => void;
  name: string;
  setName: (n: string) => void;
  onSubmit: () => void;
}

export const AddInstanceModal: React.FC<AddInstanceModalProps> = ({ onClose, name, setName, onSubmit }) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-96 border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter">Deploy Engine</h3>
          <button onClick={onClose} className="bg-slate-50 p-2 rounded-xl text-slate-400 hover:text-red-500 transition-all">
            <X size={24} />
          </button>
        </div>
        <div className="mb-8">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Identifier</label>
          <input 
            autoFocus 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="e.g. CORE" 
            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-teal-500 uppercase font-bold" 
          />
        </div>
        <button onClick={onSubmit} className="w-full bg-teal-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest active:scale-[0.98]">
          Initialize Node
        </button>
      </div>
    </div>
  );
};
