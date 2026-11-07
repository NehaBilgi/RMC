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
  // 1. Session-only user authentication (clears when browser/PWA window closes)
  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      const savedUser = sessionStorage.getItem('concrete360_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // 2. Session-only active site selection (clears when browser/PWA window closes)
  const [selectedSite, setSelectedSite] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('concrete360_selected_site');
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

  // Initialize Supabase Cloud Persistence & Data Synchronization Engine
  useEffect(() => {
    void cloudStorage.init();

    // Check if an existing Supabase session is active
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

  // Persist selected site in sessionStorage & active context
  useEffect(() => {
    try {
      if (selectedSite) {
        sessionStorage.setItem('concrete360_selected_site', selectedSite);
        localStorage.setItem(
          'concrete360_active_site',
          JSON.stringify({
            id: selectedSite,
            name: selectedSite,
            scope: 'G + 3 Floors'
          })
        );
      } else {
        sessionStorage.removeItem('concrete360_selected_site');
        localStorage.removeItem('concrete360_active_site');
      }
    } catch {}
  }, [selectedSite]);

  // Listen for site deletions and switch events
  useEffect(() => {
    const handleSiteSwitch = (e: any) => {
      // Only reset if detail is explicitly an empty string or null (indicating an explicit deletion)
      if (e?.detail === '' || e?.detail === null) {
        setSelectedSite(null);
        sessionStorage.removeItem('concrete360_selected_site');
        localStorage.removeItem('concrete360_active_site');
      } else if (typeof e?.detail === 'string' && e.detail.trim().length > 0) {
        setSelectedSite(e.detail.trim());
      } else {
        // If an update or sync occurred without passing a new site key, retain active site
        const existingSite =
          sessionStorage.getItem('concrete360_selected_site') ||
          localStorage.getItem('concrete360_selected_site');
        if (existingSite) {
          setSelectedSite(existingSite);
        }
      }
    };

    window.addEventListener('concrete360_site_switched', handleSiteSwitch);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSiteSwitch);
    };
  }, []);

  // Sync measurement session storage & dispatch event
  useEffect(() => {
    try {
      localStorage.setItem('concrete360_measurement', JSON.stringify(measurementSession));
      window.dispatchEvent(new CustomEvent('concrete360_measurement_updated', { detail: measurementSession }));
    } catch {}
  }, [measurementSession]);

  // Logout action resets session completely and signs out of Supabase
  const handleLogout = () => {
    sessionStorage.removeItem('concrete360_user');
    sessionStorage.removeItem('concrete360_selected_site');
    localStorage.removeItem('concrete360_active_site');
    if (supabase) {
      void supabase.auth.signOut();
    }
    setUser(null);
    setSelectedSite(null);
  };

  // STEP 1: Always show Login page if no active user session
  if (!user) {
    return (
      <div className={`app-theme ${themeClass}`}>
        <Login
          onLoginSuccess={(loggedInUser) => {
            try {
              sessionStorage.setItem('concrete360_user', JSON.stringify(loggedInUser));
            } catch {}
            setUser(loggedInUser);
          }}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
        />
      </div>
    );
  }

  // STEP 2: Always show Site Selection page after login if no site is active for this session
  if (!selectedSite) {
    return (
      <div className={`app-theme ${themeClass}`}>
        <SiteSelectionPage
          projectType="BUILDING"
          onSelectSite={(siteName) => {
            sessionStorage.setItem('concrete360_selected_site', siteName);
            setSelectedSite(siteName);
            window.dispatchEvent(new CustomEvent('concrete360_site_switched', { detail: siteName }));
          }}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
        />
      </div>
    );
  }

  // STEP 3: Enter main workspace once both user login & site selection are completed
  return (
    <div className={`app-theme ${themeClass} relative min-h-screen font-sans`}>
      <Sidebar
        measurementSession={measurementSession}
        onUpdateMeasurementSession={setMeasurementSession}
        user={user}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
      />
    </div>
  );
}
