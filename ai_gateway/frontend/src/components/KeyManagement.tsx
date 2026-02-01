import { useState, useEffect } from 'react';
import { Key, Trash2, Plus, AlertTriangle, Settings } from 'lucide-react';
import { api } from '../api';

export function KeyManagement() {
    const [keys, setKeys] = useState<any[]>([]);
    const [newKey, setNewKey] = useState('');
    const [label, setLabel] = useState('');
    const [provider, setProvider] = useState('gemini');
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    
    // Settings State
    const [clientId, setClientId] = useState('');
    const [redirectUri, setRedirectUri] = useState('');

    const fetchKeys = async () => {
        const res = await api.getKeys();
        if (res.success && res.data) {
            setKeys(res.data);
        }
    };

    const fetchSettings = async () => {
        const res = await api.getSettings();
        if (res.success && res.data) {
            setClientId(res.data.google_client_id || '');
            setRedirectUri(res.data.google_redirect_uri || '');
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.addKey(provider, newKey, label, 'static'); // Default static
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

    const startOAuth = async () => {
        try {
            const res = await api.getAuthUrl();
            if (res.success && res.data?.url) {
                // Open in a popup
                const width = 600;
                const height = 700;
                const left = window.screen.width / 2 - width / 2;
                const top = window.screen.height / 2 - height / 2;
                
                const win = window.open(
                    res.data.url, 
                    'google-oauth', 
                    `width=${width},height=${height},left=${left},top=${top}`
                );

                // Simple polling to refresh keys once popup is closed
                const timer = setInterval(() => {
                    if (win?.closed) {
                        clearInterval(timer);
                        fetchKeys();
                    }
                }, 1000);

            } else {
                alert('Could not generate Auth URL. Ensure Client ID/Secret are configured in Add-on Settings.');
            }
        } catch (e) {
            alert('Failed to start OAuth. Configure Client ID/Secret in Add-on Settings first.');
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 md:col-span-2 relative">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Key size={20} className="text-yellow-400" />
                    API Key Management
                </h2>
                <button onClick={() => { setShowSettings(true); fetchSettings(); }} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors">
                    <Settings size={20} />
                </button>
            </div>

            {/* OAuth Config View (Read Only) */}
            {showSettings && (
                <div className="absolute inset-0 bg-gray-900/95 z-10 p-6 rounded-2xl flex flex-col justify-center">
                    <h3 className="text-lg font-bold mb-4 text-white">Google OAuth Configuration</h3>
                    <p className="text-xs text-gray-400 mb-4">These settings are managed in the Home Assistant Add-on Configuration tab.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Client ID</label>
                            <input type="text" value={clientId} readOnly className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-gray-400 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Client Secret</label>
                            <input type="text" value="********" readOnly className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-gray-400 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Redirect URI</label>
                            <input type="text" value={redirectUri} readOnly className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-gray-400 cursor-not-allowed" />
                        </div>
                        <div className="flex justify-end mt-4">
                            <button onClick={() => setShowSettings(false)} className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mb-6">
                <button onClick={startOAuth} className="flex-1 bg-white text-gray-900 font-medium px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" className="w-5 h-5" alt="Google" />
                    Connect Account
                </button>
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
