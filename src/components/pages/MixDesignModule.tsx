import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Edit2, Save, X, Check, RotateCcw, Lock, Zap, Droplets } from 'lucide-react';

export type AdmixtureMode = 'FLY_ASH' | 'GGBS';

export interface MixRecipe {
  grade: string;
  targetMpa: number;
  wcr: number;
  cementKg: number;
  mineralAdmixtureKg: number;
  waterLitres: number;
  mSandKg: number;
  agg20mmKg: number;
  agg10mmKg: number;
  admixtureKg: number;
  totalDensity: number;
}

// Exactly balanced to 2400 kg/m3 with water reduction
const DEFAULT_RECIPES_FLY_ASH: Record<string, MixRecipe> = {
  'M15': { grade: 'M15', targetMpa: 20.8, wcr: 0.46, cementKg: 250, mineralAdmixtureKg: 75, waterLitres: 150, mSandKg: 825, agg20mmKg: 658, agg10mmKg: 440, admixtureKg: 2, totalDensity: 2400 },
  'M20': { grade: 'M20', targetMpa: 26.6, wcr: 0.38, cementKg: 300, mineralAdmixtureKg: 90, waterLitres: 148, mSandKg: 789, agg20mmKg: 642, agg10mmKg: 428, admixtureKg: 3, totalDensity: 2400 },
  'M25': { grade: 'M25', targetMpa: 31.6, wcr: 0.32, cementKg: 350, mineralAdmixtureKg: 105, waterLitres: 145, mSandKg: 752, agg20mmKg: 627, agg10mmKg: 418, admixtureKg: 3, totalDensity: 2400 },
  'M30': { grade: 'M30', targetMpa: 38.3, wcr: 0.29, cementKg: 380, mineralAdmixtureKg: 115, waterLitres: 142, mSandKg: 721, agg20mmKg: 623, agg10mmKg: 415, admixtureKg: 4, totalDensity: 2400 },
  'M35': { grade: 'M35', targetMpa: 43.3, wcr: 0.27, cementKg: 400, mineralAdmixtureKg: 120, waterLitres: 138, mSandKg: 704, agg20mmKg: 620, agg10mmKg: 414, admixtureKg: 4, totalDensity: 2400 },
  'M40': { grade: 'M40', targetMpa: 48.3, wcr: 0.25, cementKg: 420, mineralAdmixtureKg: 125, waterLitres: 135, mSandKg: 681, agg20mmKg: 620, agg10mmKg: 414, admixtureKg: 5, totalDensity: 2400 },
  'M45': { grade: 'M45', targetMpa: 53.3, wcr: 0.23, cementKg: 440, mineralAdmixtureKg: 130, waterLitres: 132, mSandKg: 660, agg20mmKg: 619, agg10mmKg: 414, admixtureKg: 5, totalDensity: 2400 },
  'M50': { grade: 'M50', targetMpa: 58.3, wcr: 0.22, cementKg: 460, mineralAdmixtureKg: 135, waterLitres: 130, mSandKg: 641, agg20mmKg: 617, agg10mmKg: 411, admixtureKg: 6, totalDensity: 2400 }
};

const DEFAULT_RECIPES_GGBS: Record<string, MixRecipe> = {
  'M15': { grade: 'M15', targetMpa: 20.8, wcr: 0.44, cementKg: 250, mineralAdmixtureKg: 100, waterLitres: 155, mSandKg: 805, agg20mmKg: 653, agg10mmKg: 435, admixtureKg: 2, totalDensity: 2400 },
  'M20': { grade: 'M20', targetMpa: 26.6, wcr: 0.36, cementKg: 300, mineralAdmixtureKg: 120, waterLitres: 152, mSandKg: 765, agg20mmKg: 636, agg10mmKg: 424, admixtureKg: 3, totalDensity: 2400 },
  'M25': { grade: 'M25', targetMpa: 31.6, wcr: 0.30, cementKg: 350, mineralAdmixtureKg: 140, waterLitres: 148, mSandKg: 721, agg20mmKg: 623, agg10mmKg: 415, admixtureKg: 3, totalDensity: 2400 },
  'M30': { grade: 'M30', targetMpa: 38.3, wcr: 0.27, cementKg: 380, mineralAdmixtureKg: 150, waterLitres: 145, mSandKg: 693, agg20mmKg: 617, agg10mmKg: 411, admixtureKg: 4, totalDensity: 2400 },
  'M35': { grade: 'M35', targetMpa: 43.3, wcr: 0.25, cementKg: 400, mineralAdmixtureKg: 160, waterLitres: 140, mSandKg: 672, agg20mmKg: 614, agg10mmKg: 410, admixtureKg: 4, totalDensity: 2400 },
  'M40': { grade: 'M40', targetMpa: 48.3, wcr: 0.23, cementKg: 420, mineralAdmixtureKg: 170, waterLitres: 138, mSandKg: 645, agg20mmKg: 613, agg10mmKg: 409, admixtureKg: 5, totalDensity: 2400 },
  'M45': { grade: 'M45', targetMpa: 53.3, wcr: 0.22, cementKg: 440, mineralAdmixtureKg: 180, waterLitres: 135, mSandKg: 624, agg20mmKg: 610, agg10mmKg: 406, admixtureKg: 5, totalDensity: 2400 },
  'M50': { grade: 'M50', targetMpa: 58.3, wcr: 0.21, cementKg: 460, mineralAdmixtureKg: 190, waterLitres: 132, mSandKg: 602, agg20mmKg: 606, agg10mmKg: 404, admixtureKg: 6, totalDensity: 2400 }
};

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'DEFAULT';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

export const MixDesignModule: React.FC = () => {
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
  const canModifyMixes = userRole === 'ADMIN';

  const getActiveSiteKey = (): string => {
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

  const getSiteModeKey = (site: string) => `concrete360_admixture_mode_${site}`;
  const getSiteMixKey = (site: string, mode: AdmixtureMode) => `concrete360_mixes_${site}_${mode}`;

  // Read site-specific saved admixture choice
  const [admixtureMode, setAdmixtureMode] = useState<AdmixtureMode>(() => {
    try {
      const site = getActiveSiteKey();
      const saved = localStorage.getItem(`concrete360_admixture_mode_${site}`) || localStorage.getItem('concrete360_admixture_mode');
      if (saved === 'GGBS' || saved === 'FLY_ASH') return saved;
    } catch {}
    return 'FLY_ASH';
  });

  const getInitialMixes = (site: string, mode: AdmixtureMode): Record<string, MixRecipe> => {
    try {
      const saved = localStorage.getItem(getSiteMixKey(site, mode));
      if (saved) return JSON.parse(saved);
    } catch {}
    return mode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH : DEFAULT_RECIPES_GGBS;
  };

  const [mixes, setMixes] = useState<Record<string, MixRecipe>>(() => getInitialMixes(currentSiteKey, admixtureMode));
  const [activeGrade, setActiveGrade] = useState<string>('M15');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<MixRecipe>(mixes['M15'] || DEFAULT_RECIPES_FLY_ASH['M15']);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync site switches: load the specific site's Fly Ash/GGBS state
  const handleSiteSync = () => {
    const newSite = getActiveSiteKey();
    setCurrentSiteKey(newSite);

    let siteMode: AdmixtureMode = 'FLY_ASH';
    try {
      const savedMode = localStorage.getItem(getSiteModeKey(newSite)) || localStorage.getItem('concrete360_admixture_mode');
      if (savedMode === 'GGBS' || savedMode === 'FLY_ASH') {
        siteMode = savedMode;
      }
    } catch {}

    setAdmixtureMode(siteMode);
    const siteMixes = getInitialMixes(newSite, siteMode);
    setMixes(siteMixes);
    setIsEditing(false);
    setEditForm(siteMixes[activeGrade] || (siteMode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH[activeGrade] : DEFAULT_RECIPES_GGBS[activeGrade]));
  };

  useEffect(() => {
    window.addEventListener('concrete360_site_switched', handleSiteSync);
    window.addEventListener('storage', handleSiteSync);
    window.addEventListener('focus', handleSiteSync);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSiteSync);
      window.removeEventListener('storage', handleSiteSync);
      window.removeEventListener('focus', handleSiteSync);
    };
  }, [activeGrade]);

  // Switch between Fly Ash and GGBS Mode and persist to current site
  const handleModeSwitch = (newMode: AdmixtureMode) => {
    setAdmixtureMode(newMode);
    try {
      localStorage.setItem(getSiteModeKey(currentSiteKey), newMode);
      localStorage.setItem('concrete360_admixture_mode', newMode); // Global mirror
    } catch {}

    const newMixes = getInitialMixes(currentSiteKey, newMode);
    setMixes(newMixes);
    setIsEditing(false);
    setEditForm(newMixes[activeGrade] || (newMode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH[activeGrade] : DEFAULT_RECIPES_GGBS[activeGrade]));
    setSuccessMessage(`Switched ${currentSiteKey} to ${newMode === 'FLY_ASH' ? 'FLY ASH' : 'GGBS'} mode (2400 kg/m³ Yield)!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Broadcast and persist recipes per site
  useEffect(() => {
    try {
      localStorage.setItem(getSiteMixKey(currentSiteKey, admixtureMode), JSON.stringify(mixes));
      localStorage.setItem(getSiteModeKey(currentSiteKey), admixtureMode);
      localStorage.setItem('concrete360_admixture_mode', admixtureMode);

      const arr = Object.values(mixes).map(m => ({
        grade: m.grade,
        code: m.grade,
        admixtureMode,
        siteKey: currentSiteKey,
        cementKgPerM3: m.cementKg,
        flyAshKgPerM3: admixtureMode === 'FLY_ASH' ? m.mineralAdmixtureKg : 0,
        ggbsKgPerM3: admixtureMode === 'GGBS' ? m.mineralAdmixtureKg : 0,
        mineralAdmixtureKg: m.mineralAdmixtureKg,
        waterLitresPerM3: m.waterLitres,
        mSandKgPerM3: m.mSandKg,
        agg20mmKgPerM3: m.agg20mmKg,
        agg10mmKgPerM3: m.agg10mmKg,
        admixtureKgPerM3: m.admixtureKg,
        totalDensity: 2400
      }));

      localStorage.setItem('concrete360_mix_designs', JSON.stringify(arr));
      localStorage.setItem(`concrete360_mix_designs_${currentSiteKey}`, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('concrete360_mix_designs_updated', { detail: arr }));
    } catch {}
  }, [mixes, admixtureMode, currentSiteKey]);

  const currentMix = mixes[activeGrade] || (admixtureMode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH[activeGrade] : DEFAULT_RECIPES_GGBS[activeGrade]);

  const handleStartEdit = () => {
    if (!canModifyMixes) {
      alert('Permission Denied: Only ADMIN accounts can modify concrete mix design proportions.');
      return;
    }
    setEditForm({ ...currentMix });
    setIsEditing(true);
  };

  // Recalculates aggregate quantities so total weight is strictly 2400 kg/m³
  const balanceAggregatesTo2400 = (baseForm: MixRecipe): MixRecipe => {
    const fixedWeight = baseForm.cementKg + baseForm.mineralAdmixtureKg + baseForm.waterLitres + baseForm.admixtureKg;
    const remainingAggregateWeight = Math.max(0, 2400 - fixedWeight);
    
    // Balanced split: M-Sand 40%, CA 20mm 36% (60% of CA), CA 10mm 24% (40% of CA)
    const mSand = Math.round(remainingAggregateWeight * 0.403);
    const coarseTotal = remainingAggregateWeight - mSand;
    const agg20mm = Math.round(coarseTotal * 0.60);
    const agg10mm = coarseTotal - agg20mm;

    const totalBinder = baseForm.cementKg + baseForm.mineralAdmixtureKg;
    const calculatedWcr = totalBinder > 0 ? Number((baseForm.waterLitres / totalBinder).toFixed(2)) : 0.35;

    return {
      ...baseForm,
      mSandKg: mSand,
      agg20mmKg: agg20mm,
      agg10mmKg: agg10mm,
      wcr: calculatedWcr,
      totalDensity: 2400
    };
  };

  const applyPceWaterReduction = (currentPceKg: number) => {
    const baselineWater = 185;
    const reductionPercent = Math.min(28, Math.max(12, currentPceKg * 4.8));
    const reducedWater = Math.round(baselineWater * (1 - reductionPercent / 100));

    const updated = balanceAggregatesTo2400({
      ...editForm,
      waterLitres: reducedWater,
      admixtureKg: currentPceKg
    });

    setEditForm(updated);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyMixes) return;

    const finalBalanced = balanceAggregatesTo2400(editForm);

    setMixes(prev => ({
      ...prev,
      [activeGrade]: { ...finalBalanced }
    }));
    setIsEditing(false);
    setSuccessMessage(`Mix design for ${activeGrade} saved with exact 2400 kg/m³ yield!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleResetMix = () => {
    if (!canModifyMixes) {
      alert('Permission Denied: Only ADMIN accounts can reset mix designs.');
      return;
    }
    const defaultDict = admixtureMode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH : DEFAULT_RECIPES_GGBS;
    if (window.confirm(`Reset ${activeGrade} (${admixtureMode}) to default 2400 kg/m³ proportions for site ${currentSiteKey}?`)) {
      const defaultVal = defaultDict[activeGrade];
      setMixes(prev => ({
        ...prev,
        [activeGrade]: { ...defaultVal }
      }));
      setSuccessMessage(`${activeGrade} successfully reset to ${admixtureMode} defaults!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const totalCementitious = currentMix.cementKg + currentMix.mineralAdmixtureKg;

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Header & Admixture Commander */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
            SITE BATCH SPECIFICATION: {currentSiteKey} • TARGET YIELD: 2400 KG/M³
          </span>
          <h2 className="text-xl font-black text-white mt-1">Ready-Mix Concrete Grades &amp; Batching Standards</h2>
        </div>

        {/* Command Switch: Site-Saved Admixture Preference */}
        <div className="bg-[#070d1a] border border-[#1b273d] p-1.5 rounded-2xl flex items-center gap-1.5 shadow-xl font-mono shrink-0">
          <div className="px-3 py-1 flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>COMMAND:</span>
          </div>

          <button
            onClick={() => handleModeSwitch('FLY_ASH')}
            disabled={!canModifyMixes && userRole === 'READ_ONLY'}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              admixtureMode === 'FLY_ASH'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#121c2d]'
            }`}
          >
            <span>USE FLY ASH</span>
          </button>

          <button
            onClick={() => handleModeSwitch('GGBS')}
            disabled={!canModifyMixes && userRole === 'READ_ONLY'}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              admixtureMode === 'GGBS'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#121c2d]'
            }`}
          >
            <span>USE GGBS</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grade Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 font-mono">
        {Object.keys(DEFAULT_RECIPES_FLY_ASH).map((gradeKey) => {
          const m = mixes[gradeKey] || (admixtureMode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH[gradeKey] : DEFAULT_RECIPES_GGBS[gradeKey]);
          const isActive = activeGrade === gradeKey;
          return (
            <button
              key={gradeKey}
              onClick={() => {
                setActiveGrade(gradeKey);
                setIsEditing(false);
              }}
              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/30 text-white font-bold'
                  : 'bg-[#0b1322] border-[#1b273d] text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="text-base font-black tracking-wider">{gradeKey}</div>
              <div className={`text-[10px] mt-1 ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                Target: {m.targetMpa} MPa
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Mix Details Card */}
      <div className="bg-[#0b1322] border border-[#1b273d] p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1b273d] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                CONSTITUENT PROPORTIONS FOR {activeGrade} GRADE (1 M³) — {admixtureMode === 'FLY_ASH' ? 'FLY ASH BLEND' : 'GGBS BLEND'}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Site: <strong className="text-white">{currentSiteKey}</strong> | Total Binder: <strong className="text-white">{totalCementitious} kg</strong> | w/b: <strong className="text-emerald-400 font-bold">{currentMix.wcr}</strong> | Total Yield: <strong className="text-cyan-300 font-bold">2400 kg/m³</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canModifyMixes ? (
              !isEditing ? (
                <>
                  <button
                    onClick={handleStartEdit}
                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-mono transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Mix</span>
                  </button>
                  <button
                    onClick={handleResetMix}
                    className="px-4 py-2 bg-[#121c2d] hover:bg-[#1a263d] text-cyan-400 border border-cyan-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-mono transition"
                    title={`Reset to Default ${admixtureMode} Proportions`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-[#121c2d] hover:bg-[#1a263d] text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-mono transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )
            ) : (
              <span className="text-slate-500 text-xs inline-flex items-center gap-1.5 font-mono bg-[#070d1a] border border-[#1b273d] px-3 py-1.5 rounded-xl">
                <Lock className="w-3.5 h-3.5" />
                <span>Read-Only Proportions</span>
              </span>
            )}
          </div>
        </div>

        {!isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">OPC 53 CEMENT</span>
              <div className="text-2xl font-extrabold text-blue-400">{currentMix.cementKg} kg</div>
              <span className="text-[11px] text-slate-500 block">({Math.round(currentMix.cementKg / 50)} Bags @ 50kg) • Primary Binder</span>
            </div>

            {admixtureMode === 'FLY_ASH' ? (
              <div className="p-5 bg-[#070d1a] border border-purple-500/30 bg-purple-950/10 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">CLASS F FLY ASH</span>
                <div className="text-2xl font-extrabold text-purple-300">{currentMix.mineralAdmixtureKg} kg</div>
                <span className="text-[11px] text-slate-500 block">Spherical Micro-Pozzolan (IS 3812)</span>
              </div>
            ) : (
              <div className="p-5 bg-[#070d1a] border border-indigo-500/30 bg-indigo-950/10 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">GGBS (SLAG BINDER)</span>
                <div className="text-2xl font-extrabold text-indigo-300">{currentMix.mineralAdmixtureKg} kg</div>
                <span className="text-[11px] text-slate-500 block">Slag Micro-Binder (IS 12089)</span>
              </div>
            )}

            <div className="p-5 bg-[#070d1a] border border-cyan-500/30 bg-cyan-950/10 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">BATCHING WATER</span>
                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-sans">Reduced</span>
              </div>
              <div className="text-2xl font-extrabold text-cyan-300">{currentMix.waterLitres} Litres</div>
              <span className="text-[11px] text-slate-400 block">Free Mixing Water (w/b: {currentMix.wcr})</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">M-SAND (ZONE II)</span>
              <div className="text-2xl font-extrabold text-amber-400">{currentMix.mSandKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Manufactured Fine Sand</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">20 MM AGGREGATE (60%)</span>
              <div className="text-2xl font-extrabold text-emerald-400">{currentMix.agg20mmKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Coarse Granite Fraction</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">10 MM AGGREGATE (40%)</span>
              <div className="text-2xl font-extrabold text-emerald-400">{currentMix.agg10mmKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Down-size Fraction</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1 sm:col-span-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PCE ADMIXTURE (WATER REDUCER)</span>
              <div className="text-2xl font-extrabold text-rose-400">{currentMix.admixtureKg} kg</div>
              <span className="text-[11px] text-emerald-400 font-bold block">Strict Yield Target: 2400 kg/m³</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveEdit} className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">Target Strength (MPa)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.targetMpa}
                  onChange={(e) => setEditForm({ ...editForm, targetMpa: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">Water-Binder Ratio (w/b)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.wcr}
                  disabled
                  className="w-full px-4 py-3 bg-[#0c1626] border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-cyan-400 font-bold uppercase text-[10px]">Total Design Yield (kg/m³)</label>
                <input
                  type="number"
                  value={2400}
                  disabled
                  className="w-full px-4 py-3 bg-[#0c1626] border border-cyan-500/30 rounded-xl text-cyan-300 font-black outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">OPC 53 Cement (kg/m³)</label>
                <input
                  type="number"
                  value={editForm.cementKg}
                  onChange={(e) => {
                    const c = Number(e.target.value) || 0;
                    setEditForm(balanceAggregatesTo2400({ ...editForm, cementKg: c }));
                  }}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-blue-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className={`font-bold uppercase text-[10px] ${admixtureMode === 'FLY_ASH' ? 'text-purple-400' : 'text-indigo-400'}`}>
                  {admixtureMode === 'FLY_ASH' ? 'Class F Fly Ash (kg/m³)' : 'GGBS (kg/m³)'}
                </label>
                <input
                  type="number"
                  value={editForm.mineralAdmixtureKg}
                  onChange={(e) => {
                    const m = Number(e.target.value) || 0;
                    setEditForm(balanceAggregatesTo2400({ ...editForm, mineralAdmixtureKg: m }));
                  }}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-cyan-400 font-bold uppercase text-[10px]">Batching Water (L/m³)</label>
                  <button
                    type="button"
                    onClick={() => applyPceWaterReduction(editForm.admixtureKg)}
                    className="text-[9px] text-cyan-300 hover:text-white flex items-center gap-1 cursor-pointer underline"
                  >
                    <Droplets className="w-2.5 h-2.5" />
                    <span>Auto-Reduce</span>
                  </button>
                </div>
                <input
                  type="number"
                  value={editForm.waterLitres}
                  onChange={(e) => {
                    const w = Number(e.target.value) || 0;
                    setEditForm(balanceAggregatesTo2400({ ...editForm, waterLitres: w }));
                  }}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-amber-400 font-bold uppercase text-[10px]">M-Sand (Auto-Balanced to 2400)</label>
                <input
                  type="number"
                  value={editForm.mSandKg}
                  disabled
                  className="w-full px-4 py-3 bg-[#0c1626] border border-[#1b273d] rounded-xl text-amber-300 font-bold outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-emerald-400 font-bold uppercase text-[10px]">20 MM (Auto-Balanced 60%)</label>
                <input
                  type="number"
                  value={editForm.agg20mmKg}
                  disabled
                  className="w-full px-4 py-3 bg-[#0c1626] border border-[#1b273d] rounded-xl text-emerald-300 font-bold outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-emerald-400 font-bold uppercase text-[10px]">10 MM (Auto-Balanced 40%)</label>
                <input
                  type="number"
                  value={editForm.agg10mmKg}
                  disabled
                  className="w-full px-4 py-3 bg-[#0c1626] border border-[#1b273d] rounded-xl text-emerald-300 font-bold outline-none cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-3 space-y-1 bg-[#070d1a] border border-[#1b273d] p-3 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-rose-400 font-bold uppercase text-[10px]">PCE Admixture / Water Reducer (kg/m³)</label>
                  <span className="text-[10px] text-slate-400 font-sans">
                    Water drops automatically and aggregates scale to preserve 2400 kg/m³
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={editForm.admixtureKg}
                  onChange={(e) => {
                    const adm = Number(e.target.value) || 0;
                    applyPceWaterReduction(adm);
                  }}
                  className="w-full px-4 py-3 bg-[#0b1322] border border-[#1b273d] rounded-xl text-rose-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#1b273d]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-3 bg-[#070d1a] hover:bg-[#121c2d] text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Mix Proportions (2400 kg/m³)</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default MixDesignModule;
