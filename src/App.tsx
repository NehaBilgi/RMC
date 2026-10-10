import React, { useState, useEffect } from 'react';
import { SiteMeasurementSession } from './types/rmc';
import { INITIAL_MEASUREMENT_SESSION } from './data/mockData';
import { Sidebar } from './components/construction/Sidebar';
import { Login } from './components/pages/Login';
import { SiteSelectionPage } from './components/pages/SiteSelectionPage';
import { SessionUser } from './utils/accessControl';

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      const savedUser = sessionStorage.getItem('concrete360_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

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

  useEffect(() => {
    try {
      localStorage.setItem('concrete360_theme', theme);
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'light' ? '#F5F7FA' : '#0B0F19');
    } catch {}
  }, [theme]);

  // Persist user in sessionStorage
  useEffect(() => {
    try {
      if (user) {
        sessionStorage.setItem('concrete360_user', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('concrete360_user');
      }
    } catch {}
  }, [user]);

  // Persist active site & dispatch switch event for cross-component sync
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
        window.dispatchEvent(new CustomEvent('concrete360_site_switched', { detail: selectedSite }));
      } else {
        sessionStorage.removeItem('concrete360_selected_site');
      }
    } catch {}
  }, [selectedSite]);

  // Sync measurement session storage & dispatch event
  useEffect(() => {
    try {
      localStorage.setItem('concrete360_measurement', JSON.stringify(measurementSession));
      window.dispatchEvent(new CustomEvent('concrete360_measurement_updated', { detail: measurementSession }));
    } catch {}
  }, [measurementSession]);

  // Handle Logout action
  const handleLogout = () => {
    sessionStorage.removeItem('concrete360_user');
    sessionStorage.removeItem('concrete360_selected_site');
    setUser(null);
    setSelectedSite(null);
  };

  // Step 1: Render Login Page if not logged in
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
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        />
      </div>
    );
  }

  // Step 2: Render Site Selection Page if no site is selected
  if (!selectedSite) {
    return (
      <div className={`app-theme ${themeClass}`}>
        <SiteSelectionPage
          projectType="BUILDING"
          onSelectSite={(siteName) => {
            setSelectedSite(siteName);
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
