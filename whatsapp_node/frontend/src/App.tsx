import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { 
  Send, 
  Plus, 
  User, 
  Trash2, 
  Sparkles, 
  RefreshCw, 
  CircleDot,
  Search,
  MoreVertical,
  X
} from 'lucide-react';

const socket = io();

interface Instance {
  id: number;
  name: string;
  status: string;
  qr?: string | null;
}

interface Message {
  id: number;
  sender_name: string;
  chat_jid: string;
  text: string;
  timestamp: string;
  is_from_me: number;
}

const App = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [steerText, setSteerText] = useState('');
  const [isAddingInstance, setIsAddingInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInstances();
    
    socket.on('instances_status', (statusUpdates: any[]) => {
      setInstances(prev => prev.map(inst => {
        const update = statusUpdates.find(u => u.id === inst.id);
        return update ? { ...inst, status: update.status, qr: update.qr } : inst;
      }));
    });

    return () => {
      socket.off('instances_status');
    };
  }, []);

  useEffect(() => {
    if (selectedInstance && selectedInstance.status === 'connected') {
      // For simplicity, we fetch all messages for the "Me" chat or similar
      // In full version, we'd have a Chat List selection
      fetchMessages(selectedInstance.id, '31657349267@s.whatsapp.net'); 
    }
  }, [selectedInstance]);

  const fetchInstances = async () => {
    const res = await axios.get('/api/instances');
    setInstances(res.data);
    if (res.data.length > 0 && !selectedInstance) {
      setSelectedInstance(res.data[0]);
    }
  };

  const fetchMessages = async (instanceId: number, jid: string) => {
    const res = await axios.get(`/api/messages/${instanceId}/${jid}`);
    setMessages(res.data);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCreateInstance = async () => {
    if (!newInstanceName) return;
    await axios.post('/api/instances', { name: newInstanceName });
    setNewInstanceName('');
    setIsAddingInstance(false);
    fetchInstances();
  };

  const handleSendMessage = async () => {
    if (!inputText || !selectedInstance) return;
    try {
      await axios.post('/api/send_message', {
        instanceId: selectedInstance.id,
        contact: '31657349267', // Hardcoded for prototype
        message: inputText
      });
      setInputText('');
      // Refresh local view immediately
      fetchMessages(selectedInstance.id, '31657349267@s.whatsapp.net');
    } catch (e) {
      alert("Failed to send");
    }
  };

  return (
    <div className="flex h-screen bg-whatsapp-bg overflow-hidden text-slate-800">
      {/* Sidebar: Instance List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 bg-slate-50 flex justify-between items-center border-b">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center">
              <User size={20} className="text-slate-600" />
            </div>
            <h2 className="font-bold">Accounts</h2>
          </div>
          <button 
            onClick={() => setIsAddingInstance(true)}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {instances.map(inst => (
            <div 
              key={inst.id}
              onClick={() => setSelectedInstance(inst)}
              className={`p-4 flex items-center gap-3 cursor-pointer border-b border-slate-50 transition-colors ${selectedInstance?.id === inst.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
            >
              <div className="relative">
                <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                  {inst.name[0].toUpperCase()}
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${inst.status === 'connected' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="font-semibold truncate">{inst.name}</div>
                <div className="text-xs text-slate-500 truncate">{inst.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Chat View */}
      <div className="flex-1 flex flex-col relative">
        {selectedInstance ? (
          <>
            {/* Chat Header */}
            <header className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center">
                  <CircleDot size={20} />
                </div>
                <div>
                  <h3 className="font-bold">{selectedInstance.name}</h3>
                  <p className="text-xs text-green-600">{selectedInstance.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-slate-500">
                <Search size={20} />
                <MoreVertical size={20} />
              </div>
            </header>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2 bg-[#efeae2]">
              {selectedInstance.status === 'qr_ready' && selectedInstance.qr && (
                <div className="bg-white p-8 rounded-lg shadow-md mx-auto my-10 text-center max-w-sm">
                  <h2 className="text-xl font-bold mb-4">Link this account</h2>
                  <p className="text-sm text-slate-600 mb-6">Scan the QR code with your phone to start.</p>
                  <img src={selectedInstance.qr} className="mx-auto border p-2 bg-white" />
                </div>
              )}

              {messages.map((m) => (
                <div 
                  key={m.id} 
                  className={`max-w-[70%] p-2 px-3 rounded-lg shadow-sm text-sm relative ${m.is_from_me ? 'bg-whatsapp-bubble self-end' : 'bg-white self-start'}`}
                >
                  <div className="mb-1">{m.text}</div>
                  <div className="text-[10px] text-slate-400 text-right">{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <footer className="p-3 bg-slate-50 border-t flex flex-col gap-2">
              {/* AI Steering Row */}
              <div className="flex gap-2 items-center px-2">
                <Sparkles size={16} className="text-teal-600" />
                <input 
                  value={steerText}
                  onChange={(e) => setSteerText(e.target.value)}
                  placeholder="Steer AI: e.g. 'Be more professional' or 'Say goodbye'"
                  className="flex-1 bg-transparent text-xs outline-none border-b border-transparent focus:border-teal-600 p-1"
                />
              </div>

              {/* Text Input Row */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setInputText('')}
                  className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                  title="Clear"
                >
                  <Trash2 size={20} />
                </button>
                <div className="flex-1 bg-white rounded-lg flex items-center px-3 py-1 border border-slate-200 shadow-sm focus-within:border-teal-500">
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 outline-none resize-none max-h-32 text-sm py-1"
                    rows={1}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  />
                </div>
                <button 
                  onClick={handleSendMessage}
                  className="bg-teal-600 text-white p-2 rounded-full hover:bg-teal-700 transition-colors shadow-sm"
                >
                  <Send size={20} />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-center items-center justify-center bg-slate-100 flex-col gap-4">
            <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center">
              <RefreshCw size={48} className="text-slate-400" />
            </div>
            <h2 className="text-xl font-light text-slate-500 text-center">Select an account to start chatting<br/><span className="text-sm">Everything stays safe in your private database.</span></h2>
          </div>
        )}
      </div>

      {/* New Instance Modal */}
      {isAddingInstance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-80">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Add New Account</h3>
              <button onClick={() => setIsAddingInstance(false)}><X size={20} /></button>
            </div>
            <input 
              autoFocus
              value={newInstanceName}
              onChange={(e) => setNewInstanceName(e.target.value)}
              placeholder="Display Name (e.g. Work)"
              className="w-full p-2 border rounded-lg mb-4 outline-teal-600"
            />
            <button 
              onClick={handleCreateInstance}
              className="w-full bg-teal-600 text-white p-2 rounded-lg font-bold hover:bg-teal-700"
            >
              Start Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;