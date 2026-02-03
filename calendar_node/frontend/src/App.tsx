import { useState, useEffect, useCallback } from 'react'
import { Calendar, CheckCircle, AlertCircle, ExternalLink, Key, RefreshCw, LayoutDashboard, Settings, Info, Plus } from 'lucide-react'
import axios, { AxiosError } from 'axios'
import { 
  HealthResponse, 
  AuthUrlResponse, 
  TokenExchangeResponse, 
  TokenExchangeRequest,
  DbCalendar,
  CalendarEvent,
  CalendarRole,
  CalendarInsertRequest
} from './types/shared_schemas'
import { CalendarList } from './components/CalendarList'
import { EventList } from './components/EventList'
import { AddEventForm } from './components/AddEventForm'

function App() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [version, setVersion] = useState('')
  const [authUrl, setAuthUrl] = useState('')
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendars' | 'auth'>('dashboard')
  
  const [calendars, setCalendars] = useState<DbCalendar[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [jwt, setJwt] = useState<string | null>(localStorage.getItem('auth_token'))

  const api = axios.create({
    baseURL: './',
    headers: jwt ? { 'Authorization': `Bearer ${jwt}` } : {}
  });

  const checkHealth = useCallback(async () => {
    try {
      const response = await api.get<HealthResponse>('health')
      setStatus('ok')
      setVersion(response.data.version)
      setIsAuthorized(response.data.authorized)
      
      if (response.data.authorized) {
        fetchData()
      } else {
        fetchAuthUrl()
        if (jwt) syncWithProvider()
      }
    } catch (err) {
      console.error('Health check failed:', err)
      setStatus('error')
    }
  }, [jwt]);

  const fetchData = async () => {
    try {
      const [calRes, eventRes] = await Promise.all([
        api.get<DbCalendar[]>('api/calendars'),
        api.get<CalendarEvent[]>('api/calendar/events')
      ]);
      setCalendars(calRes.data);
      setEvents(eventRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const syncWithProvider = async () => {
    setIsSubmitting(true)
    try {
      await api.post('api/auth/sync-provider')
      setMessage({ type: 'success', text: 'Successfully synced with Identity Gate!' })
      setIsAuthorized(true)
      fetchData()
    } catch (err: any) {
      console.error('Provider sync failed:', err)
      // Only show error if explicitly triggered
    } finally {
      setIsSubmitting(false)
    }
  }

  const fetchAuthUrl = async () => {
    try {
      const response = await api.get<AuthUrlResponse>('api/auth/url')
      setAuthUrl(response.data.url)
    } catch (err) {
      console.error('Failed to fetch auth URL:', err)
    }
  }

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return

    setIsSubmitting(true)
    setMessage({ type: '', text: '' })

    try {
      await api.post<TokenExchangeResponse, any, TokenExchangeRequest>('api/auth/token', { code })
      setMessage({ type: 'success', text: 'Successfully authorized!' })
      setIsAuthorized(true)
      checkHealth()
    } catch (err) {
      const error = err as AxiosError<TokenExchangeResponse>;
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to authorize. Check the console.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.post('api/calendar/sync');
      await fetchData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateRole = async (id: string, role: CalendarRole) => {
    try {
      await api.patch(`api/calendars/${id}/role`, { role });
      setCalendars(prev => prev.map(c => c.id === id ? { ...c, role } : c));
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const addEvent = async (event: CalendarInsertRequest) => {
    await api.post('api/calendar/insert', event);
    await fetchData();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      setJwt(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    checkHealth()
  }, [checkHealth])

  const redirectToLogin = () => {
    const returnTo = window.location.href;
    window.location.href = `/auth_node/?return_to=${encodeURIComponent(returnTo)}`;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Calendar size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Calendar Master</h1>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs font-mono">v{version || '1.0.0'}</span>
                {status === 'ok' && (
                  <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                    <CheckCircle size={10} /> Online
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
             {isAuthorized && (
               <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
               >
                 <RefreshCw size={16} className={isSyncing ? 'animate-spin text-blue-400' : ''} />
                 {isSyncing ? 'Syncing...' : 'Sync Now'}
               </button>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8">
        {!isAuthorized && status === 'ok' ? (
           <div className="max-w-lg mx-auto mt-12">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                  <div className="inline-flex p-4 bg-amber-500/10 rounded-full mb-4">
                    <AlertCircle size={48} className="text-amber-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Authorization Required</h2>
                  <p className="text-slate-400">Connect your Google Calendar to enable the Personal Secretary's scheduling capabilities.</p>
                </div>

                <div className="space-y-6">
                  {!jwt ? (
                    <button 
                      onClick={redirectToLogin}
                      className="flex items-center justify-center gap-3 w-full p-4 bg-purple-600 hover:bg-purple-500 rounded-2xl font-bold transition-all shadow-lg shadow-purple-900/20"
                    >
                      <Key size={20} />
                      Login with Identity Gate
                    </button>
                  ) : (
                    <button 
                      onClick={syncWithProvider}
                      disabled={isSubmitting}
                      className="flex items-center justify-center gap-3 w-full p-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition-all disabled:opacity-50"
                    >
                      <RefreshCw size={20} className={isSubmitting ? 'animate-spin' : ''} />
                      {isSubmitting ? 'Connecting...' : 'Sync from Identity Gate'}
                    </button>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-3 text-slate-500">Manual Alternative</span></div>
                  </div>

                  <a 
                    href={authUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full p-3 border border-slate-700 hover:bg-slate-800 rounded-xl text-sm transition-colors"
                  >
                    <ExternalLink size={16} />
                    Get Google Auth Code
                  </a>

                  <form onSubmit={handleAuthorize} className="flex gap-2">
                    <input 
                      type="text" 
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Paste Code Here"
                      className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button className="px-6 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-all">Go</button>
                  </form>
                </div>

                {message.text && (
                  <div className={`mt-6 p-4 rounded-2xl flex items-center gap-3 ${message.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                    {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    <span className="text-sm font-medium">{message.text}</span>
                  </div>
                )}
              </div>
           </div>
        ) : isAuthorized ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar / Tabs */}
            <aside className="lg:col-span-3 space-y-2">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-900 text-slate-400'}`}
              >
                <LayoutDashboard size={20} />
                <span className="font-semibold">Dashboard</span>
              </button>
              <button 
                onClick={() => setActiveTab('calendars')}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${activeTab === 'calendars' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-900 text-slate-400'}`}
              >
                <Settings size={20} />
                <span className="font-semibold">Manage Roles</span>
              </button>
              <button 
                onClick={() => setActiveTab('auth')}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${activeTab === 'auth' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-900 text-slate-400'}`}
              >
                <Key size={20} />
                <span className="font-semibold">Auth Status</span>
              </button>
              
              <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <Info size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Quick Info</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The <span className="text-slate-300">Shadow DB</span> caches your events for instant AI processing. Use 'Sync Now' to refresh the local cache.
                </p>
              </div>
            </aside>

            {/* Tab Panels */}
            <section className="lg:col-span-9">
              {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <LayoutDashboard className="text-blue-500" />
                        Live Feed
                      </h2>
                      <EventList events={events} />
                    </div>
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Plus size={24} className="text-blue-500" />
                        Quick Action
                      </h2>
                      <AddEventForm onAddEvent={addEvent} />
                      
                      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl">
                        <h4 className="font-bold mb-2">Statistics</h4>
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                            <div className="text-2xl font-bold text-blue-400">{calendars.length}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Calendars</div>
                          </div>
                          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                            <div className="text-2xl font-bold text-green-400">{events.length}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Synced Events</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'calendars' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Calendar Management</h2>
                    <span className="text-xs text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                      Total: {calendars.length}
                    </span>
                  </div>
                  <CalendarList calendars={calendars} onUpdateRole={updateRole} />
                </div>
              )}

              {activeTab === 'auth' && (
                <div className="max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                   <h2 className="text-2xl font-bold mb-6">Authentication Status</h2>
                   <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                        <CheckCircle className="text-green-500" size={32} />
                        <div>
                          <div className="font-bold text-green-400">Google API Connected</div>
                          <p className="text-xs text-slate-400">Tokens are valid and stored securely in the local volume.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-bold text-sm text-slate-400 uppercase tracking-widest">Connection Details</h4>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex justify-between p-3 bg-slate-950 rounded-xl text-sm">
                            <span className="text-slate-500">Provider</span>
                            <span className="font-mono text-blue-400">Google OAuth 2.0</span>
                          </div>
                          <div className="flex justify-between p-3 bg-slate-950 rounded-xl text-sm">
                            <span className="text-slate-500">Scope</span>
                            <span className="font-mono text-blue-400">calendar.events, calendar.readonly</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          setIsAuthorized(false);
                          localStorage.removeItem('auth_token');
                          setJwt(null);
                        }}
                        className="w-full p-3 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-bold transition-all"
                      >
                        Reset Local Authentication
                      </button>
                   </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 animate-pulse">
            <RefreshCw size={48} className="animate-spin mb-4 text-blue-500/30" />
            <p className="font-medium">Connecting to Calendar Master...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-8 text-center text-slate-600 text-xs border-t border-slate-900 mt-auto">
        <p>© 2026 Home Assistant Personal AI Secretary • Ecosystem Integrated</p>
      </footer>
    </div>
  )
}

export default App