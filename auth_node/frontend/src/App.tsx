import { useState, useEffect } from 'react'
import axios from 'axios'
import { KeyRound, Loader2, Users, UserPlus, Trash2, LogOut, ShieldCheck } from 'lucide-react'
import type { User, LoginResponse } from '@/types/shared_schemas'

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

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers()
    }
  }, [user])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const baseUrl = window.location.pathname.replace(/\/+$/, '');
    const apiUrl = `${baseUrl}/api/auth/login`;

    try {
      const res = await axios.post<LoginResponse>(apiUrl, { 
        username, 
        password,
        totp_code: show2FA ? totpCode : undefined
      })
      
      if (res.data.success && res.data.user) {
        setUser(res.data.user)
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
          ) : (
            <div className="bg-slate-800 p-12 rounded-2xl border border-slate-700 shadow-xl text-center">
              <ShieldCheck size={48} className="mx-auto text-blue-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Access Granted</h2>
              <p className="text-slate-400">Welcome to the Personal Secretary ecosystem.</p>
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
        </form>
      </div>
    </div>
  )
}

export default App
