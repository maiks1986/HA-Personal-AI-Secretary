import React from 'react';
import { X } from 'lucide-react';
import { StatusUpdate } from '../../types';

interface StatusViewerProps {
  onClose: () => void;
  statuses: StatusUpdate[];
}

export const StatusViewer: React.FC<StatusViewerProps> = ({ onClose, statuses }) => {
  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-[250] animate-in fade-in duration-300">
      <div className="max-w-2xl w-full h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-6">
          <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Status Updates</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-all"><X size={32} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {statuses.length === 0 ? (
            <p className="text-slate-500 text-center italic mt-20">No status updates found.</p>
          ) : (
            statuses.map(s => (
              <div key={s.id} className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-xl">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                  <span className="text-teal-400 font-black text-xs uppercase">{s.sender_name}</span>
                  <span className="text-slate-500 text-[10px]">{new Date(s.timestamp).toLocaleString()}</span>
                </div>
                {s.media_path && (
                  <div className="aspect-video bg-black flex items-center justify-center">
                    {s.type === 'image' ? (
                      <img src={`/media/${s.media_path.split(/[\/]/).pop()}`} className="max-h-full max-w-full object-contain" alt="status" />
                    ) : (
                      <video src={`/media/${s.media_path.split(/[\/]/).pop()}`} controls className="max-h-full max-w-full" />
                    )}
                  </div>
                )}
                <div className="p-4 text-white text-sm leading-relaxed">{s.text}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
