import { useState, useEffect } from 'react';
import { Key, Trash2, Plus, AlertTriangle, Settings, ShieldCheck, Link2 } from 'lucide-react';
import { api } from '../api';
import axios from 'axios';

export function KeyManagement() {
    const [keys, setKeys] = useState<any[]>([]);
    const [newKey, setNewKey] = useState('');
    const [label, setLabel] = useState('');
    const [provider, setProvider] = useState('gemini');
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    
    // Auth Node Providers
    const [oauthProviders, setOauthProviders] = useState<any[]>([]);

    const fetchKeys = async () => {
        const res = await api.getKeys();
        if (res.success && res.data) {
            setKeys(res.data);
        }
    };

    const fetchOauthProviders = async () => {
        try {
            // Note: We need a public endpoint on Auth Node to list providers
            // for the button display, OR we assume the user is logged in.
            const authBase = window.location.origin + window.location.pathname.replace(/ai_gateway\/?$/, 'auth_node');
            const res = await axios.get(`${authBase}/api/oauth/providers`);
            if (res.data.success) {
                setOauthProviders(res.data.providers);
            }
        } catch (e) {
            console.warn('Could not fetch OAuth providers from Auth Node');
        }
    };

    useEffect(() => {
        fetchKeys();
        fetchOauthProviders();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.addKey(provider, newKey, label, 'static'); 
            setNewKey('');
            setLabel('');
            await fetchKeys();
        } catch (error) {
            console.error('Failed to add key', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this key?')) return;
        try {
            await api.deleteKey(id);
            await fetchKeys();
        } catch (error) {
            console.error('Failed to delete key', error);
        }
    };

    const startOAuth = async (providerId: string) => {
        const res = await api.getAuthUrl(providerId);
        if (res.success && res.data?.url) {
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            
            const win = window.open(
                res.data.url, 
                'oauth-bridge', 
                `width=${width},height=${height},left=${left},top=${top}`
            );

            const timer = setInterval(() => {
                if (win?.closed) {
                    clearInterval(timer);
                    fetchKeys();
                }
            }, 1000);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 md:col-span-2 relative">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Key size={20} className="text-yellow-400" />
                    API Key Management
                </h2>
            </div>

            {/* Actions: OAuth Bridge */}
            <div className="space-y-4 mb-6">
                <div className="bg-blue-900/10 border border-blue-800/30 p-4 rounded-xl">
                    <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                        <Link2 size={16} /> OAuth Bridges (Auth Node)
                    </h4>
                    <p className="text-xs text-slate-400 mb-4">
                        Connect your cloud accounts via the central Identity Gate.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {oauthProviders.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => startOAuth(p.id)}
                                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg border border-slate-600 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                            >
                                {p.type === 'google' && <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" className="w-4 h-4" alt="" />}
                                Connect {p.name}
                            </button>
                        ))}
                        {oauthProviders.length === 0 && (
                            <div className="col-span-2 text-center py-4 text-slate-500 border border-dashed border-slate-700 rounded-lg text-xs">
                                No OAuth Bridges configured in Identity Gate.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-700 my-4"></div>

            {/* Add Static Key Form */}
            <form onSubmit={handleAdd} className="bg-gray-700/30 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-3">
                <select 
                    value={provider} 
                    onChange={e => setProvider(e.target.value)}
                    className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                </select>
                <input 
                    type="text" 
                    placeholder="Label (optional)" 
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 w-full md:w-32"
                />
                <input 
                    type="password" 
                    placeholder="API Key (starts with AIza...)" 
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    required
                    className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 w-full flex-grow"
                />
                <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded flex items-center gap-2 justify-center"
                >
                    <Plus size={18} /> Add
                </button>
            </form>

            {/* Key List */}
            <div className="space-y-3">
                {keys.map(k => (
                    <div key={k.id} className="bg-gray-700/50 p-3 rounded-lg flex items-center justify-between border border-gray-600">
                        <div className="flex items-center gap-4">
                            <div className={`w-2 h-2 rounded-full ${k.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                            <div>
                                <div className="font-bold text-gray-200">{k.provider.toUpperCase()} <span className="text-gray-400 font-normal text-sm">({k.label || 'No Label'})</span></div>
                                <div className="text-xs text-gray-500 font-mono">{k.key_value}</div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {k.error_count > 0 && (
                                <span className="text-xs text-yellow-400 flex items-center gap-1">
                                    <AlertTriangle size={12} /> {k.error_count} errors
                                </span>
                            )}
                            <button 
                                onClick={() => handleDelete(k.id)}
                                className="text-red-400 hover:text-red-300 p-2"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                {keys.length === 0 && (
                    <div className="text-center text-gray-500 py-4 italic">No API keys configured. The brain is asleep.</div>
                )}
            </div>
        </div>
    );
}
