import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Plus, 
  Trash2, 
  Truck, 
  X,
  Signpost,
  ArrowRight,
  Eye,
  Lock
} from 'lucide-react';

// Normalizer to extract clean site key (e.g. "WW (G + 3 Floors)" -> "WW")
const extractCleanSiteName = (name: string): string => {
  if (!name) return 'MBBILGI';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

export const OngoingSiteTransfer: React.FC = () => {
  // Retrieve Active User Role
  const getUserRole = (): 'ADMIN' | 'EMPLOYEE' | 'READ_ONLY' => {
    try {
      const userRaw = sessionStorage.getItem('concrete360_user');
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        const r = String(parsed.role || '').toUpperCase();
        if (r === 'SUPER_ADMIN' || r === 'ADMIN') return 'ADMIN';
        if (r === 'READ_ONLY' || r === 'AUDITOR') return 'READ_ONLY';
        return 'EMPLOYEE';
      }
    } catch {}
    return 'ADMIN';
  };

  const userRole = getUserRole();
  const canCreate = userRole === 'ADMIN' || userRole === 'EMPLOYEE';
  const canDelete = userRole === 'ADMIN';

  const getActiveSiteKey = () => {
    try {
      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        try {
          const parsed = JSON.parse(activeRaw);
          return extractCleanSiteName(parsed.name || parsed.siteName || parsed.id);
        } catch {
          return extractCleanSiteName(activeRaw);
        }
      }
      const selected = sessionStorage.getItem('concrete360_selected_site');
      if (selected) return extractCleanSiteName(selected);
    } catch {}
    return 'MBBILGI';
  };

  const [currentActiveKey, setCurrentActiveKey] = useState<string>(getActiveSiteKey());

  const loadStoredSites = () => {
    try {
      const saved = localStorage.getItem('concrete360_ongoing_sites') || localStorage.getItem('concrete360_sites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [
      {
        id: 'site-1789881335720',
        siteId: 'S-01',
        category: 'Road',
        name: 'MBBILGI',
        siteName: 'MBBILGI',
        location: 'AINAPUR',
        supervisor: 'adminbilgi',
        clientName: 'MBBILGI',
        gstin: '29AAACB1234F1Z5',
        detail: 'Km 0 to 1.6',
        assignedFleet: 4
      },
      {
        id: 'site-1789881335721',
        siteId: 'S-02',
        category: 'Building',
        name: 'WW',
        siteName: 'WW (G + 3 Floors)',
        location: 'WW',
        supervisor: 'adminbilgi',
        clientName: 'WW',
        gstin: '29AAACB1234F1Z8',
        detail: 'G + 3 Floors',
        assignedFleet: 4
      }
    ];
  };

  const [sites, setSites] = useState<any[]>(loadStoredSites);

  // Sync sites to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('concrete360_sites', JSON.stringify(sites));
      localStorage.setItem('concrete360_ongoing_sites', JSON.stringify(sites));
    } catch {}
  }, [sites]);

  // Sync active site key and card list across windows and events
  useEffect(() => {
    const handleSync = () => {
      setCurrentActiveKey(getActiveSiteKey());
      setSites(loadStoredSites());
    };

    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [category, setCategory] = useState<'Road' | 'Building'>('Building');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [supervisor, setSupervisor] = useState('adminbilgi');
  const [clientName, setClientName] = useState('');
  const [gstin, setGstin] = useState('');
  const [startKm, setStartKm] = useState('0');
  const [endKm, setEndKm] = useState('12.5');
  const [floorScope, setFloorScope] = useState('G + 3 Floors');

  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      alert('Permission Denied: Read-Only accounts cannot create ongoing sites.');
      return;
    }
    if (!name.trim()) return;

    const detail = category === 'Road' ? `Km ${startKm} to ${endKm}` : floorScope;
    const cleanKey = extractCleanSiteName(name);
    const siteTitle = category === 'Building' ? `${cleanKey} (${detail})` : cleanKey;

    const newSite = {
      id: `site-${Date.now()}`,
      siteId: `S-0${sites.length + 1}`,
      category,
      name: cleanKey,
      siteName: siteTitle,
      location: location || (category === 'Road' ? 'Highway Corridor' : 'Sector 4 Commercial Zone'),
      supervisor: supervisor || 'adminbilgi',
      clientName: clientName.trim() || cleanKey,
      gstin: gstin.trim().toUpperCase(),
      detail,
      assignedFleet: 4
    };

    const updatedSites = [newSite, ...sites];
    setSites(updatedSites);

    if (clientName.trim()) {
      try {
        const existingClients = JSON.parse(localStorage.getItem('concrete360_clients') || '[]');
        const newClientEntry = {
          id: `c-${Date.now()}`,
          clientName: clientName.trim() || cleanKey,
          site: siteTitle,
          location: location || 'Mulwad Site',
          gstin: gstin.trim().toUpperCase() || '29UNREGISTERED'
        };
        localStorage.setItem('concrete360_clients', JSON.stringify([newClientEntry, ...existingClients]));
      } catch {}
    }

    setIsAddModalOpen(false);
    setName('');
    setLocation('');
    setClientName('');
    setGstin('');

    // Automatically switch active site to the newly created section
    handleSelectActiveSite(newSite);
  };

  const handleDeleteSite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) {
      alert('Permission Denied: Only ADMIN accounts can delete site sections.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this ongoing site?')) {
      setSites(prev => prev.filter(s => s.id !== id));
    }
  };

  // ISOLATE SITE DATA: Save clean active context and scope across modules & trigger workspace reload
  const handleSelectActiveSite = (site: any) => {
    const cleanSiteKey = extractCleanSiteName(site.name || site.siteName);

    // 1. Persist active site payload to localStorage and sessionStorage
    const sitePayload = {
      id: site.id || cleanSiteKey,
      siteId: site.siteId || 'S-01',
      name: cleanSiteKey,
      displayName: site.siteName || cleanSiteKey,
      clientName: site.clientName || cleanSiteKey,
      location: site.location,
      scope: site.detail || site.structureScope || 'G + 3 Floors',
      gstin: site.gstin
    };

    try {
      localStorage.setItem('concrete360_active_site', JSON.stringify(sitePayload));
      sessionStorage.setItem('concrete360_selected_site', cleanSiteKey);
    } catch {}

    setCurrentActiveKey(cleanSiteKey);

    // 2. Trigger window event so all modules re-fetch site data
    window.dispatchEvent(new CustomEvent('concrete360_site_switched', { detail: cleanSiteKey }));
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Banner Header */}
      <div className="bg-[#0b1322] border border-[#1b273d] p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                ACTIVE SITE MANAGEMENT
              </span>
              <span className="text-xs font-mono text-slate-400">{sites.length} Registered Sections</span>
            </div>
            <h2 className="text-xl font-black text-white mt-1 tracking-tight">
              Building &amp; Road Site Corridor Management
            </h2>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              setCategory('Building');
              setIsAddModalOpen(true);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition shrink-0 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Ongoing Site Section</span>
          </button>
        )}
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map(site => {
          const cleanKey = extractCleanSiteName(site.name || site.siteName);
          const isCurrentlyActive = cleanKey === currentActiveKey;

          return (
            <div
              key={site.id}
              onClick={() => handleSelectActiveSite(site)}
              className={`bg-[#0b1322] border rounded-3xl p-5 shadow-xl cursor-pointer transition relative flex flex-col justify-between group ${
                isCurrentlyActive 
                  ? 'border-blue-500 ring-2 ring-blue-500/20' 
                  : 'border-[#1b273d] hover:border-blue-500/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    site.category === 'Building' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                  }`}>
                    {(site.category || 'Building').toUpperCase()} SITE
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">{site.siteId || site.id}</span>
                    {canDelete && (
                      <button
                        onClick={(e) => handleDeleteSite(site.id, e)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        title="Delete Site"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-black text-white mt-3 tracking-wide group-hover:text-blue-300 transition-colors">
                  {cleanKey}
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>{site.location}</span>
                </p>

                <div className="mt-4 bg-[#0d1627] border border-[#17253e] rounded-xl p-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400">Supervisor:</span>
                    <span className="font-bold text-white">{site.supervisor}</span>
                  </div>
                  {site.clientName && (
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">Client:</span>
                      <span className="font-bold text-blue-400 truncate max-w-[140px]">{site.clientName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400">{site.category === 'Road' ? 'Chainage Range:' : 'Structure Scope:'}</span>
                    <span className="font-extrabold text-emerald-400">{site.detail}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#172439] flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-400" />
                  {site.assignedFleet || 4} Assigned Fleet
                </span>
                
                {isCurrentlyActive ? (
                  <span className="text-blue-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Active Selection
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectActiveSite(site);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                  >
                    <span>Launch Site</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD ONGOING ROAD / BUILDING SECTION */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0b1322] border border-[#1e2d46] rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  category === 'Road' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  {category === 'Road' ? <Signpost className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Add Ongoing {category} Section
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-[#121c2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSite} className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-2 font-bold uppercase tracking-wider">Construction Category *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCategory('Road')}
                    className={`py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition border cursor-pointer ${
                      category === 'Road'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                        : 'bg-[#121d2f] border-[#22334f] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Signpost className="w-4 h-4" />
                    <span>Road</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('Building')}
                    className={`py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition border cursor-pointer ${
                      category === 'Building'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10'
                        : 'bg-[#121d2f] border-[#22334f] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Building</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold uppercase tracking-wider">
                  {category === 'Road' ? 'Site Section Name *' : 'Building / Tower Project Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={category === 'Road' ? 'E.G. NH-50 SECTION PACKAGE B' : 'E.G. BILGI HEIGHTS TOWER-A'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans text-sm uppercase font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-bold uppercase tracking-wider">Client Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Buildwell Ltd."
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-bold uppercase tracking-wider">GSTIN Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 29AAACB..."
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold uppercase tracking-wider">
                  {category === 'Road' ? 'Location / Corridor' : 'Site Location / Campus'}
                </label>
                <input
                  type="text"
                  placeholder={category === 'Road' ? 'e.g. Km 12+000 to 24+500' : 'e.g. Sector 4 Commercial Zone'}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans text-sm"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold uppercase tracking-wider">Site Supervisor</label>
                <input
                  type="text"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-sans text-sm"
                />
              </div>

              {category === 'Road' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1 font-bold uppercase tracking-wider">Start Km</label>
                    <input
                      type="text"
                      value={startKm}
                      onChange={(e) => setStartKm(e.target.value)}
                      className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1 font-bold uppercase tracking-wider">End Km</label>
                    <input
                      type="text"
                      value={endKm}
                      onChange={(e) => setEndKm(e.target.value)}
                      className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-slate-300 block mb-1 font-bold uppercase tracking-wider">Building Structure / Floor Scope</label>
                  <input
                    type="text"
                    value={floorScope}
                    onChange={(e) => setFloorScope(e.target.value)}
                    className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-emerald-400 focus:outline-none focus:border-blue-500 font-mono text-sm font-bold"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1a273b]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-3 text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 text-xs transition cursor-pointer"
                >
                  Create Site Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OngoingSiteTransfer;
