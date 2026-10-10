import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  DollarSign, 
  Truck, 
  FileCheck2, 
  FlaskConical, 
  Layers, 
  FileSpreadsheet, 
  ArrowUpRight, 
  Activity,
  Ruler
} from 'lucide-react';

interface Props {
  onNavigate: (tabId: string) => void;
}

export const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  const getActiveSiteKey = () => {
    try {
      const activeSiteRaw = localStorage.getItem('concrete360_active_site');
      if (activeSiteRaw) {
        try {
          const parsed = JSON.parse(activeSiteRaw);
          if (parsed.name || parsed.siteName || parsed.id) {
            return String(parsed.name || parsed.siteName || parsed.id).trim();
          }
        } catch {
          return activeSiteRaw.trim();
        }
      }
      const selectedSite = sessionStorage.getItem('concrete360_selected_site');
      if (selectedSite) return String(selectedSite).trim();
    } catch {}
    return 'MBBILGI';
  };

  const [activeSiteTitle, setActiveSiteTitle] = useState<string>(getActiveSiteKey());
  const [activeScope, setActiveScope] = useState<string>('Scope: G + 3 Floors');
  const [totalBilledRevenue, setTotalBilledRevenue] = useState<number>(0);
  const [totalTripsCount, setTotalTripsCount] = useState<number>(0);
  const [tmTripsCount, setTmTripsCount] = useState<number>(0);
  const [haulageTripsCount, setHaulageTripsCount] = useState<number>(0);
  const [totalVolumeM3, setTotalVolumeM3] = useState<number>(0);
  const [activeMixersCount, setActiveMixersCount] = useState<number>(0);

  // Load site-scoped dashboard telemetry
  const loadDashboardTelemetry = () => {
    const siteKey = getActiveSiteKey();
    setActiveSiteTitle(siteKey);

    try {
      // 1. Fetch Active Site Info & Scope
      const activeSiteRaw = localStorage.getItem('concrete360_active_site');
      if (activeSiteRaw) {
        try {
          const parsed = JSON.parse(activeSiteRaw);
          if (parsed.name || parsed.siteName) {
            setActiveSiteTitle(parsed.name || parsed.siteName);
          }
          if (parsed.scope || parsed.location) {
            setActiveScope(parsed.scope ? `Scope: ${parsed.scope}` : `Location: ${parsed.location}`);
          }
        } catch {}
      }

      // 2. Compute Billed Revenue & Volume from site-specific + global invoices
      const possibleInvoiceKeys = [
        `concrete360_site_invoices_${siteKey}`,
        'concrete360_site_invoices',
        'concrete360_invoices'
      ];
      let invoiceRev = 0;
      let invoiceVol = 0;
      let invoiceTrips = 0;

      for (const k of possibleInvoiceKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length > 0) {
              invoiceTrips = arr.length;
              arr.forEach((inv: any) => {
                invoiceRev += Number(inv.grandTotalINR || inv.grandTotal) || 0;
                invoiceVol += Number(inv.volumeM3) || 0;
              });
              break;
            }
          } catch {}
        }
      }

      // 3. Compute Haulage & Rental Trips
      const possibleHaulageKeys = [
        `concrete360_site_haulage_trips_${siteKey}`,
        'concrete360_site_haulage_trips',
        'CONSTRUCTION_PRO_HAULAGE_TRIPS_V2'
      ];
      let haulageRev = 0;
      let haulageTrips = 0;

      for (const k of possibleHaulageKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length > 0) {
              haulageTrips = arr.length;
              arr.forEach((t: any) => {
                haulageRev += Number(t.totalAmount || t.rentAmount || t.rent) || 0;
              });
              break;
            }
          } catch {}
        }
      }

      // 4. Retrieve Active Transit Mixers
      const possibleMixerKeys = [
        `concrete360_transit_mixers_${siteKey}`,
        'concrete360_transit_mixers',
        `concrete360_transit_mixer_fleet_${siteKey}`
      ];
      let activeTrucks = 0;

      for (const k of possibleMixerKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length > 0) {
              activeTrucks = arr.filter((m: any) => m.status === 'Active on Site' || m.isActive !== false).length;
              break;
            }
          } catch {}
        }
      }

      setTotalBilledRevenue(invoiceRev + haulageRev);
      setTmTripsCount(invoiceTrips);
      setHaulageTripsCount(haulageTrips);
      setTotalTripsCount(invoiceTrips + haulageTrips);
      setTotalVolumeM3(invoiceVol);
      setActiveMixersCount(activeTrucks || 1);

    } catch (e) {
      console.error('Failed to load dashboard telemetry', e);
    }
  };

  useEffect(() => {
    loadDashboardTelemetry();

    const handleSync = () => loadDashboardTelemetry();
    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('concrete360_transit_mixer_updated', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('concrete360_transit_mixer_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Banner Card */}
      <div className="bg-[#0b1322] border border-[#1b273d] p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
            Active Building Site
          </span>
          <h2 className="text-2xl font-black text-white mt-2 tracking-tight">{activeSiteTitle}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry, material haulage, and financial billing overview.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Linked to Site Measurement Studio */}
          <button
            onClick={() => onNavigate('site-measurement-studio')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer active:scale-95"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Site Measurements</span>
          </button>
          
          {/* Linked to At-Site Tests */}
          <button
            onClick={() => onNavigate('at-site-tests')}
            className="px-4 py-2.5 bg-[#131d2e] hover:bg-[#1a273b] border border-[#22334f] text-amber-400 font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer active:scale-95"
          >
            <FlaskConical className="w-4 h-4 text-amber-400" />
            <span>At-Site Tests</span>
          </button>
        </div>
      </div>

      {/* Main KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Billed Revenue */}
        <div 
          onClick={() => onNavigate('billing')}
          className="bg-[#0b1322] border border-[#1b273d] hover:border-blue-500/50 p-5 rounded-2xl shadow-xl cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-mono uppercase font-bold tracking-wider">
              Total Billed Revenue
            </span>
            <DollarSign className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition" />
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono mt-2">
            ₹{totalBilledRevenue.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">
            From Billing &amp; Invoices
          </span>
        </div>

        {/* Total Haulage & TM Trips */}
        <div 
          onClick={() => onNavigate('trips')}
          className="bg-[#0b1322] border border-[#1b273d] hover:border-emerald-500/50 p-5 rounded-2xl shadow-xl cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-mono uppercase font-bold tracking-wider">
              Total Haulage &amp; TM Trips
            </span>
            <Truck className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-2">
            {totalTripsCount} Trips
          </div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">
            Combined Trips &amp; Transit Mixers
          </span>
        </div>

        {/* Active Project Site */}
        <div 
          onClick={() => onNavigate('ongoing-site')}
          className="bg-[#0b1322] border border-[#1b273d] hover:border-purple-500/50 p-5 rounded-2xl shadow-xl cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-mono uppercase font-bold tracking-wider">
              Active Project Site
            </span>
            <Building2 className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2 truncate" title={activeSiteTitle}>
            {activeSiteTitle}
          </div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">
            {activeScope}
          </span>
        </div>
      </div>

      {/* Transit Mixer Trips, Delivery Telemetry & Reports Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Transit Mixer Fleet & Dispatch Status */}
        <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-[#1b273d] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Transit Mixer Activity &amp; Trips
                </h3>
                <p className="text-[11px] text-slate-400">Logistics dispatch docket status</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('transit-mixer')}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition cursor-pointer"
            >
              <span>Manage Mixers</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="bg-[#070d1a] border border-[#1b273d] p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Total Batch Dispatched</span>
              <strong className="text-lg text-white block mt-0.5">{totalVolumeM3.toFixed(2)} m³</strong>
            </div>
            <div className="bg-[#070d1a] border border-[#1b273d] p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Active Mixers on Site</span>
              <strong className="text-lg text-emerald-400 block mt-0.5">{activeMixersCount} Ready</strong>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#070d1a] border border-[#1b273d] px-4 py-3 rounded-2xl text-xs font-mono">
            <span className="text-slate-400">Billed Delivery Trips:</span>
            <strong className="text-amber-400">{tmTripsCount} Loads Logged</strong>
          </div>
        </div>

        {/* Site Financial Ledger & Material Reports */}
        <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-[#1b273d] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Site Reports &amp; Material Used
                </h3>
                <p className="text-[11px] text-slate-400">Ledger accounting &amp; design mix sheets</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold transition cursor-pointer"
            >
              <span>View Reports</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div 
              onClick={() => onNavigate('total-bill')}
              className="flex items-center justify-between p-3 rounded-xl bg-[#070d1a] hover:bg-[#0e1728] border border-[#1b273d] cursor-pointer transition"
            >
              <div className="flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300 font-bold">Total Bill of Site Ledger</span>
              </div>
              <span className="text-emerald-400 font-mono font-bold">₹{totalBilledRevenue.toLocaleString('en-IN')}</span>
            </div>

            <div 
              onClick={() => onNavigate('mix-design')}
              className="flex items-center justify-between p-3 rounded-xl bg-[#070d1a] hover:bg-[#0e1728] border border-[#1b273d] cursor-pointer transition"
            >
              <div className="flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-slate-300 font-bold">Concrete Mix Designs (M20 - M40)</span>
              </div>
              <span className="text-cyan-400 font-mono text-[11px]">Calibrated</span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => onNavigate('total-bill')}
              className="px-4 py-2 bg-[#121c2d] hover:bg-[#19273f] border border-[#1b273d] text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Open Site Ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
