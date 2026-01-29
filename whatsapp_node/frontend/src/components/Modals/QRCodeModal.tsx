import React from 'react';
import { QrCode, Smartphone, X } from 'lucide-react';

interface QRCodeModalProps {
  qrCode: string;
  instanceName: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ qrCode, instanceName, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-[300] animate-in fade-in duration-300">
      <div className="relative bg-white rounded-[2.5rem] p-12 shadow-2xl flex flex-col items-center max-w-md w-full mx-4 border border-white/10 animate-in zoom-in-95 duration-500">
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
        >
          <X size={24} />
        </button>

        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
          <QrCode size={40} className="text-teal-600" />
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight text-center">Link {instanceName}</h2>
        <p className="text-slate-500 text-center mb-8 font-medium">Open WhatsApp on your phone to scan</p>

        <div className="bg-white p-4 rounded-3xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] border-4 border-slate-50 mb-8 transform hover:scale-105 transition-transform duration-300">
          <img 
            src={qrCode} 
            alt="WhatsApp QR Code" 
            className="w-64 h-64 object-contain mix-blend-multiply" 
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 bg-slate-50 px-6 py-3 rounded-xl">
          <Smartphone size={16} />
          <span>Settings {'>'} Linked Devices {'>'} Link a Device</span>
        </div>

      </div>
    </div>
  );
};
