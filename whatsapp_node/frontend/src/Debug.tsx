import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Terminal, X, Trash2, Pause, Play } from 'lucide-react';

const socket = io();

const Debug = ({ onClose }: { onClose: () => void }) => {
    const [events, setEvents] = useState<any[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        socket.emit('subscribe_raw_events');
        
        socket.on('raw_whatsapp_event', (data) => {
            if (isPaused) return;
            setEvents(prev => [...prev.slice(-99), {
                id: Date.now() + Math.random(),
                timestamp: new Date().toLocaleTimeString(),
                instanceId: data.instanceId,
                payload: data.events
            }]);
        });

        return () => {
            socket.off('raw_whatsapp_event');
        };
    }, [isPaused]);

    useEffect(() => {
        if (!isPaused) {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [events, isPaused]);

    return (
        <div className="fixed inset-4 bg-slate-900 rounded-3xl shadow-2xl z-[200] border border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500/10 rounded-lg"><Terminal size={20} className="text-teal-400" /></div>
                    <div>
                        <h3 className="text-white font-bold uppercase tracking-widest text-xs">Raw Engine Stream</h3>
                        <p className="text-[10px] text-slate-400 font-mono">Monitoring Baileys Socket Events</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsPaused(!isPaused)} className={`p-2 rounded-xl transition-all ${isPaused ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                        {isPaused ? <Play size={18} /> : <Pause size={18} />}
                    </button>
                    <button onClick={() => setEvents([])} className="p-2 bg-slate-700 text-slate-300 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all"><Trash2 size={18} /></button>
                    <button onClick={onClose} className="p-2 bg-slate-700 text-slate-300 hover:bg-white/10 rounded-xl transition-all ml-4"><X size={18} /></button>
                </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px]">
                {events.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                        <Terminal size={48} className="opacity-20" />
                        <p className="italic">Waiting for WhatsApp events...</p>
                    </div>
                )}
                {events.map(ev => (
                    <div key={ev.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 animate-in slide-in-from-left-2 duration-200">
                        <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
                            <span className="text-teal-400 font-bold">[{ev.timestamp}] Instance {ev.instanceId}</span>
                            <span className="text-slate-500 text-[9px] uppercase font-black">{Object.keys(ev.payload).join(', ')}</span>
                        </div>
                        <pre className="text-slate-300 whitespace-pre-wrap break-all">
                            {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                    </div>
                ))}
            </div>
            
            <footer className="p-2 bg-slate-800 border-t border-slate-700 text-[9px] text-slate-500 text-center font-bold uppercase tracking-widest">
                Real-time Debugging Interface &bull; V1.0.0 &bull; Total Events: {events.length}
            </footer>
        </div>
    );
};

export default Debug;
