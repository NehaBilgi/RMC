import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Layers, 
  Truck, 
  RefreshCw,
  SlidersHorizontal,
  Filter,
  Lock,
  Eye
} from 'lucide-react';

export interface MixRecipe {
  grade: string;
  name?: string;
  cementKgPerM3: number;
  flyAshKgPerM3: number;
  waterLitresPerM3: number;
  mSandKgPerM3: number;
  agg20mmKgPerM3: number;
  agg10mmKgPerM3: number;
  admixtureKgPerM3: number;
}

const FALLBACK_RECIPES: Record<string, MixRecipe> = {
  'M20': { grade: 'M20', cementKgPerM3: 320, flyAshKgPerM3: 75, waterLitresPerM3: 165, mSandKgPerM3: 726, agg20mmKgPerM3: 726, agg10mmKgPerM3: 388, admixtureKgPerM3: 0 },
  'M25': { grade: 'M25', cementKgPerM3: 350, flyAshKgPerM3: 60, waterLitresPerM3: 165, mSandKgPerM3: 720, agg20mmKgPerM3: 680, agg10mmKgPerM3: 450, admixtureKgPerM3: 3.5 },
  'M30': { grade: 'M30', cementKgPerM3: 380, flyAshKgPerM3: 70, waterLitresPerM3: 160, mSandKgPerM3: 700, agg20mmKgPerM3: 700, agg10mmKgPerM3: 460, admixtureKgPerM3: 4.0 },
  'M35': { grade: 'M35', cementKgPerM3: 410, flyAshKgPerM3: 80, waterLitresPerM3: 155, mSandKgPerM3: 680, agg20mmKgPerM3: 710, agg10mmKgPerM3: 470, admixtureKgPerM3: 4.5 },
  'M40': { grade: 'M40', cementKgPerM3: 440, flyAshKgPerM3: 90, waterLitresPerM3: 150, mSandKgPerM3: 660, agg20mmKgPerM3: 720, agg10mmKgPerM3: 480, admixtureKgPerM3: 5.2 }
};

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'DEFAULT';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

export const SiteMaterialReportModule: React.FC = () => {
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
  const isReadOnly = userRole === 'READ_ONLY';

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
    return 'DEFAULT';
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(getActiveSiteKey());
  const [activeSiteName, setActiveSiteName] = useState<string>(getActiveSiteKey());
  
  const [measurementItems, setMeasurementItems] = useState<any[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('ALL');

  const [truckCapacityM3, setTruckCapacityM3] = useState<number>(9);
  const [wastagePercent, setWastagePercent] = useState<number>(5);
  const [mixRecipes, setMixRecipes] = useState<Record<string, MixRecipe>>(FALLBACK_RECIPES);
  const [selectedGrade, setSelectedGrade] = useState<string>('M25');

  const syncMixDesigns = () => {
    try {
      const keysToCheck = ['concrete360_mix_designs', 'concrete360_mix_design_recipes', 'concrete360_mixes', 'pave_mix_designs'];
      for (const key of keysToCheck) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const recipeMap: Record<string, MixRecipe> = {};
            parsed.forEach((d: any) => {
              const code = String(d.grade || d.code || 'M25').trim().toUpperCase();
              recipeMap[code] = {
                grade: code,
                cementKgPerM3: Number(d.cementKgPerM3 ?? d.cement ?? 350),
                flyAshKgPerM3: Number(d.flyAshKgPerM3 ?? d.flyAsh ?? 60),
                waterLitresPerM3: Number(d.waterLitresPerM3 ?? d.water ?? 165),
                mSandKgPerM3: Number(d.mSandKgPerM3 ?? d.sand ?? 720),
                agg20mmKgPerM3: Number(d.agg20mmKgPerM3 ?? d.agg20 ?? 680),
                agg10mmKgPerM3: Number(d.agg10mmKgPerM3 ?? d.agg10 ?? 450),
                admixtureKgPerM3: Number(d.admixtureKgPerM3 ?? d.admixture ?? d.plasticizer ?? 0)
              };
            });
            setMixRecipes(recipeMap);
            break;
          }
        }
      }
    } catch {}
  };

  const syncTelemetryData = () => {
    try {
      syncMixDesigns();
      const siteKey = getActiveSiteKey();
      setCurrentSiteKey(siteKey);
      setActiveSiteName(siteKey);
      setSelectedWorkId('ALL');

      let parsedItems: any[] = [];
      const measurementsRaw = localStorage.getItem(`concrete360_advanced_measurements_${siteKey}`);
      
      if (measurementsRaw) {
        try { 
          parsedItems = JSON.parse(measurementsRaw) || []; 
        } catch {}
      }

      setMeasurementItems(Array.isArray(parsedItems) ? parsedItems : []);

      if (Array.isArray(parsedItems) && parsedItems.length > 0 && parsedItems[0].mixGrade) {
        setSelectedGrade(parsedItems[0].mixGrade);
      }

      const measurementSession = localStorage.getItem('concrete360_measurement');
      if (measurementSession) {
        const parsedS = JSON.parse(measurementSession);
        if (parsedS.transitTruckCapacityM3) {
          setTruckCapacityM3(Number(parsedS.transitTruckCapacityM3));
        }
        if (parsedS.safetyWastagePercent !== undefined) {
          setWastagePercent(Number(parsedS.safetyWastagePercent));
        }
      }
    } catch {}
  };

  useEffect(() => {
    syncTelemetryData();

    const handleSiteSwitch = () => syncTelemetryData();
    const handleMixUpdate = () => syncMixDesigns();

    window.addEventListener('concrete360_site_switched', handleSiteSwitch);
    window.addEventListener('concrete360_mix_designs_updated', handleMixUpdate);
    window.addEventListener('storage', handleSiteSwitch);
    window.addEventListener('focus', handleSiteSwitch);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSiteSwitch);
      window.removeEventListener('concrete360_mix_designs_updated', handleMixUpdate);
      window.removeEventListener('storage', handleSiteSwitch);
      window.removeEventListener('focus', handleSiteSwitch);
    };
  }, []);

  const netTargetVolumeM3 = useMemo(() => {
    if (selectedWorkId === 'ALL') {
      const total = measurementItems.reduce((sum, it) => sum + (Number(it.volumeM3) || 0), 0);
      try {
        const savedInvoices = localStorage.getItem(`concrete360_site_invoices_${currentSiteKey}`);
        if (savedInvoices) {
          const invList = JSON.parse(savedInvoices);
          if (Array.isArray(invList)) {
            const invoicedVol = invList.reduce((s, inv) => s + (Number(inv.volumeM3) || 0), 0);
            return Math.max(0, total - invoicedVol);
          }
        }
      } catch {}
      return total;
    } else {
      const item = measurementItems.find(it => it.id === selectedWorkId);
      return item ? Number(item.volumeM3) || 0 : 0;
    }
  }, [measurementItems, selectedWorkId, currentSiteKey]);

  const targetVolumeM3 = useMemo(() => {
    return netTargetVolumeM3 * (1 + wastagePercent / 100);
  }, [netTargetVolumeM3, wastagePercent]);

  useEffect(() => {
    if (selectedWorkId !== 'ALL') {
      const item = measurementItems.find(it => it.id === selectedWorkId);
      if (item && item.mixGrade) {
        setSelectedGrade(item.mixGrade);
      }
    }
  }, [selectedWorkId, measurementItems]);

  const deliveriesCount = useMemo(() => {
    if (targetVolumeM3 <= 0 || truckCapacityM3 <= 0) return 0;
    return Math.ceil(targetVolumeM3 / truckCapacityM3);
  }, [targetVolumeM3, truckCapacityM3]);

  const activeRecipe = mixRecipes[selectedGrade] || FALLBACK_RECIPES[selectedGrade] || FALLBACK_RECIPES['M25'];

  const materials = useMemo(() => {
    const vol = Number(targetVolumeM3) || 0;
    const cementTotalKg = vol * (Number(activeRecipe.cementKgPerM3) || 0);
    const cementBags = Math.round(cementTotalKg / 50);
    const flyAshTotalKg = vol * (Number(activeRecipe.flyAshKgPerM3) || 0);
    const waterTotalLitres = vol * (Number(activeRecipe.waterLitresPerM3) || 0);
    const mSandTotalKg = vol * (Number(activeRecipe.mSandKgPerM3) || 0);
    const agg20mmTotalKg = vol * (Number(activeRecipe.agg20mmKgPerM3) || 0);
    const agg10mmTotalKg = vol * (Number(activeRecipe.agg10mmKgPerM3) || 0);
    const admixtureTotalKg = vol * (Number(activeRecipe.admixtureKgPerM3) || 0);

    return {
      cementTotalKg,
      cementBags,
      flyAshTotalKg,
      waterTotalLitres,
      mSandTotalKg,
      agg20mmTotalKg,
      agg10mmTotalKg,
      admixtureTotalKg
    };
  }, [targetVolumeM3, activeRecipe]);

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full overflow-hidden">
      {/* Top Controls Bar with Structural Work Filter & Mix Grade Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
            REAL-TIME BATCH CONSUMPTION ({currentSiteKey})
          </span>
          <h2 className="text-xl font-black text-white mt-1">Material Consumption &amp; Reports</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Work Element Selector */}
          <div className="flex items-center gap-2 bg-[#0b1322] border border-[#1b273d] px-3 py-1.5 rounded-xl font-mono text-xs shadow-lg">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Work Element:</span>
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-[#0b1322]">All Combined Works</option>
              {measurementItems.map((it) => (
                <option key={it.id} value={it.id} className="bg-[#0b1322]">
                  {it.id}: {it.label} ({it.volumeM3} m³)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#0b1322] border border-[#1b273d] px-3 py-1.5 rounded-xl font-mono text-xs shadow-lg">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Mix Grade:</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="bg-transparent text-cyan-400 font-bold outline-none cursor-pointer text-xs"
            >
              {Object.keys(mixRecipes).map((gradeKey) => (
                <option key={gradeKey} value={gradeKey} className="bg-[#0b1322] text-white">
                  {gradeKey} Design
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={syncTelemetryData}
            className="p-2 bg-[#0b1322] hover:bg-[#121c2d] border border-[#1b273d] text-slate-300 hover:text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-mono shadow-lg"
            title="Sync Measurements"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
              Selected Site / Work
            </span>
            <div className="text-base font-black text-white truncate mt-0.5" title={activeSiteName}>
              {selectedWorkId === 'ALL' ? activeSiteName : (measurementItems.find(i => i.id === selectedWorkId)?.label || activeSiteName)}
            </div>
          </div>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                Target Quantity (+Wastage)
              </span>
              <div className="text-2xl font-black text-emerald-400 mt-0.5">
                {targetVolumeM3.toFixed(2)} <span className="text-xs text-slate-400 font-sans font-normal">m³</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 font-bold uppercase">Wastage %</span>
            {isReadOnly ? (
              <span className="text-xs text-cyan-300 font-bold px-1.5 py-1 mt-1">
                {wastagePercent}%
              </span>
            ) : (
              <input
                type="number"
                min="0"
                max="30"
                value={wastagePercent}
                onChange={(e) => setWastagePercent(Math.max(0, Number(e.target.value)))}
                className="w-12 text-right bg-[#070d1a] border border-[#1b273d] rounded-lg px-1.5 py-1 text-xs text-cyan-300 font-bold outline-none mt-1"
                title="Adjust Wastage Percentage"
              />
            )}
          </div>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
              Required Deliveries
            </span>
            <div className="text-2xl font-black text-fuchsia-400 mt-0.5">
              {deliveriesCount} <span className="text-xs text-slate-400 font-sans font-normal">Trips</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cumulative Material Consumption Section */}
      <div className="bg-[#080e1b] border border-[#17253d] p-6 rounded-3xl shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#142036] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">
              Material Consumption Breakdown
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 shrink-0">
              Volume: <strong className="text-cyan-400">{targetVolumeM3.toFixed(2)} m³</strong> (Net: {netTargetVolumeM3.toFixed(2)} m³ + {wastagePercent}% Wastage) | Grade: <strong className="text-white">{selectedGrade}</strong>
            </span>
            {isReadOnly && (
              <span className="text-slate-500 text-[10px] inline-flex items-center gap-1 font-mono border border-slate-700 px-2 py-0.5 rounded-md">
                <Lock className="w-3 h-3" />
                <span>View Only</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
          <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cement (OPC / PPC)</span>
            <div className="text-2xl font-extrabold text-blue-400">{Math.round(materials.cementTotalKg).toLocaleString('en-IN')} <span className="text-xs font-sans text-slate-400">kg</span></div>
            <span className="text-xs text-slate-500 block">({materials.cementBags.toLocaleString('en-IN')} Bags @ 50kg) • @ {activeRecipe.cementKgPerM3} kg/m³</span>
          </div>

          <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fly Ash / GGBS</span>
            <div className="text-2xl font-extrabold text-purple-400">{Math.round(materials.flyAshTotalKg).toLocaleString('en-IN')} <span className="text-xs font-sans text-slate-400">kg</span></div>
            <span className="text-xs text-slate-500 block">Pozzolanic Modifier • @ {activeRecipe.flyAshKgPerM3} kg/m³</span>
          </div>

          <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batching Water</span>
            <div className="text-2xl font-extrabold text-cyan-400">{Math.round(materials.waterTotalLitres).toLocaleString('en-IN')} <span className="text-xs font-sans text-slate-400">Litres</span></div>
            <span className="text-xs text-slate-500 block">Density 1.0 kg/L • @ {activeRecipe.waterLitresPerM3} L/m³</span>
          </div>

          <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">M-Sand (Fine Aggregate)</span>
            <div className="text-2xl font-extrabold text-amber-400">{Math.round(materials.mSandTotalKg).toLocaleString('en-IN')} <span className="text-xs font-sans text-slate-400">kg</span></div>
            <span className="text-xs text-slate-500 block">Zone II Sand • @ {activeRecipe.mSandKgPerM3} kg/m³</span>
          </div>

          <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">20 MM Aggregate</span>
            <div className="text-2xl font-extrabold text-emerald-400">{Math.round(materials.agg20mmTotalKg).toLocaleString('en-IN')} <span className="text-xs font-sans text-slate-400">kg</span></div>
            <span className="text-xs text-slate-500 block">Coarse Fraction A • @ {activeRecipe.agg20mmKgPerM3} kg/m³</span>
          </div>

          <div className="bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">10 MM Aggregate</span>
            <div className="text-2xl font-extrabold text-emerald-400">{Math.round(materials.agg10mmTotalKg).toLocaleString('en-IN')} <span className="text-xs font-sans text-slate-400">kg</span></div>
            <span className="text-xs text-slate-500 block">Coarse Fraction B • @ {activeRecipe.agg10mmKgPerM3} kg/m³</span>
          </div>

          <div className="sm:col-span-3 bg-[#0b1322] border border-[#1b273d] p-5 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Superplasticizer Admixture</span>
            <div className="text-2xl font-extrabold text-rose-400">{materials.admixtureTotalKg.toFixed(1)} <span className="text-xs font-sans text-slate-400">kg</span></div>
            <span className="text-xs text-slate-500 block">High-Range Water Reducer • @ {activeRecipe.admixtureKgPerM3} kg/m³</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteMaterialReportModule;
