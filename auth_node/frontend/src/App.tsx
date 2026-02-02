import { useState, useEffect } from 'react'
import axios from 'axios'
import { KeyRound, Loader2, Users, UserPlus, Trash2, LogOut, ShieldCheck, Link2, ExternalLink, Settings } from 'lucide-react'
import type { User, LoginResponse, OAuthProvider } from '@/types/shared_schemas'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [show2FA, setShow2FA] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)

  // Admin View State
  const [users, setUsers] = useState<User[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [newUserPass, setNewUserPass] = useState('')
  const [newUserRole, setNewUserRole] = useState<User['role']>('user')

  // OAuth State
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  const [userConnections, setUserConnections] = useState<string[]>([])
  const [newProvider, setNewProvider] = useState<Partial<OAuthProvider>>({
    name: '',
    type: 'generic',
    client_id: '',
    client_secret: '',
    authorize_url: '',
    token_url: '',
    redirect_uri: `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}/api/oauth/callback`,
    scope: ''
  })

  const fetchUsers = async () => {
    try {
      const baseUrl = window.location.pathname.replace(/\/+$/, '');
      const res = await axios.get(`${baseUrl}/api/auth/users`)
      if (res.data.success) {
        setUsers(res.data.users)
      }
    } catch (err) {
      console.error('Failed to fetch users')
    }
  }

  const fetchProviders = async () => {
    try {
      const baseUrl = window.location.pathname.replace(/\/+$/, '');
      const res = await axios.get(`${baseUrl}/api/oauth/providers`)
      if (res.data.success) {
        setProviders(res.data.providers)
      }
    } catch (err) {
      console.error('Failed to fetch providers')
    }
  }

  const fetchConnections = async () => {
    try {
      const baseUrl = window.location.pathname.replace(/\/+$/, '');
      const res = await axios.get(`${baseUrl}/api/oauth/user/connections`)
      if (res.data.success) {
        setUserConnections(res.data.connectedProviderIds)
      }
    } catch (err) {
      console.error('Failed to fetch connections')
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers()
      fetchProviders()
      fetchConnections()
    } else if (user) {
      fetchProviders()
      fetchConnections()
    }
  }, [user])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const baseUrl = window.location.pathname.replace(/\/+$/, '');
    const apiUrl = `${baseUrl}/api/auth/login`;

    try {
      const returnTo = new URLSearchParams(window.location.search).get('return_to');
      const res = await axios.post<LoginResponse>(`${apiUrl}${returnTo ? '?return_to=' + encodeURIComponent(returnTo) : ''}`, { 
        username, 
        password,
        totp_code: show2FA ? totpCode : undefined
      })
      
      if (res.data.success && res.data.user) {
        setUser(res.data.user)
        if ((res.data as any).redirect) {
          window.location.href = (res.data as any).redirect;
        }
      } else if (res.data.requires_2fa) {
        setShow2FA(true)
        setError('Two-Factor Authentication required')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed')
      if (show2FA) setTotpCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const baseUrl = window.location.pathname.replace(/\/+$/, '');
      await axios.post(`${baseUrl}/api/auth/users`, {
        username: newUserName,
        password: newUserPass,
        role: newUserRole
      })
      setNewUserName('')
      setNewUserPass('')
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add user')
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure?')) return
    try {
      const baseUrl = window.location.pathname.replace(/\/+$/, '');
      await axios.delete(`${baseUrl}/api/auth/users/${id}`)
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete user')
    }
  }

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const baseUrl = window.location.pathname.replace(/\/+$/, '');
      await axios.post(`${baseUrl}/api/oauth/providers`, newProvider)
      setNewProvider({
        name: '',
        type: 'generic',
        client_id: '',
        client_secret: '',
        authorize_url: '',
        token_url: '',
        redirect_uri: `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}/api/oauth/callback`,
        scope: ''
      })
      fetchProviders()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add provider')
    }
  }

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure?')) return
    try {
      const baseUrl = window.location.pathname.replace(/\/+$/, '');
      await axios.delete(`${baseUrl}/api/oauth/providers/${id}`)
      fetchProviders()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete provider')
    }
  }

  const handleConnectProvider = (id: string) => {
    const baseUrl = window.location.pathname.replace(/\/+$/, '');
    window.open(`${baseUrl}/api/oauth/start/${id}`, '_blank', 'width=600,height=700');
  }

  const handleLogout = () => {
    setUser(null)
    setUsername('')
    setPassword('')
    setShow2FA(false)
  }

  if (user) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-xl">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Identity Gate</h1>
                <p className="text-slate-400 text-sm">Logged in as <span className="text-blue-400 font-medium">{user.username}</span> ({user.role})</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-red-900/40 text-slate-300 hover:text-red-400 rounded-lg transition-all border border-slate-600 hover:border-red-900/50"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>

          {user.role === 'admin' ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Add User Section */}
                <div className="lg:col-span-1 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg h-fit">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <UserPlus className="text-blue-400" size={20} />
                    Add New User
                  </h2>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Username</label>
                      <input 
                        type="text" 
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Password</label>
                      <input 
                        type="password" 
                        value={newUserPass}
                        onChange={(e) => setNewUserPass(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Role</label>
                      <select 
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="guest">Guest</option>
                      </select>
                    </div>
                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg mt-4 shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]">
                      Create User
                    </button>
                  </form>
                </div>

                {/* User List Section */}
                <div className="lg:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Users className="text-blue-400" size={20} />
                    System Users
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="pb-3 px-2">User</th>
                          <th className="pb-3 px-2">Role</th>
                          <th className="pb-3 px-2">Created</th>
                          <th className="pb-3 px-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-700/30 transition-colors group">
                            <td className="py-4 px-2">
                              <div className="font-medium text-slate-200">{u.username}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{u.id}</div>
                            </td>
                            <td className="py-4 px-2">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                u.role === 'admin' ? 'bg-purple-900/40 text-purple-400' : 'bg-blue-900/40 text-blue-400'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-sm text-slate-400">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-4 px-2 text-right">
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={u.username === user.username}
                                className="p-2 text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* OAuth Bridge Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* Add OAuth Provider */}
                 <div className="lg:col-span-1 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg h-fit">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Settings className="text-green-400" size={20} />
                    Add OAuth Bridge
                  </h2>
                  <form onSubmit={handleAddProvider} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Provider Name</label>
                      <input 
                        type="text" 
                        value={newProvider.name}
                        onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                        placeholder="Google, GitHub..."
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Type</label>
                      <select 
                        value={newProvider.type}
                        onChange={(e) => setNewProvider({...newProvider, type: e.target.value as any})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      >
                        <option value="google">Google</option>
                        <option value="github">GitHub</option>
                        <option value="generic">Generic OAuth2</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Client ID</label>
                      <input 
                        type="text" 
                        value={newProvider.client_id}
                        onChange={(e) => setNewProvider({...newProvider, client_id: e.target.value})}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Client Secret</label>
                      <input 
                        type="password" 
                        value={newProvider.client_secret}
                        onChange={(e) => setNewProvider({...newProvider, client_secret: e.target.value})}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Authorize URL</label>
                      <input 
                        type="url" 
                        value={newProvider.authorize_url}
                        onChange={(e) => setNewProvider({...newProvider, authorize_url: e.target.value})}
                        placeholder="https://accounts.google.com/o/oauth2/v2/auth"
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition-all text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Token URL</label>
                      <input 
                        type="url" 
                        value={newProvider.token_url}
                        onChange={(e) => setNewProvider({...newProvider, token_url: e.target.value})}
                        placeholder="https://oauth2.googleapis.com/token"
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition-all text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Redirect URI</label>
                      <input 
                        type="url" 
                        value={newProvider.redirect_uri}
                        readOnly
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Scope</label>
                      <input 
                        type="text" 
                        value={newProvider.scope}
                        onChange={(e) => setNewProvider({...newProvider, scope: e.target.value})}
                        placeholder="openid email profile..."
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition-all text-xs"
                      />
                    </div>
                    <button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg mt-4 shadow-lg shadow-green-900/20 transition-all active:scale-[0.98]">
                      Add Provider
                    </button>
                  </form>
                </div>

                {/* OAuth Provider List */}
                <div className="lg:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Link2 className="text-green-400" size={20} />
                    Active OAuth Bridges
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {providers.map(p => (
                      <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="bg-green-900/40 text-green-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                              {p.type}
                            </span>
                            <button 
                              onClick={() => handleDeleteProvider(p.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <h3 className="font-bold text-slate-100 mb-1">{p.name}</h3>
                          <p className="text-[10px] text-slate-500 font-mono mb-4 truncate">{p.client_id}</p>
                        </div>
                        
                        <button 
                          onClick={() => handleConnectProvider(p.id)}
                          className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all text-sm font-medium"
                        >
                          <ExternalLink size={14} /> Test Connection
                        </button>
                      </div>
                    ))}
                    {providers.length === 0 && (
                      <div className="col-span-2 text-center py-12 text-slate-500">
                        No OAuth providers configured.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-slate-800 p-12 rounded-2xl border border-slate-700 shadow-xl text-center">
                <ShieldCheck size={48} className="mx-auto text-blue-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Access Granted</h2>
                <p className="text-slate-400">Welcome to the Personal Secretary ecosystem.</p>
              </div>

              {/* User Connection Section */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Link2 className="text-blue-400" size={20} />
                  Connected Services
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {providers.map(p => {
                     const isConnected = userConnections.includes(p.id);
                     return (
                      <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col justify-between group">
                        <div className="flex items-center gap-3 mb-4">
                           <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                              <Link2 size={20} />
                           </div>
                           <div>
                              <div className="font-bold text-slate-200">{p.name}</div>
                              <div className="text-[10px] text-slate-500 uppercase">{p.type}</div>
                           </div>
                        </div>
                        
                        <button 
                          onClick={() => handleConnectProvider(p.id)}
                          className={`w-full py-2 rounded-lg border transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                            isConnected 
                            ? 'bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20' 
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {isConnected ? (
                            <><ShieldCheck size={14} /> Connected</>
                          ) : (
                            <><ExternalLink size={14} /> Connect</>
                          )}
                        </button>
                      </div>
                     )
                   })}
                   {providers.length === 0 && (
                      <p className="text-slate-500 col-span-full text-center py-8">
                        Admin must configure OAuth bridges to allow service connections.
                      </p>
                   )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
        <div className="flex items-center justify-center mb-8">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">Identity Gate</h2>
        <p className="text-slate-400 text-center text-sm mb-8">Unified Authentication Service</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          {!show2FA ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </>
          ) : (
             <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Authenticator Code</label>
                <input 
                  type="text" 
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center tracking-widest text-xl"
                  placeholder="000 000"
                  autoFocus
                />
              </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg mt-4 shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (show2FA ? 'Verify Code' : 'Sign In')}
          </button>

          {!show2FA && (
            <div className="mt-6">
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase tracking-widest font-bold">OR</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>
              
              <button 
                type="button"
                onClick={() => {
                  const baseUrl = window.location.pathname.replace(/\/+$/, '');
                  // Assuming the Google provider ID is known or we find the first one of type 'google'
                  // For a real SSO implementation, we'd have a fixed slug or ID.
                  window.location.href = `${baseUrl}/api/oauth/start/google-sso`; 
                }}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-3 border border-slate-600"
              >
                <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5" alt="Google" />
                Sign in with Google
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default App
