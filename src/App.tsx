import React, { useState, useEffect } from 'react';
import { SiteMeasurementSession } from './types/rmc';
import { INITIAL_MEASUREMENT_SESSION } from './data/mockData';
import { Sidebar } from './components/construction/Sidebar';
import { Login } from './components/pages/Login';
import { SiteSelectionPage } from './components/pages/SiteSelectionPage';
import { SessionUser } from './utils/accessControl';
import { cloudStorage } from './services/cloudStorage';
import { supabase } from './lib/supabase';

export default function App() {
  // 1. User authentication state
  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      const savedUser = sessionStorage.getItem('concrete360_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // 2. Active site selection (Strictly null on fresh login until chosen)
  const [selectedSite, setSelectedSite] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('concrete360_selected_site') || null;
    } catch {
      return null;
    }
  });

  const [measurementSession, setMeasurementSession] = useState<SiteMeasurementSession>(() => {
    try {
      const saved = localStorage.getItem('concrete360_measurement');
      return saved ? JSON.parse(saved) : INITIAL_MEASUREMENT_SESSION;
    } catch {
      return INITIAL_MEASUREMENT_SESSION;
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('concrete360_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const themeClass = theme === 'light' ? 'theme-light' : 'theme-dark';

  useEffect(() => {
    void cloudStorage.init();

    if (supabase) {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user && !user) {
          const email = data.session.user.email || '';
          const metaUsername = data.session.user.user_metadata?.username;
          const metaRole = data.session.user.user_metadata?.role || 'SUPER_ADMIN';

          const sessionUser: SessionUser = {
            username: metaUsername || email.split('@')[0] || 'admin',
            role: metaRole,
            name: metaUsername || email,
            pageAccess: null
          };
          setUser(sessionUser);
          sessionStorage.setItem('concrete360_user', JSON.stringify(sessionUser));
        }
      });
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('concrete360_theme', theme);
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'light' ? '#F5F7FA' : '#0B0F19');
    } catch {}
  }, [theme]);

  // Persist session user in sessionStorage only
  useEffect(() => {
    try {
      if (user) {
        sessionStorage.setItem('concrete360_user', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('concrete360_user');
      }
    } catch {}
  }, [user]);

  // Persist selected site in sessionStorage
  useEffect(() => {
    try {
      if (selectedSite) {
        sessionStorage.setItem('concrete360_selected_site', selectedSite);
      } else {
        sessionStorage.removeItem('concrete360_selected_site');
        localStorage.removeItem('concrete360_active_site');
        localStorage.removeItem('concrete360_selected_site');
      }
    } catch {}
  }, [selectedSite]);

  // Listen strictly to explicit site change actions
  useEffect(() => {
    const handleSiteSwitch = (e: any) => {
      if (typeof e?.detail === 'string' && e.detail.trim().length > 0) {
        setSelectedSite(e.detail.trim());
      } else if (e?.detail === null || e?.detail === '') {
        setSelectedSite(null);
        sessionStorage.removeItem('concrete360_selected_site');
        localStorage.removeItem('concrete360_active_site');
        localStorage.removeItem('concrete360_selected_site');
      }
    };

    window.addEventListener('concrete360_site_switched', handleSiteSwitch);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSiteSwitch);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('concrete360_measurement', JSON.stringify(measurementSession));
      window.dispatchEvent(new CustomEvent('concrete360_measurement_updated', { detail: measurementSession }));
    } catch {}
  }, [measurementSession]);

  const handleSwitchSite = () => {
    sessionStorage.removeItem('concrete360_selected_site');
    localStorage.removeItem('concrete360_active_site');
    localStorage.removeItem('concrete360_selected_site');
    setSelectedSite(null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('concrete360_user');
    sessionStorage.removeItem('concrete360_selected_site');
    localStorage.removeItem('concrete360_active_site');
    localStorage.removeItem('concrete360_selected_site');
    if (supabase) {
      void supabase.auth.signOut();
    }
    setUser(null);
    setSelectedSite(null);
  };

  // 1. Not logged in -> Show Login
  if (!user) {
    return (
      <div className={`app-theme ${themeClass}`}>
        <Login
          onLoginSuccess={(loggedInUser) => {
            try {
              sessionStorage.setItem('concrete360_user', JSON.stringify(loggedInUser));
              // Clear cached site to ensure fresh routing directly to the creation / site selection modal
              sessionStorage.removeItem('concrete360_selected_site');
              localStorage.removeItem('concrete360_active_site');
              localStorage.removeItem('concrete360_selected_site');
            } catch {}
            setUser(loggedInUser);
            setSelectedSite(null);
          }}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
        />
      </div>
    );
  }

  // 2. Logged in, site not chosen -> Show Site Selection with the modal directly open
  if (!selectedSite) {
    return (
      <div className={`app-theme ${themeClass}`}>
        <SiteSelectionPage
          projectType="ALL"
          onSelectSite={(siteName) => {
            sessionStorage.setItem('concrete360_selected_site', siteName);
            setSelectedSite(siteName);
          }}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
        />
      </div>
    );
  }

  // 3. User logged in & site explicitly selected -> Open Workspace
  return (
    <div className={`app-theme ${themeClass} relative min-h-screen font-sans`}>
      <Sidebar
        measurementSession={measurementSession}
        onUpdateMeasurementSession={setMeasurementSession}
        user={user}
        onLogout={handleLogout}
        onSwitchSite={handleSwitchSite}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
      />
    </div>
  );
}
