import React, { useState, useEffect } from 'react';
import { Layers, Edit2, Save, X, Check, RotateCcw, Lock, SlidersHorizontal, Zap } from 'lucide-react';

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

// Default recipes for FLY ASH (IS 3812) and GGBS (IS 12089)
const DEFAULT_RECIPES_FLY_ASH: Record<string, MixRecipe> = {
  'M15': { grade: 'M15', targetMpa: 20.8, wcr: 0.50, cementKg: 250, mineralAdmixtureKg: 75, waterLitres: 165, mSandKg: 815, agg20mmKg: 645, agg10mmKg: 430, admixtureKg: 2.0, totalDensity: 2382 },
  'M20': { grade: 'M20', targetMpa: 26.6, wcr: 0.43, cementKg: 300, mineralAdmixtureKg: 90, waterLitres: 170, mSandKg: 780, agg20mmKg: 635, agg10mmKg: 425, admixtureKg: 3.0, totalDensity: 2403 },
  'M25': { grade: 'M25', targetMpa: 31.6, wcr: 0.38, cementKg: 350, mineralAdmixtureKg: 105, waterLitres: 172, mSandKg: 740, agg20mmKg: 630, agg10mmKg: 420, admixtureKg: 3.0, totalDensity: 2420 },
  'M30': { grade: 'M30', targetMpa: 38.3, wcr: 0.35, cementKg: 380, mineralAdmixtureKg: 115, waterLitres: 170, mSandKg: 720, agg20mmKg: 635, agg10mmKg: 425, admixtureKg: 4.0, totalDensity: 2449 },
  'M35': { grade: 'M35', targetMpa: 43.3, wcr: 0.32, cementKg: 400, mineralAdmixtureKg: 120, waterLitres: 165, mSandKg: 705, agg20mmKg: 640, agg10mmKg: 425, admixtureKg: 4.0, totalDensity: 2458 },
  'M40': { grade: 'M40', targetMpa: 48.3, wcr: 0.30, cementKg: 420, mineralAdmixtureKg: 125, waterLitres: 160, mSandKg: 690, agg20mmKg: 645, agg10mmKg: 430, admixtureKg: 5.0, totalDensity: 2475 },
  'M45': { grade: 'M45', targetMpa: 53.3, wcr: 0.28, cementKg: 440, mineralAdmixtureKg: 130, waterLitres: 155, mSandKg: 675, agg20mmKg: 650, agg10mmKg: 435, admixtureKg: 5.0, totalDensity: 2490 },
  'M50': { grade: 'M50', targetMpa: 58.3, wcr: 0.26, cementKg: 460, mineralAdmixtureKg: 135, waterLitres: 153, mSandKg: 660, agg20mmKg: 655, agg10mmKg: 440, admixtureKg: 5.5, totalDensity: 2508 }
};

const DEFAULT_RECIPES_GGBS: Record<string, MixRecipe> = {
  'M15': { grade: 'M15', targetMpa: 20.8, wcr: 0.49, cementKg: 250, mineralAdmixtureKg: 100, waterLitres: 170, mSandKg: 795, agg20mmKg: 640, agg10mmKg: 430, admixtureKg: 2.0, totalDensity: 2387 },
  'M20': { grade: 'M20', targetMpa: 26.6, wcr: 0.43, cementKg: 300, mineralAdmixtureKg: 120, waterLitres: 175, mSandKg: 760, agg20mmKg: 635, agg10mmKg: 425, admixtureKg: 3.0, totalDensity: 2418 },
  'M25': { grade: 'M25', targetMpa: 31.6, wcr: 0.38, cementKg: 350, mineralAdmixtureKg: 140, waterLitres: 175, mSandKg: 720, agg20mmKg: 630, agg10mmKg: 420, admixtureKg: 3.0, totalDensity: 2438 },
  'M30': { grade: 'M30', targetMpa: 38.3, wcr: 0.35, cementKg: 380, mineralAdmixtureKg: 150, waterLitres: 172, mSandKg: 700, agg20mmKg: 635, agg10mmKg: 425, admixtureKg: 4.0, totalDensity: 2466 },
  'M35': { grade: 'M35', targetMpa: 43.3, wcr: 0.31, cementKg: 400, mineralAdmixtureKg: 160, waterLitres: 168, mSandKg: 685, agg20mmKg: 640, agg10mmKg: 425, admixtureKg: 4.0, totalDensity: 2482 },
  'M40': { grade: 'M40', targetMpa: 48.3, wcr: 0.29, cementKg: 420, mineralAdmixtureKg: 170, waterLitres: 162, mSandKg: 670, agg20mmKg: 645, agg10mmKg: 430, admixtureKg: 5.0, totalDensity: 2502 },
  'M45': { grade: 'M45', targetMpa: 53.3, wcr: 0.27, cementKg: 440, mineralAdmixtureKg: 180, waterLitres: 156, mSandKg: 655, agg20mmKg: 650, agg10mmKg: 435, admixtureKg: 5.0, totalDensity: 2521 },
  'M50': { grade: 'M50', targetMpa: 58.3, wcr: 0.25, cementKg: 460, mineralAdmixtureKg: 190, waterLitres: 152, mSandKg: 640, agg20mmKg: 655, agg10mmKg: 440, admixtureKg: 5.5, totalDensity: 2542 }
};

const MODE_STORAGE_KEY = 'concrete360_admixture_mode';
const STORAGE_PREFIX = 'concrete360_mix_designs_';

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

  // Active Mineral Admixture Mode Command: 'FLY_ASH' or 'GGBS'
  const [admixtureMode, setAdmixtureMode] = useState<AdmixtureMode>(() => {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      if (saved === 'GGBS' || saved === 'FLY_ASH') return saved;
    } catch {}
    return 'FLY_ASH';
  });

  const getInitialMixes = (mode: AdmixtureMode): Record<string, MixRecipe> => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${mode}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return mode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH : DEFAULT_RECIPES_GGBS;
  };

  const [mixes, setMixes] = useState<Record<string, MixRecipe>>(() => getInitialMixes(admixtureMode));
  const [activeGrade, setActiveGrade] = useState<string>('M15');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<MixRecipe>(mixes['M15'] || DEFAULT_RECIPES_FLY_ASH['M15']);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Switch between Fly Ash and GGBS Mode
  const handleModeSwitch = (newMode: AdmixtureMode) => {
    setAdmixtureMode(newMode);
    localStorage.setItem(MODE_STORAGE_KEY, newMode);
    const newMixes = getInitialMixes(newMode);
    setMixes(newMixes);
    setIsEditing(false);
    setEditForm(newMixes[activeGrade] || (newMode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH[activeGrade] : DEFAULT_RECIPES_GGBS[activeGrade]));
    setSuccessMessage(`Switched batching command to ${newMode === 'FLY_ASH' ? 'FLY ASH' : 'GGBS'} mode!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${admixtureMode}`, JSON.stringify(mixes));

      // Broadcast mix design recipes for billing, dockets, and plant inventory
      const arr = Object.values(mixes).map(m => ({
        grade: m.grade,
        code: m.grade,
        admixtureMode,
        cementKgPerM3: m.cementKg,
        flyAshKgPerM3: admixtureMode === 'FLY_ASH' ? m.mineralAdmixtureKg : 0,
        ggbsKgPerM3: admixtureMode === 'GGBS' ? m.mineralAdmixtureKg : 0,
        waterLitresPerM3: m.waterLitres,
        mSandKgPerM3: m.mSandKg,
        agg20mmKgPerM3: m.agg20mmKg,
        agg10mmKgPerM3: m.agg10mmKg,
        admixtureKgPerM3: m.admixtureKg
      }));
      localStorage.setItem('concrete360_mix_designs', JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('concrete360_mix_designs_updated', { detail: arr }));
    } catch {}
  }, [mixes, admixtureMode]);

  const currentMix = mixes[activeGrade] || (admixtureMode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH[activeGrade] : DEFAULT_RECIPES_GGBS[activeGrade]);

  const handleStartEdit = () => {
    if (!canModifyMixes) {
      alert('Permission Denied: Only ADMIN accounts can modify concrete mix design proportions.');
      return;
    }
    setEditForm({ ...currentMix });
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyMixes) return;

    setMixes(prev => ({
      ...prev,
      [activeGrade]: { ...editForm }
    }));
    setIsEditing(false);
    setSuccessMessage(`Mix design for ${activeGrade} (${admixtureMode}) successfully updated!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleResetMix = () => {
    if (!canModifyMixes) {
      alert('Permission Denied: Only ADMIN accounts can reset mix designs.');
      return;
    }
    const defaultDict = admixtureMode === 'FLY_ASH' ? DEFAULT_RECIPES_FLY_ASH : DEFAULT_RECIPES_GGBS;
    if (window.confirm(`Reset ${activeGrade} (${admixtureMode}) to original factory default proportions?`)) {
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
            MATERIAL &amp; MIX SPECIFICATION CATALOG (IS 10262:2019 / IS 456:2000)
          </span>
          <h2 className="text-xl font-black text-white mt-1">Ready-Mix Concrete Grades &amp; Batching Standards</h2>
        </div>

        {/* Power to Command: One-click Switch between Fly Ash & GGBS */}
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
                Total Cementitious: <strong className="text-white">{totalCementitious} kg</strong> | Water-Cement Ratio: <strong className="text-amber-400 font-bold">{currentMix.wcr}</strong>
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

        {/* 7 Clean Cards Display */}
        {!isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            {/* OPC 53 Cement */}
            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">OPC 53 CEMENT</span>
              <div className="text-2xl font-extrabold text-blue-400">{currentMix.cementKg} kg</div>
              <span className="text-[11px] text-slate-500 block">({Math.round(currentMix.cementKg / 50)} Bags @ 50kg) • Primary Binder</span>
            </div>

            {/* Selected Mineral Admixture: Either Fly Ash or GGBS */}
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

            {/* Batching Water */}
            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BATCHING WATER</span>
              <div className="text-2xl font-extrabold text-cyan-400">{currentMix.waterLitres} Litres</div>
              <span className="text-[11px] text-slate-500 block">Free Mixing Water</span>
            </div>

            {/* M-Sand */}
            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">M-SAND (ZONE II)</span>
              <div className="text-2xl font-extrabold text-amber-400">{currentMix.mSandKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Manufactured Fine Sand</span>
            </div>

            {/* 20 MM Aggregate */}
            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">20 MM AGGREGATE (60%)</span>
              <div className="text-2xl font-extrabold text-emerald-400">{currentMix.agg20mmKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Coarse Granite Fraction</span>
            </div>

            {/* 10 MM Aggregate */}
            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">10 MM AGGREGATE (40%)</span>
              <div className="text-2xl font-extrabold text-emerald-400">{currentMix.agg10mmKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Down-size Fraction</span>
            </div>

            {/* PCE Admixture */}
            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1 sm:col-span-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PCE ADMIXTURE</span>
              <div className="text-2xl font-extrabold text-rose-400">{currentMix.admixtureKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Superplasticizer • Total Mix Density: {currentMix.totalDensity} kg/m³</span>
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
                <label className="text-slate-300 font-bold uppercase text-[10px]">Water-Cement Ratio (w/c)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.wcr}
                  onChange={(e) => setEditForm({ ...editForm, wcr: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-amber-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">Total Density (kg/m³)</label>
                <input
                  type="number"
                  value={editForm.totalDensity}
                  onChange={(e) => setEditForm({ ...editForm, totalDensity: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">OPC 53 Cement (kg/m³)</label>
                <input
                  type="number"
                  value={editForm.cementKg}
                  onChange={(e) => setEditForm({ ...editForm, cementKg: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-blue-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Editable input reflects active command */}
              <div className="space-y-1">
                <label className={`font-bold uppercase text-[10px] ${admixtureMode === 'FLY_ASH' ? 'text-purple-400' : 'text-indigo-400'}`}>
                  {admixtureMode === 'FLY_ASH' ? 'Class F Fly Ash (kg/m³)' : 'GGBS (kg/m³)'}
                </label>
                <input
                  type="number"
                  value={editForm.mineralAdmixtureKg}
                  onChange={(e) => setEditForm({ ...editForm, mineralAdmixtureKg: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">Batching Water (Litres/m³)</label>
                <input
                  type="number"
                  value={editForm.waterLitres}
                  onChange={(e) => setEditForm({ ...editForm, waterLitres: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">M-Sand (kg/m³)</label>
                <input
                  type="number"
                  value={editForm.mSandKg}
                  onChange={(e) => setEditForm({ ...editForm, mSandKg: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-amber-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">20 MM Aggregate (kg/m³)</label>
                <input
                  type="number"
                  value={editForm.agg20mmKg}
                  onChange={(e) => setEditForm({ ...editForm, agg20mmKg: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">10 MM Aggregate (kg/m³)</label>
                <input
                  type="number"
                  value={editForm.agg10mmKg}
                  onChange={(e) => setEditForm({ ...editForm, agg10mmKg: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">PCE Admixture (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.admixtureKg}
                  onChange={(e) => setEditForm({ ...editForm, admixtureKg: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-rose-400 font-bold outline-none focus:border-blue-500"
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
                <span>Save Mix Proportions</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default MixDesignModule;
