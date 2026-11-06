import React, { useState, useEffect } from 'react';
import { SiteMeasurementSession } from './types/rmc';
import { INITIAL_MEASUREMENT_SESSION } from './data/mockData';
import { Sidebar } from './components/construction/Sidebar';
import { Login } from './components/pages/Login';
import { SiteSelectionPage } from './components/pages/SiteSelectionPage';
import { SessionUser } from './utils/accessControl';

export default function App() {
  // 1. Persist user in localStorage so closing the window never logs you out
  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      const savedUser = localStorage.getItem('concrete360_user') || sessionStorage.getItem('concrete360_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // 2. Safely restore active site from localStorage
  const [selectedSite, setSelectedSite] = useState<string | null>(() => {
    try {
      const rawSites = localStorage.getItem('concrete360_ongoing_sites') || localStorage.getItem('concrete360_sites');
      const parsedSites = rawSites ? JSON.parse(rawSites) : [];
      
      const savedSelected = localStorage.getItem('concrete360_selected_site') || sessionStorage.getItem('concrete360_selected_site');

      // If a selected site key is saved and sites exist, keep it
      if (savedSelected && Array.isArray(parsedSites) && parsedSites.length > 0) {
        return savedSelected;
      }

      // If sites exist in storage but none is explicitly selected, fall back to the first site
      if (Array.isArray(parsedSites) && parsedSites.length > 0) {
        const firstKey = parsedSites[0].name || parsedSites[0].siteName || parsedSites[0].id;
        return firstKey ? String(firstKey).toUpperCase().trim() : null;
      }

      return null;
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
    try {
      localStorage.setItem('concrete360_theme', theme);
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'light' ? '#F5F7FA' : '#0B0F19');
    } catch {}
  }, [theme]);

  // Persist user in localStorage & sessionStorage
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('concrete360_user', JSON.stringify(user));
        sessionStorage.setItem('concrete360_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('concrete360_user');
        sessionStorage.removeItem('concrete360_user');
      }
    } catch {}
  }, [user]);

  // Persist active site across application restarts
  useEffect(() => {
    try {
      if (selectedSite) {
        localStorage.setItem('concrete360_selected_site', selectedSite);
        sessionStorage.setItem('concrete360_selected_site', selectedSite);
        localStorage.setItem(
          'concrete360_active_site',
          JSON.stringify({
            id: selectedSite,
            name: selectedSite,
            scope: 'G + 3 Floors'
          })
        );
      }
    } catch {}
  }, [selectedSite]);

  // Listen for site deletions and active switch triggers from OngoingSiteTransfer
  useEffect(() => {
    const handleSiteSwitch = (e: any) => {
      const newSiteKey = e?.detail || '';
      if (!newSiteKey) {
        // Site was deleted and list is completely empty -> zero out
        setSelectedSite(null);
        localStorage.removeItem('concrete360_selected_site');
        sessionStorage.removeItem('concrete360_selected_site');
        localStorage.removeItem('concrete360_active_site');
        setMeasurementSession(INITIAL_MEASUREMENT_SESSION);
      } else {
        setSelectedSite(newSiteKey);
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

  // Handle Logout action
  const handleLogout = () => {
    localStorage.removeItem('concrete360_user');
    sessionStorage.removeItem('concrete360_user');
    localStorage.removeItem('concrete360_selected_site');
    sessionStorage.removeItem('concrete360_selected_site');
    localStorage.removeItem('concrete360_active_site');
    setUser(null);
    setSelectedSite(null);
    setMeasurementSession(INITIAL_MEASUREMENT_SESSION);
  };

  // Step 1: Render Login Page if not logged in
  if (!user) {
    return (
      <div className={`app-theme ${themeClass}`}>
        <Login
          onLoginSuccess={(loggedInUser) => {
            try {
              localStorage.setItem('concrete360_user', JSON.stringify(loggedInUser));
              sessionStorage.setItem('concrete360_user', JSON.stringify(loggedInUser));
            } catch {}
            setUser(loggedInUser);
          }}
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        />
      </div>
    );
  }

  // Step 2: Render Site Selection Page ONLY if there are no sites or none selected
  if (!selectedSite) {
    return (
      <div className={`app-theme ${themeClass}`}>
        <SiteSelectionPage
          projectType="BUILDING"
          onSelectSite={(siteName) => {
            setSelectedSite(siteName);
            window.dispatchEvent(new CustomEvent('concrete360_site_switched', { detail: siteName }));
          }}
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        />
      </div>
    );
  }

  // Step 3: Render main workspace with Sidebar and Top Header
  return (
    <div className={`app-theme ${themeClass} relative min-h-screen font-sans`}>
      <Sidebar
        measurementSession={measurementSession}
        onUpdateMeasurementSession={setMeasurementSession}
        user={user}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      />
    </div>
  );
}
