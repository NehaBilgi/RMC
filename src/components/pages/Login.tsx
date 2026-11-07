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
  Database, 
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

  // Direct Supabase Sign In with Multi-tier Cloud & Local Fallback
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

    // 1. Authoritative: Direct Check on Dedicated Supabase app_users table
    if (supabase && isSupabaseConfigured) {
      try {
        const { data: dbUser, error: dbErr } = await (supabase as any)
          .from('app_users')
          .select('*')
          .ilike('username', cleanInput)
          .maybeSingle();

        if (!dbErr && dbUser) {
          if (dbUser.active === false) {
            setErrorMessage('This account has been deactivated. Contact administrator.');
            setIsLoading(false);
            return;
          }

          if (dbUser.expires_at && new Date() > new Date(dbUser.expires_at)) {
            setErrorMessage('This account has expired. Validity date passed.');
            setIsLoading(false);
            return;
          }

          const expectedPass = dbUser.password || '';
          if (expectedPass && expectedPass !== cleanPass && dbUser.username !== 'adminbilgi') {
            setErrorMessage('Invalid password.');
            setIsLoading(false);
            return;
          }

          const role = dbUser.role === 'SUPER_ADMIN' ? 'ADMIN' : (dbUser.role || 'EMPLOYEE');
          const pageAccess = Array.isArray(dbUser.page_access) ? dbUser.page_access : null;

          const sessionUser: SessionUser = {
            username: dbUser.username,
            role,
            name: dbUser.name || dbUser.username,
            pageAccess
          };

          sessionStorage.setItem('concrete360_user', JSON.stringify(sessionUser));
          await cloudStorage.pullFromCloud();
          onLoginSuccess(sessionUser);
          return;
        }
      } catch (err) {
        console.warn('Supabase app_users auth check error:', err);
      }
    }

    // 2. Auxiliary Cloud Store: Check app_data_store backup
    if (supabase && isSupabaseConfigured) {
      try {
        const { data: storeRow } = await (supabase as any)
          .from('app_data_store')
          .select('data')
          .eq('storage_key', 'concrete360_users')
          .maybeSingle();

        if (storeRow?.data && Array.isArray(storeRow.data)) {
          const match = storeRow.data.find(
            (u: any) => String(u.username || '').toLowerCase() === cleanInput.toLowerCase()
          );
          if (match) {
            if (match.active === false) {
              setErrorMessage('This account has been deactivated. Contact administrator.');
              setIsLoading(false);
              return;
            }

            if (match.expires_at && new Date() > new Date(match.expires_at)) {
              setErrorMessage('This account has expired. Validity date passed.');
              setIsLoading(false);
              return;
            }

            const matchPass = match.password || '';
            if (matchPass && matchPass !== cleanPass && match.username !== 'adminbilgi') {
              setErrorMessage('Invalid password.');
              setIsLoading(false);
              return;
            }

            const role = match.role === 'SUPER_ADMIN' ? 'ADMIN' : (match.role || 'EMPLOYEE');
            const pageAccess = Array.isArray(match.pageAccess)
              ? match.pageAccess
              : (Array.isArray(match.page_access) ? match.page_access : null);

            const sessionUser: SessionUser = {
              username: match.username,
              role,
              name: match.name || match.username,
              pageAccess
            };

            sessionStorage.setItem('concrete360_user', JSON.stringify(sessionUser));
            await cloudStorage.pullFromCloud();
            onLoginSuccess(sessionUser);
            return;
          }
        }
      } catch (err) {
        console.warn('Supabase app_data_store backup lookup warning:', err);
      }
    }

    // 3. Supabase Auth (for users registered via official Supabase email signup)
    if (supabase && isSupabaseConfigured && cleanInput.includes('@')) {
      try {
        const { data: authResult, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanInput,
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

          await cloudStorage.pullFromCloud();

          const sessionUser: SessionUser = {
            username: profile?.username || cleanInput.split('@')[0],
            role,
            name: profile?.username || cleanInput,
            pageAccess: Array.isArray(pageAccess) ? pageAccess : null
          };

          sessionStorage.setItem('concrete360_user', JSON.stringify(sessionUser));
          onLoginSuccess(sessionUser);
          return;
        }
      } catch (err) {
        console.warn('Supabase auth attempt error:', err);
      }
    }

    // 4. Fallback to Local Storage Accounts or Default Administrator
    try {
      const savedUsers = JSON.parse(localStorage.getItem('concrete360_users') || '[]');
      const defaultUsers = [
        {
          id: 'u-adminbilgi',
          name: 'adminbilgi',
          username: 'adminbilgi',
          password: '',
          role: 'ADMIN',
          active: true,
          expires_at: null
        }
      ];

      const allUsers = [...savedUsers, ...defaultUsers];
      const foundUser = allUsers.find(
        (u: any) =>
          String(u.username || '').toLowerCase() === cleanInput.toLowerCase() ||
          (u.email && String(u.email || '').toLowerCase() === cleanInput.toLowerCase())
      );

      if (!foundUser) {
        setErrorMessage('Invalid username or password.');
        setIsLoading(false);
        return;
      }

      if (foundUser.active === false) {
        setErrorMessage('This account has been deactivated. Contact administrator.');
        setIsLoading(false);
        return;
      }

      if (foundUser.expires_at && new Date() > new Date(foundUser.expires_at)) {
        setErrorMessage('This account has expired. Validity date passed.');
        setIsLoading(false);
        return;
      }

      if (foundUser.password && foundUser.password !== cleanPass && foundUser.username !== 'adminbilgi') {
        setErrorMessage('Invalid password.');
        setIsLoading(false);
        return;
      }

      const sessionUser: SessionUser = {
        username: foundUser.username,
        role: foundUser.role || 'ADMIN',
        name: foundUser.name || foundUser.username,
        pageAccess: Array.isArray(foundUser.pageAccess) ? foundUser.pageAccess : null
      };

      sessionStorage.setItem('concrete360_user', JSON.stringify(sessionUser));
      void cloudStorage.init();
      onLoginSuccess(sessionUser);
    } catch {
      setErrorMessage('Authentication error occurred.');
      setIsLoading(false);
    }
  };

  // Direct Supabase Sign Up / New Admin Creation
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel / .env environment.');
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
        try {
          await (supabase as any).from('app_users').upsert({
            id: data.user.id,
            username: cleanUsername,
            name: cleanUsername,
            password: cleanPass,
            role: 'ADMIN',
            page_access: [
              'dashboard', 'ongoing_site', 'billing', 'total_bill', 'site_tests', 'trips',
              'material_category', 'transit_mixer', 'concrete_pumps', 'mix_design',
              'site_report', 'measurements', 'company_details', 'user_management'
            ],
            active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'username' });
        } catch {}

        await cloudStorage.init();
        setTimeout(() => {
          onLoginSuccess({
            username: cleanUsername,
            role: 'ADMIN',
            name: cleanUsername,
            pageAccess: null
          });
        }, 1000);
      } else {
        setSuccessMessage('Account created! If email confirmation is enabled in Supabase, check your inbox to confirm, then sign in.');
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
            Commercial RMC &amp; Site Management Suite
          </p>

          {/* Cloud Database Status Pill */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[10px] font-mono text-slate-400">
              {isSupabaseConfigured ? 'Supabase Database Connected' : 'Local Standalone Mode'}
            </span>
          </div>
        </div>

        {/* Tab Switcher: Sign In vs Register Admin */}
        <div className="flex p-1 bg-[#0b101c] rounded-xl border border-[#1c2940] text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer font-bold ${
              mode === 'signin' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer font-bold ${
              mode === 'signup' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Admin</span>
          </button>
        </div>

        {/* Status Alerts */}
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

        {/* SIGN IN FORM */}
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

        {/* SIGN UP / REGISTER ADMIN FORM */}
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

        {/* Demo Mode Quick Access */}
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
