import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  ArrowRight,
  Truck,
  HardHat,
  LogOut,
  ArrowLeft,
  X,
  Moon,
  Sun
} from 'lucide-react';
import { canViewPage } from '../../utils/accessControl';

interface Props {
  projectType?: 'ROAD' | 'BUILDING';
  onSelectSite: (siteName: string) => void;
  onBackToDomainSelect?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

// Helper to normalize site name (e.g. "WW (G + 3 Floors)" -> "WW")
const extractCleanSiteName = (name: string): string => {
  if (!name) return 'MBBILGI';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

export const SiteSelectionPage: React.FC<Props> = ({
  projectType = 'BUILDING',
  onSelectSite,
  onBackToDomainSelect,
  theme,
  onToggleTheme
}) => {
  // Retrieve Active Authenticated User & Normalized Role
  const [currentUser] = useState<{ username: string; role: string; pageAccess?: string[] | null }>(() => {
    try {
      const savedUser = sessionStorage.getItem('concrete360_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const r = String(parsed.role || '').toUpperCase();
        const normalizedRole = (r === 'SUPER_ADMIN' || r === 'ADMIN')
          ? 'ADMIN'
          : (r === 'READ_ONLY' || r === 'AUDITOR')
            ? 'READ_ONLY'
            : 'EMPLOYEE';
        return {
          username: parsed.username || 'adminbilgi',
          role: normalizedRole,
          pageAccess: Array.isArray(parsed.pageAccess) ? parsed.pageAccess : null
        };
      }
    } catch {}
    return { username: 'adminbilgi', role: 'ADMIN' };
  });

  const canCreateSite = (currentUser.role === 'ADMIN' || currentUser.role === 'EMPLOYEE')
    && canViewPage(currentUser, 'ongoing_site');

  // Load registered sites from ongoing site storage + dedicated sites list
  const loadStoredSites = () => {
    try {
      const ongoingRaw = localStorage.getItem('concrete360_ongoing_sites');
      const sitesRaw = localStorage.getItem('concrete360_sites');

      let combined: any[] = [];
      if (ongoingRaw) {
        const parsed = JSON.parse(ongoingRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          combined = parsed.map((s: any, idx: number) => ({
            siteId: s.id || `S-0${idx + 1}`,
            siteName: s.name || s.siteName,
            location: s.location || s.address || 'Ainapur Site',
            vehicles: s.vehicles || [1, 2, 3, 4],
            projectType: s.projectType || 'BUILDING',
            buildingFloors: s.structureScope || s.scope || s.buildingFloors || 'G + 3 Floors'
          }));
        }
      }

      if (combined.length === 0 && sitesRaw) {
        const parsed = JSON.parse(sitesRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          combined = parsed;
        }
      }

      if (combined.length > 0) {
        return combined;
      }
    } catch {}

    return [
      { siteId: 'S-01', siteName: 'MBBILGI', location: 'Ainapur', vehicles: [1, 2, 3, 4], projectType: 'BUILDING', buildingFloors: 'G + 3 Floors' },
      { siteId: 'S-02', siteName: 'WW', location: 'Tikota Road', vehicles: [1, 2, 3, 4], projectType: 'BUILDING', buildingFloors: 'G + 3 Floors' }
    ];
  };

  const [sites, setSites] = useState<any[]>(loadStoredSites);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [buildingFloors, setBuildingFloors] = useState<string>('G + 3 Floors');

  useEffect(() => {
    const handleSync = () => setSites(loadStoredSites());
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const filteredSites = useMemo(() => {
    return sites.filter((site: any) => {
      if (site.projectType) {
        return site.projectType === projectType;
      }
      return true;
    });
  }, [sites, projectType]);

  // Centralized site launcher handler to store session & local storage state cleanly
  const handleLaunchSite = (site: any) => {
    const rawName = String(site.siteName || site.name || '').trim();
    const cleanKey = extractCleanSiteName(rawName);
    const siteScope = site.buildingFloors || site.structureScope || 'G + 3 Floors';
    const siteLocation = site.location || site.address || 'Ainapur Site';

    try {
      // 1. Write clean site key for storage lookup
      sessionStorage.setItem('concrete360_selected_site', cleanKey);
      localStorage.setItem(
        'concrete360_active_site',
        JSON.stringify({
          id: site.siteId || cleanKey,
          name: cleanKey,
          displayName: rawName,
          scope: siteScope,
          location: siteLocation
        })
      );

      // 2. Broadcast site switch event across the application
      window.dispatchEvent(new CustomEvent('concrete360_site_switched', { detail: cleanKey }));
    } catch {}

    onSelectSite(cleanKey);
  };

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateSite) {
      alert('Permission Denied: Read-Only accounts cannot create new building sites.');
      return;
    }
    if (!newSiteName.trim()) return;

    const rawInput = newSiteName.trim().toUpperCase();
    const cleanKey = extractCleanSiteName(rawInput);
    const loc = newLocation.trim() || 'Ainapur Site';

    const newSite = {
      siteId: `S-0${sites.length + 1}`,
      siteName: cleanKey,
      location: loc,
      vehicles: [1, 2, 3, 4],
      projectType: projectType,
      buildingFloors: buildingFloors || 'G + 3 Floors'
    };

    const updated = [newSite, ...sites];
    setSites(updated);

    try {
      localStorage.setItem('concrete360_sites', JSON.stringify(updated));

      // Also register into ongoing sites list to ensure cross-module parity
      const ongoingRaw = localStorage.getItem('concrete360_ongoing_sites');
      const ongoingArr = ongoingRaw ? JSON.parse(ongoingRaw) : [];
      if (!ongoingArr.some((s: any) => extractCleanSiteName(s.name || s.siteName) === cleanKey)) {
        ongoingArr.unshift({
          id: cleanKey,
          name: cleanKey,
          location: loc,
          structureScope: buildingFloors || 'G + 3 Floors',
          client: cleanKey,
          supervisor: currentUser.username,
          projectType: 'BUILDING'
        });
        localStorage.setItem('concrete360_ongoing_sites', JSON.stringify(ongoingArr));
      }
    } catch {}

    setIsAddModalOpen(false);
    setNewSiteName('');
    setNewLocation('');
    
    // Automatically launch the newly created site
    handleLaunchSite(newSite);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('concrete360_user');
      localStorage.removeItem('concrete360_selected_site');
      sessionStorage.removeItem('concrete360_user');
      sessionStorage.removeItem('concrete360_selected_site');
    } catch {}
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full bg-[#080C14] text-slate-100 flex flex-col justify-between p-6 sm:p-10 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-6 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800">
                BILGI RMC Mode
              </span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase mt-0.5">
              CONCRETE 360
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="app-header-action inline-flex items-center justify-center w-9 h-9 rounded-xl border border-[#1b273d] bg-[#121927] text-slate-300 hover:text-white transition"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          {onBackToDomainSelect && (
            <button
              onClick={onBackToDomainSelect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121927] hover:bg-[#1c273d] border border-[#1E293B] text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Switch Domain</span>
            </button>
          )}

          <div className="hidden sm:block text-right">
            <div className="text-xs font-bold text-white">{currentUser.username}</div>
            <div className="text-[11px] text-blue-400 font-mono uppercase">{currentUser.role}</div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121927] hover:bg-rose-950/40 border border-[#1E293B] text-slate-400 hover:text-rose-400 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Selection Area */}
      <div className="max-w-5xl w-full mx-auto my-auto py-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Select Active Building Project
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Choose an active tower or campus construction site to track structural components, concrete, and site expenses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSites.map((site: any) => {
            const cleanName = extractCleanSiteName(site.siteName);
            return (
              <div
                key={site.siteId}
                onClick={() => handleLaunchSite(site)}
                className="p-5 rounded-3xl bg-[#0c1427] border border-[#182643] hover:border-blue-500/60 hover:bg-[#111c36] transition-all cursor-pointer group shadow-xl flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        Building Site
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-[#080d19] px-2 py-0.5 rounded-md border border-[#182643]">
                      {site.siteId}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white group-hover:text-blue-300 transition-colors line-clamp-2">
                    {cleanName}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Scope: {site.buildingFloors || 'G + 3 Floors'}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#182643] flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                    {site.vehicles?.length || 4} Assigned Units
                  </span>
                  <span className="text-blue-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Launch Site</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {canCreateSite && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="p-5 rounded-3xl border-2 border-dashed border-[#1E293B] hover:border-blue-500/50 bg-[#0c1427]/30 hover:bg-[#0c1427] transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 min-h-[140px] group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 group-hover:bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-300 group-hover:text-white">
                + Add New Building Site
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#1E293B] pt-4 text-center text-[11px] text-slate-500 font-mono">
        Secured Building Infrastructure Telematics
      </div>

      {/* Create Site Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#121927] border border-[#1E293B] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span>Create Building Construction Project</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Building / Tower Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WW or FATIMA COMPLEX"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 uppercase font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Location / Zone</label>
                <input
                  type="text"
                  placeholder="e.g. Tikota Road / Ainapur"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Building Structure / Floor Scope</label>
                <input
                  type="text"
                  value={buildingFloors}
                  onChange={(e) => setBuildingFloors(e.target.value)}
                  placeholder="e.g. G + 3 Floors"
                  className="w-full px-3.5 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  Create &amp; Launch Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteSelectionPage;
