import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  ArrowRight,
  Truck,
  HardHat,
  LogOut,
  X,
  Moon,
  Sun,
  RefreshCw,
  Road
} from 'lucide-react';
import { canViewPage } from '../../utils/accessControl';
import { cloudStorage } from '../../services/cloudStorage';
import { supabase } from '../../lib/supabase';

interface Props {
  projectType?: 'ROAD' | 'BUILDING' | 'ALL';
  onSelectSite: (siteName: string) => void;
  onBackToDomainSelect?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const extractCleanSiteName = (name: string): string => {
  if (!name) return '';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

export const SiteSelectionPage: React.FC<Props> = ({
  projectType = 'ALL',
  onSelectSite,
  theme,
  onToggleTheme
}) => {
  const [currentUser] = useState<{ username: string; role: string; pageAccess?: string[] | null }>(() => {
    try {
      const savedUser = sessionStorage.getItem('concrete360_user') || localStorage.getItem('concrete360_user');
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

  const loadStoredSites = (): any[] => {
    try {
      const ongoingRaw = localStorage.getItem('concrete360_ongoing_sites');
      const sitesRaw = localStorage.getItem('concrete360_sites');

      let combined: any[] = [];
      const sourceList = ongoingRaw ? JSON.parse(ongoingRaw) : (sitesRaw ? JSON.parse(sitesRaw) : []);

      if (Array.isArray(sourceList)) {
        combined = sourceList.map((s: any, idx: number) => {
          const rawCat = s.category ? String(s.category).toUpperCase() : (s.projectType ? String(s.projectType).toUpperCase() : 'BUILDING');
          const isRoad = rawCat.includes('ROAD');
          return {
            siteId: s.siteId || s.id || `S-0${idx + 1}`,
            siteName: s.name || s.siteName,
            location: s.location || s.address || (isRoad ? 'Highway Corridor' : 'Ainapur Site'),
            vehicles: s.vehicles || s.assignedFleet || [1, 2, 3, 4],
            projectType: isRoad ? 'ROAD' : 'BUILDING',
            buildingFloors: s.detail || s.structureScope || s.scope || s.buildingFloors || (isRoad ? 'Km 0 to 12.5' : 'G + 3 Floors'),
            chainageRange: s.chainageRange || 'Km 0 to 12.5',
            supervisor: s.supervisor || currentUser.username
          };
        });
      }

      return combined;
    } catch {}
    return [];
  };

  const [sites, setSites] = useState<any[]>(loadStoredSites);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'BUILDING' | 'ROAD'>(projectType);

  // Directly opens the "Create New Site Corridor" dialog upon landing
  const [isAddModalOpen, setIsAddModalOpen] = useState(true);

  const [newSiteName, setNewSiteName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState<'BUILDING' | 'ROAD'>('BUILDING');
  const [buildingFloors, setBuildingFloors] = useState<string>('G + 3 Floors');

  useEffect(() => {
    void cloudStorage.pullFromCloud();
    const handleSync = () => setSites(loadStoredSites());
    window.addEventListener('storage', handleSync);
    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('concrete360_cloud_synced', handleSync);
    window.addEventListener('concrete360_remote_update', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('concrete360_cloud_synced', handleSync);
      window.removeEventListener('concrete360_remote_update', handleSync);
    };
  }, []);

  const filteredSites = useMemo(() => {
    if (selectedTypeFilter === 'ALL') return sites;
    return sites.filter((site: any) => site.projectType === selectedTypeFilter);
  }, [sites, selectedTypeFilter]);

  const handleLaunchSite = (site: any) => {
    const rawName = String(site.siteName || site.name || '').trim();
    const cleanKey = extractCleanSiteName(rawName);
    const siteScope = site.buildingFloors || site.structureScope || 'G + 3 Floors';
    const siteLocation = site.location || site.address || 'Ainapur Site';

    try {
      localStorage.setItem('concrete360_selected_site', cleanKey);
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

      // Explicitly set the landing tab to Dashboard
      localStorage.setItem('concrete360_active_tab', 'dashboard');
      sessionStorage.setItem('concrete360_active_tab', 'dashboard');

      window.dispatchEvent(new CustomEvent('concrete360_site_switched', { detail: cleanKey }));
    } catch {}

    onSelectSite(cleanKey);
  };

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateSite) {
      alert('Permission Denied: Read-Only accounts cannot create new sites.');
      return;
    }
    if (!newSiteName.trim()) return;

    const rawInput = newSiteName.trim().toUpperCase();
    const cleanKey = extractCleanSiteName(rawInput);
    const loc = newLocation.trim() || (newCategory === 'ROAD' ? 'Highway Corridor' : 'Ainapur Site');
    const currentList = loadStoredSites();

    const newSite = {
      siteId: `S-0${currentList.length + 1}`,
      siteName: cleanKey,
      location: loc,
      vehicles: [1, 2, 3, 4],
      projectType: newCategory,
      buildingFloors: buildingFloors || (newCategory === 'ROAD' ? 'Km 0 to 12.5' : 'G + 3 Floors'),
      supervisor: currentUser.username
    };

    const updated = [newSite, ...currentList];
    setSites(updated);

    try {
      const ongoingRaw = localStorage.getItem('concrete360_ongoing_sites');
      const ongoingArr = ongoingRaw ? JSON.parse(ongoingRaw) : [];
      const newOngoingEntry = {
        id: `site-${Date.now()}`,
        siteId: `S-0${ongoingArr.length + 1}`,
        category: newCategory === 'ROAD' ? 'Road' : 'Building',
        name: cleanKey,
        siteName: cleanKey,
        location: loc,
        supervisor: currentUser.username || 'adminbilgi',
        clientName: cleanKey,
        gstin: '29UNREGISTERED',
        detail: newSite.buildingFloors,
        assignedFleet: 4
      };

      const finalOngoing = [newOngoingEntry, ...ongoingArr.filter((s: any) => extractCleanSiteName(s.name || s.siteName) !== cleanKey)];
      localStorage.setItem('concrete360_ongoing_sites', JSON.stringify(finalOngoing));
      localStorage.setItem('concrete360_sites', JSON.stringify(finalOngoing));

      if (supabase) {
        void (supabase as any)
          .from('sites')
          .upsert({
            id: cleanKey,
            site_id: newOngoingEntry.siteId,
            name: cleanKey,
            site_name: cleanKey,
            category: newCategory === 'ROAD' ? 'Road' : 'Building',
            location: loc,
            supervisor: currentUser.username || 'adminbilgi',
            client_name: cleanKey,
            gstin: '29UNREGISTERED',
            scope: newSite.buildingFloors,
            assigned_fleet: 4,
            status: 'active',
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
          .then(() => void cloudStorage.pullFromCloud());
      }
    } catch {}

    setIsAddModalOpen(false);
    setNewSiteName('');
    setNewLocation('');
    
    handleLaunchSite(newSite);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('concrete360_user');
      localStorage.removeItem('concrete360_selected_site');
      localStorage.removeItem('concrete360_active_site');
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
            type="button"
            onClick={async () => {
              await cloudStorage.pushAllLocalToCloud();
              await cloudStorage.pullFromCloud();
              setSites(loadStoredSites());
            }}
            className="app-header-action inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#1b273d] bg-[#121927] text-slate-300 hover:text-emerald-400 text-xs font-mono transition cursor-pointer"
            title="Refresh & sync with Supabase cloud database"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Sync Cloud</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="app-header-action inline-flex items-center justify-center w-9 h-9 rounded-xl border border-[#1b273d] bg-[#121927] text-slate-300 hover:text-white transition cursor-pointer"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <div className="hidden sm:block text-right">
            <div className="text-xs font-bold text-white">{currentUser.username}</div>
            <div className="text-[11px] text-blue-400 font-mono uppercase">{currentUser.role}</div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121927] hover:bg-rose-950/40 border border-[#1E293B] text-slate-400 hover:text-rose-400 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Selection Area */}
      <div className="max-w-5xl w-full mx-auto my-auto py-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Select Active Construction Site
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Choose an ongoing building or road site corridor to open the telemetry and inventory management suite.
          </p>

          {/* Filter Pills */}
          <div className="inline-flex p-1 bg-[#121927] border border-[#1E293B] rounded-xl text-xs font-mono mt-3">
            <button
              onClick={() => setSelectedTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                selectedTypeFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Projects ({sites.length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter('BUILDING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                selectedTypeFilter === 'BUILDING' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Building Sites
            </button>
            <button
              onClick={() => setSelectedTypeFilter('ROAD')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                selectedTypeFilter === 'ROAD' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Road Corridors
            </button>
          </div>
        </div>

        {filteredSites.length === 0 ? (
          <div className="p-8 rounded-3xl bg-[#0c1427] border border-[#182643] text-center space-y-4 max-w-md mx-auto">
            <p className="text-slate-400 text-xs font-mono">No active projects found. Create a site to proceed.</p>
            {canCreateSite && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 cursor-pointer transition active:scale-95"
              >
                + Add Project Corridor
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSites.map((site: any) => {
              const cleanName = extractCleanSiteName(site.siteName);
              const isRoad = site.projectType === 'ROAD';
              return (
                <div
                  key={site.siteId}
                  onClick={() => handleLaunchSite(site)}
                  className="p-5 rounded-3xl bg-[#0c1427] border border-[#182643] hover:border-blue-500/60 hover:bg-[#111c36] transition-all cursor-pointer group shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isRoad ? 'bg-sky-400' : 'bg-emerald-400'} animate-pulse`} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {isRoad ? 'Road Site' : 'Building Site'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-[#080d19] px-2 py-0.5 rounded-md border border-[#182643]">
                        {site.siteId}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                      {cleanName}
                    </h3>
                    <p className="text-xs text-slate-300 font-mono">
                      {site.location}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Scope: <strong className={isRoad ? 'text-sky-400' : 'text-emerald-400'}>{site.buildingFloors}</strong>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#182643] flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-medium">
                      <Truck className="w-3.5 h-3.5 text-blue-400" />
                      {Array.isArray(site.vehicles) ? site.vehicles.length : 4} Assigned Units
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
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="p-5 rounded-3xl border-2 border-dashed border-[#1E293B] hover:border-blue-500/50 bg-[#0c1427]/30 hover:bg-[#0c1427] transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 min-h-[140px] group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 group-hover:bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-300 group-hover:text-white">
                  + Add Ongoing Site Section
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1E293B] pt-4 text-center text-[11px] text-slate-500 font-mono">
        CONCRETE 360 • Bilgi RMC Field ERP
      </div>

      {/* Create Site Modal (Opens Immediately) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#121927] border border-[#1E293B] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span>Create New Site Corridor</span>
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
                <label className="block text-slate-300 font-bold mb-1">Project Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategory('BUILDING');
                      setBuildingFloors('G + 3 Floors');
                    }}
                    className={`py-2 rounded-xl font-bold border transition ${
                      newCategory === 'BUILDING'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#162032] border-[#1E293B] text-slate-400'
                    }`}
                  >
                    Building Site
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategory('ROAD');
                      setBuildingFloors('Km 0 to 12.5');
                    }}
                    className={`py-2 rounded-xl font-bold border transition ${
                      newCategory === 'ROAD'
                        ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                        : 'bg-[#162032] border-[#1E293B] text-slate-400'
                    }`}
                  >
                    Road Corridor
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Site / Project Code Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BASVARAJ or VVV"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500 uppercase font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Location / Zone</label>
                <input
                  type="text"
                  placeholder="e.g. Tikota Road / Highway Corridor"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {newCategory === 'ROAD' ? 'Chainage Range' : 'Building Floors / Scope'}
                </label>
                <input
                  type="text"
                  value={buildingFloors}
                  onChange={(e) => setBuildingFloors(e.target.value)}
                  placeholder={newCategory === 'ROAD' ? 'Km 0 to 12.5' : 'G + 3 Floors'}
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
                  Create & Launch Site
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
