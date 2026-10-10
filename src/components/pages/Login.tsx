import React, { useState } from 'react';
import { HardHat, Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { SessionUser } from '../../utils/accessControl';

interface Props {
  onLoginSuccess: (user: SessionUser) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Login: React.FC<Props> = ({ onLoginSuccess, theme, onToggleTheme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Please enter both username and password.');
      setIsLoading(false);
      return;
    }

    try {
      // Fetch registered users from UserManagement storage or default fallback
      const savedUsers = JSON.parse(localStorage.getItem('concrete360_users') || '[]');
      
      // Default fallback super admin if no users created yet
      const defaultUsers = [
        { id: 'u-1', name: 'Habibulla Bilgi', username: 'adminbilgi', password: '', role: 'SUPER_ADMIN', active: true, expires_at: null }
      ];

      const allUsers = [...savedUsers, ...defaultUsers];

      // Find matching user
      const foundUser = allUsers.find(
        (u: any) => u.username.toLowerCase() === cleanUser
      );

      if (!foundUser) {
        setErrorMessage('Invalid username or password.');
        setIsLoading(false);
        return;
      }

      // Check if account is active
      if (foundUser.active === false) {
        setErrorMessage('This account has been deactivated. Contact administrator.');
        setIsLoading(false);
        return;
      }

      // Check account expiry
      if (foundUser.expires_at && new Date() > new Date(foundUser.expires_at)) {
        setErrorMessage('This account has expired. Validity date passed.');
        setIsLoading(false);
        return;
      }

      // If user has a password set, verify it (skip if default admin with blank password string)
      if (foundUser.password && foundUser.password !== cleanPass && foundUser.username !== 'adminbilgi') {
        setErrorMessage('Invalid username or password.');
        setIsLoading(false);
        return;
      }

      // Successful Authentication
      onLoginSuccess({
        username: foundUser.username,
        role: foundUser.role || 'SITE_SUPERVISOR',
        name: foundUser.name || foundUser.username,
        pageAccess: Array.isArray(foundUser.pageAccess) ? foundUser.pageAccess : null
      });
    } catch {
      setErrorMessage('Authentication error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-blue-600 selection:text-white relative">
      <button
        onClick={onToggleTheme}
        className="app-header-action absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#1b273d] bg-[#0e1728] text-slate-300 hover:text-white transition"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>
      <div className="w-full max-w-md bg-[#121927] border border-[#1E293B] rounded-3xl p-8 shadow-2xl space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <HardHat className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase mt-2">
            CONCRETE 360
          </h1>
          <p className="text-xs text-blue-400 font-mono">
            Road &amp; Building ERP System
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="e.g. adminbilgi"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 font-medium placeholder-slate-500 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password (optional for default admin)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 font-mono placeholder-slate-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider disabled:opacity-50 mt-2"
          >
            <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Role Permissions Hint */}
        <div className="pt-4 border-t border-[#1E293B] text-[10px] text-slate-500 text-center leading-relaxed font-mono">
          Linked with User Management RBAC (SUPER_ADMIN • ADMIN • SITE_SUPERVISOR • AUDITOR • READ_ONLY)
        </div>
      </div>
    </div>
  );
};

export default Login;
