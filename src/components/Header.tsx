import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, 
  Ruler, 
  Plus, 
  Activity, 
  MapPin, 
  Building2, 
  ChevronDown, 
  Check, 
  Receipt, 
  FileCheck2, 
  Layers 
} from 'lucide-react';

interface SiteItem {
  id: string;
  name: string;
  siteName?: string;
  location?: string;
  clientName?: string;
}

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCreateOrder: () => void;
  onQuickMeasure: () => void;
  totalPouredToday: number;
}

export const Header: React.FC<Props> = ({
  activeTab,
  onTabChange,
  onOpenCreateOrder,
  onQuickMeasure,
  totalPouredToday
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [activeSite, setActiveSite] = useState<SiteItem>({
    id: 'default',
    name: 'FATIMA COMPLEX',
    siteName: 'FATIMA COMPLEX (G + 3)'
  });

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Load sites and active selection from localStorage
  const loadSitesAndActive = () => {
    try {
      const savedSites = localStorage.getItem('concrete360_sites') || localStorage.getItem('concrete360_ongoing_sites');
      if (savedSites) {
        const parsed = JSON.parse(savedSites);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSites(parsed);
        }
      }

      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        const parsedActive = JSON.parse(activeRaw);
        setActiveSite(parsedActive);
      } else {
        const selectedSession = sessionStorage.getItem('concrete360_selected_site');
        if (selectedSession) {
          setActiveSite({ id: selectedSession, name: selectedSession, siteName: selectedSession });
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadSitesAndActive();

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSite = (site: SiteItem) => {
    const siteTitle = site.name || site.siteName || 'Site';
    const sitePayload = {
      id: site.id || siteTitle,
      name: siteTitle,
      clientName: site.clientName || '',
      location: site.location || ''
    };

    setActiveSite(sitePayload);
    localStorage.setItem('concrete360_active_site', JSON.stringify(sitePayload));
    sessionStorage.setItem('concrete360_selected_site', siteTitle);

    try {
      const savedSites = localStorage.getItem('concrete360_sites');
      if (savedSites) {
        const parsed = JSON.parse(savedSites);
        const updated = parsed.map((s: any) => ({
          ...s,
          isActive: (s.id === site.id || s.name === site.name || s.siteName === site.name)
        }));
        localStorage.setItem('concrete360_sites', JSON.stringify(updated));
      }
    } catch {}

    // Dispatch global event so all active modules instantly re-sync their data top-to-bottom
    window.dispatchEvent(new Event('concrete360_site_switched'));
    setIsOpen(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl backdrop-blur-md bg-slate-900/90 w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand & Active Site Dropdown Switcher */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black shrink-0">
              <Truck className="w-6 h-6 stroke-[2.5]" />
            </div>

            {/* Site Switcher Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 rounded-2xl shadow-xl text-white font-mono text-xs font-bold transition cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="tracking-wider uppercase truncate max-w-[160px] sm:max-w-[220px]">
                  {activeSite.name || 'SELECT SITE'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 font-mono">
                  <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Active Sites</span>
                    <span className="text-amber-400">{(sites.length > 0 ? sites.length : 1)} Sites</span>
                  </div>

                  <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-800/60">
                    {sites.length === 0 ? (
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          onTabChange('ongoing_site');
                        }}
                        className="w-full text-left px-4 py-3 text-xs text-white hover:bg-slate-900 flex items-center justify-between cursor-pointer"
                      >
                        <span>FATIMA COMPLEX</span>
                        <Check className="w-4 h-4 text-amber-400" />
                      </button>
                    ) : (
                      sites.map((s) => {
                        const sName = s.name || s.siteName || 'Site';
                        const isSelected = (activeSite.name === sName || activeSite.id === s.id);
                        return (
                          <button
                            key={s.id || sName}
                            onClick={() => handleSelectSite(s)}
                            className={`w-full text-left px-4 py-3 text-xs flex items-center justify-between transition cursor-pointer ${
                              isSelected ? 'bg-amber-500/10 text-amber-300 font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <span className="block truncate">{sName}</span>
                              {s.clientName && (
                                <span className="block text-[10px] text-slate-500 truncate font-sans">Client: {s.clientName}</span>
                              )}
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="p-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onTabChange('ongoing_site');
                      }}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition cursor-pointer border border-amber-500/20"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ Add New Site Section</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Plant & Dispatch Ticker */}
          <div className="hidden lg:flex items-center gap-4 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300">Central Hub Online</span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400">Discharged Today: </span>
              <strong className="text-amber-400">{totalPouredToday} m³</strong>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onQuickMeasure}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Measure Site Takeoff</span>
              <span className="sm:hidden">Measure</span>
            </button>

            <button
              onClick={onOpenCreateOrder}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Book Order</span>
            </button>
          </div>
        </div>

        {/* Primary Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-800/80 py-2 scrollbar-none text-xs">
          {[
            { id: 'billing', label: 'Company Invoicing & GST', icon: Receipt },
            { id: 'challans', label: 'Delivery Challans & Dockets', icon: FileCheck2 },
            { id: 'orders', label: 'Dispatch & Order Management', icon: Truck },
            { id: 'measurement', label: 'Site Inventory & Measurement', icon: Ruler },
            { id: 'analytics', label: 'Company Financial Telemetry', icon: Activity },
            { id: 'mix_catalog', label: 'Mix Catalog & Rate Book', icon: Layers },
            { id: 'visits', label: 'Site Visit Logs & CRM', icon: MapPin }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default Header;
