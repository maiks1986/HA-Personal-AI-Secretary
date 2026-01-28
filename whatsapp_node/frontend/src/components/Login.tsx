import React from 'react';
import { Lock } from 'lucide-react';

interface LoginProps {
  loginMode: 'direct' | 'ha';
  setLoginMode: (m: 'direct' | 'ha') => void;
  password: string;
  setPassword: (p: string) => void;
  haUrl: string;
  setHaUrl: (u: string) => void;
  haToken: string;
  setHaToken: (t: string) => void;
  handleLogin: (e: React.FormEvent) => void;
}

export const Login: React.FC<LoginProps> = ({
  loginMode,
  setLoginMode,
  password,
  setPassword,
  haUrl,
  setHaUrl,
  haToken,
  setHaToken,
  handleLogin
}) => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-whatsapp-bg">
      <div className="bg-white p-10 rounded-2xl shadow-2xl w-[450px] text-center border-t-8 border-teal-600">
        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={32} className="text-teal-600" /></div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">WhatsApp Pro</h1>
        <div className="flex gap-4 mb-8 justify-center border-b border-slate-100">
          <button onClick={() => setLoginMode('direct')} className={`pb-2 text-sm font-bold transition-all ${loginMode === 'direct' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>Password</button>
          <button onClick={() => setLoginMode('ha')} className={`pb-2 text-sm font-bold transition-all ${loginMode === 'ha' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>Home Assistant</button>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          {loginMode === 'direct' ? (
            <input 
              autoFocus 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Password" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition-all text-center" 
            />
          ) : (
            <>
              <input autoFocus placeholder="HA URL" value={haUrl} onChange={e => setHaUrl(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition-all text-sm" />
              <input type="password" placeholder="Access Token" value={haToken} onChange={e => setHaToken(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition-all text-sm" />
            </>
          )}
          <button type="submit" className="w-full bg-teal-600 text-white p-4 rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98]">
            {loginMode === 'ha' ? 'Login with HA' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
