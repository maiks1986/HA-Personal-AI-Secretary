import { useState } from 'react'
import axios from 'axios'
import { KeyRound, Loader2 } from 'lucide-react'
import type { User, LoginResponse } from '@/types/shared_schemas'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [show2FA, setShow2FA] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await axios.post<LoginResponse>('/api/auth/login', { 
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
      // If 2FA fails, maybe reset code?
      if (show2FA) setTotpCode('')
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-lg shadow-xl text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome, {user.username}!</h1>
          <p className="text-slate-400">You are logged in as {user.role}.</p>
          {user.is_totp_enabled && (
             <span className="inline-block bg-green-900 text-green-300 text-xs px-2 py-1 rounded mt-2">2FA Enabled</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-lg shadow-xl border border-slate-700">
        <div className="flex items-center justify-center mb-8">
          <div className="p-3 bg-blue-600 rounded-full">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-6">Identity Gate</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          {!show2FA ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
            </>
          ) : (
             <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Authenticator Code</label>
                <input 
                  type="text" 
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-center tracking-widest text-xl"
                  placeholder="000 000"
                  autoFocus
                />
              </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-2 rounded">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (show2FA ? 'Verify Code' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
