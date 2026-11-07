import React, { useState } from 'react';
import { 
  HardHat, 
  Lock, 
  User, 
  AlertCircle, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Moon, 
  Sun, 
  CheckCircle2, 
  UserPlus, 
  LogIn 
} from 'lucide-react';
import { SessionUser } from '../../utils/accessControl';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { cloudStorage } from '../../services/cloudStorage';

interface Props {
  onLoginSuccess: (user: SessionUser) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Login: React.FC<Props> = ({ onLoginSuccess, theme, onToggleTheme }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupCompany, setSignupCompany] = useState('BILGI RMC INFRASTRUCTURE');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    const cleanInput = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanInput) {
      setErrorMessage('Please enter your email or username.');
      setIsLoading(false);
      return;
    }

    if (supabase && isSupabaseConfigured) {
      try {
        const isEmail = cleanInput.includes('@');
        let authEmail = cleanInput;

        if (!isEmail) {
          authEmail = `${cleanInput.toLowerCase()}@concrete360.internal`;
        }

        const { data: authResult, error: authError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: cleanPass
        });

        if (!authError && authResult.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authResult.user.id)
            .maybeSingle();

          const role = (profile?.role || 'SUPER_ADMIN') as any;
          const pageAccess = profile?.page_access || null;
          const companyId = profile?.company_id || '00000000-0000-0000-0000-000000000001';

          await cloudStorage.setCompanyId(companyId);
          await cloudStorage.pullFromCloud();

          onLoginSuccess({
            username: profile?.username || cleanInput,
            role,
            name: profile?.username || cleanInput,
            pageAccess: Array.isArray(pageAccess) ? pageAccess : null
          });
          return;
        }
      } catch (err) {
        console.warn('Supabase auth attempt error:', err);
      }
    }

    try {
      const savedUsers = JSON.parse(localStorage.getItem('concrete360_users') || '[]');
      const defaultUsers = [
        {
          id: 'u-1',
          name: 'Habibulla Bilgi',
          username: 'adminbilgi',
          password: '',
          role: 'SUPER_ADMIN',
          active: true,
          expires_at: null
        }
      ];

      const allUsers = [...savedUsers, ...defaultUsers];
      const foundUser = allUsers.find(
        (u: any) =>
          u.username.toLowerCase() === cleanInput.toLowerCase() ||
          (u.email && u.email.toLowerCase() === cleanInput.toLowerCase())
      );

      if (!foundUser) {
        setErrorMessage('Invalid credentials. If you created an account in Supabase, enter your registered email.');
        setIsLoading(false);
        return;
      }

      if (foundUser.active === false) {
        setErrorMessage('This account has been deactivated.');
        setIsLoading(false);
        return;
      }

      if (foundUser.password && foundUser.password !== cleanPass && foundUser.username !== 'adminbilgi') {
        setErrorMessage('Invalid password.');
        setIsLoading(false);
        return;
      }

      void cloudStorage.init();

      onLoginSuccess({
        username: foundUser.username,
        role: foundUser.role || 'SUPER_ADMIN',
        name: foundUser.name || foundUser.username,
        pageAccess: Array.isArray(foundUser.pageAccess) ? foundUser.pageAccess : null
      });
    } catch {
      setErrorMessage('Authentication error occurred.');
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage('Supabase is not configured.');
      setIsLoading(false);
      return;
    }

    const cleanEmail = identifier.trim().toLowerCase();
    const cleanUsername = signupUsername.trim() || cleanEmail.split('@')[0];
    const cleanPass = password.trim();

    if (!cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    if (cleanPass.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPass,
        options: {
          data: {
            username: cleanUsername,
            role: 'SUPER_ADMIN',
            company_name: signupCompany
          }
        }
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      if (data.session && data.user) {
        setSuccessMessage('Account created and signed in successfully!');
        await cloudStorage.init();
        setTimeout(() => {
          onLoginSuccess({
            username: cleanUsername,
            role: 'SUPER_ADMIN',
            name: cleanUsername,
            pageAccess: null
          });
        }, 1000);
      } else {
        setSuccessMessage('Account created! You can now sign in.');
        setMode('signin');
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating account.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-blue-600 selection:text-white relative">
      <button
        onClick={onToggleTheme}
        className="app-header-action absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#1b273d] bg-[#0e1728] text-slate-300 hover:text-white transition cursor-pointer"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-md bg-[#121927] border border-[#1E293B] rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <HardHat className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase mt-2">
            CONCRETE 360
          </h1>
          <p className="text-xs text-blue-400 font-mono">
            Commercial RMC &amp; Site Management Suite
          </p>

          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[10px] font-mono text-slate-400">
              {isSupabaseConfigured ? 'Supabase Database Connected' : 'Local Standalone Mode'}
            </span>
          </div>
        </div>

        <div className="flex p-1 bg-[#0b101c] rounded-xl border border-[#1c2940] text-xs font-mono">
          <button
            type="button"
            onClick={() => { setMode('signin'); setErrorMessage(''); setSuccessMessage(''); }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer font-bold ${
              mode === 'signin' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMessage(''); setSuccessMessage(''); }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer font-bold ${
              mode === 'signup' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Admin</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">
                Email or Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="admin@company.com or adminbilgi"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
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
                  placeholder="Enter password (optional for demo)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 font-mono placeholder-slate-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300 cursor-pointer"
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
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">
                Admin Email *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="admin@yourcompany.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">
                Full Name or Username *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Habibulla Bilgi"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">
                Password * (min 6 characters)
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Set secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">
                Company Name
              </label>
              <input
                type="text"
                value={signupCompany}
                onChange={(e) => setSignupCompany(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider disabled:opacity-50 mt-2"
            >
              <span>{isLoading ? 'Creating Account in Supabase...' : 'Register Official Account'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-[#1E293B] flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Demo User: <strong className="text-slate-200">adminbilgi</strong></span>
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setIdentifier('adminbilgi');
              setPassword('');
            }}
            className="text-blue-400 hover:underline cursor-pointer"
          >
            Auto-fill Demo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
