import React, { useState, useEffect } from 'react';
import { Layers, Edit2, Save, X, Check, RotateCcw, Lock, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cloudStorage } from '../../services/cloudStorage';

export type AdmixtureMode = 'GGBS' | 'FLY_ASH';

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

// Bilgi Buildcon RMC 1 m³ Quality Assurance Standards (Rev. 2, Yield: 2,400.0 kg/m³)
export const BILGI_QA_REV2_GGBS: Record<string, MixRecipe> = {
  'M10': { grade: 'M10', targetMpa: 15.0, wcr: 0.65, cementKg: 168, mineralAdmixtureKg: 42, waterLitres: 136, mSandKg: 1057, agg20mmKg: 597, agg10mmKg: 398, admixtureKg: 1.68, totalDensity: 2400 },
  'M15': { grade: 'M15', targetMpa: 20.8, wcr: 0.56, cementKg: 200, mineralAdmixtureKg: 50, waterLitres: 140, mSandKg: 1034, agg20mmKg: 584, agg10mmKg: 390, admixtureKg: 2.00, totalDensity: 2400 },
  'M20': { grade: 'M20', targetMpa: 26.6, wcr: 0.49, cementKg: 240, mineralAdmixtureKg: 60, waterLitres: 147, mSandKg: 1005, agg20mmKg: 567, agg10mmKg: 379, admixtureKg: 2.40, totalDensity: 2400 },
  'M25': { grade: 'M25', targetMpa: 31.6, wcr: 0.45, cementKg: 280, mineralAdmixtureKg: 70, waterLitres: 158, mSandKg: 973, agg20mmKg: 550, agg10mmKg: 366, admixtureKg: 2.80, totalDensity: 2400 },
  'M30': { grade: 'M30', targetMpa: 38.3, wcr: 0.42, cementKg: 304, mineralAdmixtureKg: 76, waterLitres: 160, mSandKg: 956, agg20mmKg: 541, agg10mmKg: 360, admixtureKg: 3.04, totalDensity: 2400 },
  'M35': { grade: 'M35', targetMpa: 43.3, wcr: 0.40, cementKg: 320, mineralAdmixtureKg: 80, waterLitres: 160, mSandKg: 946, agg20mmKg: 535, agg10mmKg: 356, admixtureKg: 3.20, totalDensity: 2400 },
  'M40': { grade: 'M40', targetMpa: 48.3, wcr: 0.38, cementKg: 336, mineralAdmixtureKg: 84, waterLitres: 160, mSandKg: 936, agg20mmKg: 529, agg10mmKg: 352, admixtureKg: 3.36, totalDensity: 2400 },
  'M45': { grade: 'M45', targetMpa: 53.3, wcr: 0.36, cementKg: 352, mineralAdmixtureKg: 88, waterLitres: 158, mSandKg: 928, agg20mmKg: 524, agg10mmKg: 349, admixtureKg: 3.52, totalDensity: 2400 },
  'M50': { grade: 'M50', targetMpa: 58.3, wcr: 0.34, cementKg: 368, mineralAdmixtureKg: 92, waterLitres: 156, mSandKg: 921, agg20mmKg: 520, agg10mmKg: 346, admixtureKg: 3.68, totalDensity: 2400 }
};

// Kept as an alias so other modules importing BILGI_QA_REV2_FLY_ASH do not break the build
export const BILGI_QA_REV2_FLY_ASH: Record<string, MixRecipe> = BILGI_QA_REV2_GGBS;

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'BASVARAJ';
  let clean = String(name).trim();
  if (clean.includes('(')) clean = clean.split('(')[0].trim();
  return clean.toUpperCase();
};

export const MixDesignModule: React.FC = () => {
  const getUserRole = (): 'ADMIN' | 'EMPLOYEE' | 'READ_ONLY' => {
    try {
      const userRaw = sessionStorage.getItem('concrete360_user') || localStorage.getItem('concrete360_user');
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
  const canModifyMixes = userRole === 'ADMIN' || userRole === 'EMPLOYEE';

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
      const selected = sessionStorage.getItem('concrete360_selected_site') || localStorage.getItem('concrete360_selected_site');
      if (selected) return extractCleanSiteName(selected);
    } catch {}
    return 'BASVARAJ';
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(getActiveSiteKey());

  const getSiteModeKey = (site: string) => `concrete360_admixture_mode_${site}`;
  const getSiteMixKey = (site: string) => `concrete360_mixes_${site}_GGBS`;

  const getInitialMixes = (site: string): Record<string, MixRecipe> => {
    try {
      const saved = localStorage.getItem(getSiteMixKey(site));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return { ...BILGI_QA_REV2_GGBS };
  };

  const [mixes, setMixes] = useState<Record<string, MixRecipe>>(() => getInitialMixes(currentSiteKey));
  const [activeGrade, setActiveGrade] = useState<string>('M35');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<any>(mixes['M35'] || BILGI_QA_REV2_GGBS['M35']);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const syncActiveState = () => {
    if (isEditing) return;
    const site = getActiveSiteKey();
    setCurrentSiteKey(site);

    try {
      localStorage.setItem(getSiteModeKey(site), 'GGBS');
      localStorage.setItem('concrete360_admixture_mode', 'GGBS');
    } catch {}

    const resolvedMixes = getInitialMixes(site);
    setMixes(resolvedMixes);
    setEditForm(resolvedMixes[activeGrade] || BILGI_QA_REV2_GGBS[activeGrade]);
  };

  useEffect(() => {
    try {
      localStorage.setItem(getSiteModeKey(currentSiteKey), 'GGBS');
      localStorage.setItem('concrete360_admixture_mode', 'GGBS');
    } catch {}

    window.addEventListener('concrete360_site_switched', syncActiveState);
    return () => {
      window.removeEventListener('concrete360_site_switched', syncActiveState);
    };
  }, [activeGrade, isEditing, currentSiteKey]);

  const currentMix = mixes[activeGrade] || BILGI_QA_REV2_GGBS[activeGrade];

  const handleStartEdit = () => {
    if (!canModifyMixes) {
      alert('Permission Denied: Read-only accounts cannot modify mix designs.');
      return;
    }
    setEditForm({ ...currentMix });
    setIsEditing(true);
  };

  const handleInputChange = (field: keyof MixRecipe, rawVal: string) => {
    const val = rawVal === '' ? '' : Number(rawVal);
    setEditForm((prev: any) => {
      const next = { ...prev, [field]: val };

      const c = Number(next.cementKg) || 0;
      const m = Number(next.mineralAdmixtureKg) || 0;
      const w = Number(next.waterLitres) || 0;
      const ms = Number(next.mSandKg) || 0;
      const a20 = Number(next.agg20mmKg) || 0;
      const a10 = Number(next.agg10mmKg) || 0;
      const adm = Number(next.admixtureKg) || 0;

      const binder = c + m;
      const computedWcr = binder > 0 && w > 0 ? Number((w / binder).toFixed(2)) : next.wcr;
      const computedDensity = Math.round(c + m + w + ms + a20 + a10 + adm);

      return {
        ...next,
        wcr: field === 'wcr' ? val : computedWcr,
        totalDensity: field === 'totalDensity' ? val : computedDensity
      };
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyMixes) return;

    const finalForm: MixRecipe = {
      grade: activeGrade,
      targetMpa: Number(editForm.targetMpa) || currentMix.targetMpa,
      wcr: Number(editForm.wcr) || 0.45,
      cementKg: Number(editForm.cementKg) || 0,
      mineralAdmixtureKg: Number(editForm.mineralAdmixtureKg) || 0,
      waterLitres: Number(editForm.waterLitres) || 0,
      mSandKg: Number(editForm.mSandKg) || 0,
      agg20mmKg: Number(editForm.agg20mmKg) || 0,
      agg10mmKg: Number(editForm.agg10mmKg) || 0,
      admixtureKg: Number(editForm.admixtureKg) || 0,
      totalDensity: Number(editForm.totalDensity) || 2400
    };

    const updatedMixes = {
      ...mixes,
      [activeGrade]: finalForm
    };

    setMixes(updatedMixes);
    setIsEditing(false);

    try {
      localStorage.setItem(getSiteMixKey(currentSiteKey), JSON.stringify(updatedMixes));
      localStorage.setItem(getSiteModeKey(currentSiteKey), 'GGBS');
      localStorage.setItem('concrete360_admixture_mode', 'GGBS');

      const arr = Object.values(updatedMixes).map(m => ({
        grade: m.grade,
        code: m.grade,
        admixtureMode: 'GGBS',
        siteKey: currentSiteKey,
        cementKgPerM3: m.cementKg,
        flyAshKgPerM3: 0,
        ggbsKgPerM3: m.mineralAdmixtureKg,
        mineralAdmixtureKg: m.mineralAdmixtureKg,
        waterLitresPerM3: m.waterLitres,
        mSandKgPerM3: m.mSandKg,
        agg20mmKgPerM3: m.agg20mmKg,
        agg10mmKgPerM3: m.agg10mmKg,
        admixtureKgPerM3: m.admixtureKg,
        totalDensity: m.totalDensity
      }));

      localStorage.setItem('concrete360_mix_designs', JSON.stringify(arr));
      localStorage.setItem(`concrete360_mix_designs_${currentSiteKey}`, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('concrete360_mix_designs_updated', { detail: arr }));
    } catch {}

    if (supabase) {
      await (supabase as any).from('mix_designs').upsert({
        grade: finalForm.grade,
        target_mpa: finalForm.targetMpa,
        wcr: finalForm.wcr,
        cement_kg: finalForm.cementKg,
        mineral_admixture_kg: finalForm.mineralAdmixtureKg,
        water_litres: finalForm.waterLitres,
        m_sand_kg: finalForm.mSandKg,
        agg_20mm_kg: finalForm.agg20mmKg,
        agg_10mm_kg: finalForm.agg10mmKg,
        admixture_kg: finalForm.admixtureKg,
        total_density: finalForm.totalDensity,
        mode: 'GGBS',
        updated_at: new Date().toISOString()
      }, { onConflict: 'grade' });
      await cloudStorage.pullFromCloud();
    }

    setSuccessMessage(`Mix design for ${activeGrade} saved successfully!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleForceResetAll = () => {
    if (!canModifyMixes) return;
    if (window.confirm(`Reset all grade proportions to Bilgi QA Cards (Rev. 2) for ${currentSiteKey}?`)) {
      const freshMixes = { ...BILGI_QA_REV2_GGBS };
      setMixes(freshMixes);
      localStorage.setItem(getSiteMixKey(currentSiteKey), JSON.stringify(freshMixes));
      setEditForm(freshMixes[activeGrade]);
      setIsEditing(false);
      setSuccessMessage('Successfully loaded Bilgi Buildcon RMC QA Cards (Rev. 2)!');
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  };

  const totalCementitious = currentMix.cementKg + currentMix.mineralAdmixtureKg;

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Header & GGBS Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            BILGI BUILDCON RMC QA • 1 M³ BATCH PROPORTION CARDS (REV. 2)
          </span>
          <h2 className="text-xl font-black text-white mt-1">Ready-Mix Concrete Mix Proportioning & Quality Control</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleForceResetAll}
            className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-600/30 border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer"
            title="Reload Bilgi QA Rev. 2 Card Proportions"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Load QA Cards</span>
          </button>

          <div className="bg-[#070d1a] border border-[#1b273d] p-1.5 rounded-2xl flex items-center gap-1.5 shadow-xl font-mono shrink-0">
            <div className="px-3 py-1 flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>SILO 2:</span>
            </div>

            <div className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-lg shadow-purple-600/30 flex items-center gap-1.5">
              <span>GGBS (20%)</span>
            </div>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grade Selector Tabs: M10 to M50 */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 font-mono">
        {Object.keys(BILGI_QA_REV2_GGBS).map((gradeKey) => {
          const m = mixes[gradeKey] || BILGI_QA_REV2_GGBS[gradeKey];
          const isActive = activeGrade === gradeKey;
          return (
            <button
              key={gradeKey}
              type="button"
              onClick={() => {
                setActiveGrade(gradeKey);
                setIsEditing(false);
                setEditForm(m);
              }}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
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
                1 M³ BATCH PROPORTIONS FOR {activeGrade} GRADE (SSD CONDITION)
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Target Slump: <strong className="text-white">100-125 mm (3 Hr Retention)</strong> | Total Binder: <strong className="text-white">{totalCementitious} kg/m³</strong> | w/b: <strong className="text-emerald-400 font-bold">{currentMix.wcr}</strong> | Total Density: <strong className="text-cyan-300 font-bold">{currentMix.totalDensity || 2400} kg/m³</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canModifyMixes ? (
              !isEditing ? (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-mono transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Mix</span>
                </button>
              ) : (
                <button
                  type="button"
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
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">OPC 53 CEMENT (SILO 1)</span>
              <div className="text-2xl font-extrabold text-blue-400">{currentMix.cementKg} kg</div>
              <span className="text-[11px] text-slate-500 block">80% Total Binder (IS 269) • {(currentMix.cementKg / 50).toFixed(1)} Bags</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-purple-500/30 bg-purple-950/10 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                GROUND GRANULATED BLAST-FURNACE SLAG (SILO 2)
              </span>
              <div className="text-2xl font-extrabold text-purple-300">{currentMix.mineralAdmixtureKg} kg</div>
              <span className="text-[11px] text-slate-500 block">
                20% Binder Replacement (IS 16714)
              </span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-cyan-500/30 bg-cyan-950/10 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">DESIGN FREE WATER</span>
                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-sans">w/b {currentMix.wcr}</span>
              </div>
              <div className="text-2xl font-extrabold text-cyan-300">{currentMix.waterLitres} Litres</div>
              <span className="text-[11px] text-slate-400 block">Potable Water (IS 456 Table 2)</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">M-SAND (FINE AGGREGATE)</span>
              <div className="text-2xl font-extrabold text-amber-400">{currentMix.mSandKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Zone II Crushed Sand (51.5% Share)</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">20 MM AGGREGATE (60% CA)</span>
              <div className="text-2xl font-extrabold text-emerald-400">{currentMix.agg20mmKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Crushed Granite Stone</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">10 MM AGGREGATE (40% CA)</span>
              <div className="text-2xl font-extrabold text-emerald-400">{currentMix.agg10mmKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Crushed Granite Stone</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1 sm:col-span-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PCE ADMIXTURE (0.80% BINDER)</span>
              <div className="text-2xl font-extrabold text-rose-400">{currentMix.admixtureKg} kg</div>
              <span className="text-[11px] text-emerald-400 font-bold block">
                Approx. {(currentMix.admixtureKg / 1.08).toFixed(2)} Litres • Total Density: {currentMix.totalDensity || 2400} kg/m³
              </span>
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
                  value={editForm.targetMpa ?? ''}
                  onChange={(e) => handleInputChange('targetMpa', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">Water-Binder Ratio (w/b)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.wcr ?? ''}
                  onChange={(e) => handleInputChange('wcr', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-cyan-400 font-bold uppercase text-[10px]">Total Design Density (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.totalDensity ?? ''}
                  onChange={(e) => handleInputChange('totalDensity', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-cyan-500/30 rounded-xl text-cyan-300 font-black outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">OPC 53 Cement - Silo 1 (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.cementKg ?? ''}
                  onChange={(e) => handleInputChange('cementKg', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-blue-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold uppercase text-[10px] text-purple-400">
                  GGBS - Silo 2 (kg/m³)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editForm.mineralAdmixtureKg ?? ''}
                  onChange={(e) => handleInputChange('mineralAdmixtureKg', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-cyan-400 font-bold uppercase text-[10px]">Design Free Water (L/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.waterLitres ?? ''}
                  onChange={(e) => handleInputChange('waterLitres', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-amber-400 font-bold uppercase text-[10px]">M-Sand - Fine Aggregate (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.mSandKg ?? ''}
                  onChange={(e) => handleInputChange('mSandKg', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-amber-300 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-emerald-400 font-bold uppercase text-[10px]">20 MM Coarse Aggregate (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.agg20mmKg ?? ''}
                  onChange={(e) => handleInputChange('agg20mmKg', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-300 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-emerald-400 font-bold uppercase text-[10px]">10 MM Coarse Aggregate (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.agg10mmKg ?? ''}
                  onChange={(e) => handleInputChange('agg10mmKg', e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-300 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="sm:col-span-3 space-y-1 bg-[#070d1a] border border-[#1b273d] p-3 rounded-2xl">
                <label className="text-rose-400 font-bold uppercase text-[10px] block mb-1">
                  PCE Admixture Dosage (kg/m³)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editForm.admixtureKg ?? ''}
                  onChange={(e) => handleInputChange('admixtureKg', e.target.value)}
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
