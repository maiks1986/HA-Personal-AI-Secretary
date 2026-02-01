import { useState, useEffect } from 'react'
import { Brain, Activity, Puzzle, Terminal } from 'lucide-react'
import { api } from './api'
import { KeyManagement } from './components/KeyManagement'

function App() {
  const [health, setHealth] = useState<any>(null)
  const [addons, setAddons] = useState<any[]>([])

  useEffect(() => {
    // Check for OAuth Callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
        // Clean URL immediately
        window.history.replaceState({}, '', window.location.pathname);
        api.exchangeAuthCode(code, 'Google Account')
            .then(() => {
                alert('Google Account successfully connected!');
                // Trigger refresh logic if we had a global state, but simple reload works too
                window.location.reload(); 
            })
            .catch(err => {
                console.error(err);
                alert('Failed to connect account: ' + (err.response?.data?.error || err.message));
            });
    }

    const fetchData = async () => {
      try {
        const [healthData, addonsData] = await Promise.all([
          api.getHealth(),
          api.getAddons()
        ])
        setHealth(healthData)
        if (addonsData.success) {
          setAddons(addonsData.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch data', error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <header className="flex items-center gap-4 mb-12">
        <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
          <Brain size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">AI Gateway</h1>
          <p className="text-gray-400">Personal Secretary Ecosystem Brain</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity size={20} className="text-green-400" />
              System Status
            </h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${health?.status === 'healthy' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
              {health?.status || 'Unknown'}
            </span>
          </div>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="text-white font-mono">{health?.version || '0.0.1.0001'}</span>
            </div>
            <div className="flex justify-between">
              <span>Uptime</span>
              <span className="text-white">Live</span>
            </div>
          </div>
        </div>

        {/* Key Management (Takes up 2 slots) */}
        <KeyManagement />

        {/* Registered Add-ons */}
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Puzzle size={20} className="text-indigo-400" />
            Active Ecosystem Modules
          </h2>
          {addons.length === 0 ? (
            <div className="text-center py-8 text-gray-500 italic">
              No modules registered yet. Waiting for check-ins...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addons.map((addon) => (
                <div key={addon.slug} className="bg-gray-700/50 p-4 rounded-xl border border-gray-600">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-indigo-300">{addon.slug}</span>
                    <span className="text-xs bg-gray-600 px-2 py-0.5 rounded text-gray-300">v{addon.version}</span>
                  </div>
                  <div className="text-xs text-gray-400 flex flex-col gap-1">
                    <span>Port: {addon.port}</span>
                    <span>Last Seen: {new Date(addon.last_seen).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Console / Last Fixes */}
        <div className="bg-black/50 p-6 rounded-2xl border border-gray-800 md:col-span-3 font-mono text-xs">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <Terminal size={14} />
            <span>Latest System Updates</span>
          </div>
          <div className="text-green-500/80">
            [{health?.last_fix?.timestamp || new Date().toISOString()}] {health?.last_fix?.description || 'System initialized.'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
