import React, { useState, useEffect } from 'react';
import { Layers, Edit2, Save, X, Check, RotateCcw, Lock, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cloudStorage } from '../../services/cloudStorage';

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

export const BILGI_QA_REV2_FLY_ASH: Record<string, MixRecipe> = {
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
  const getSiteMixKey = (site: string, mode: AdmixtureMode) => `concrete360_mixes_${site}_${mode}`;

  const [admixtureMode, setAdmixtureMode] = useState<AdmixtureMode>(() => {
    try {
      const site = getActiveSiteKey();
      const saved = localStorage.getItem(`concrete360_admixture_mode_${site}`) || localStorage.getItem('concrete360_admixture_mode');
      if (saved === 'GGBS' || saved === 'FLY_ASH') return saved;
    } catch {}
    return 'GGBS';
  });

  const getInitialMixes = (site: string, mode: AdmixtureMode): Record<string, MixRecipe> => {
    try {
      const saved = localStorage.getItem(getSiteMixKey(site, mode));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return mode === 'GGBS' ? { ...BILGI_QA_REV2_GGBS } : { ...BILGI_QA_REV2_FLY_ASH };
  };

  const [mixes, setMixes] = useState<Record<string, MixRecipe>>(() => getInitialMixes(currentSiteKey, admixtureMode));
  const [activeGrade, setActiveGrade] = useState<string>('M25');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<MixRecipe>(mixes['M25'] || BILGI_QA_REV2_GGBS['M25']);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const syncActiveState = () => {
    const site = getActiveSiteKey();
    setCurrentSiteKey(site);

    let siteMode: AdmixtureMode = 'GGBS';
    try {
      const savedMode = localStorage.getItem(getSiteModeKey(site)) || localStorage.getItem('concrete360_admixture_mode');
      if (savedMode === 'GGBS' || savedMode === 'FLY_ASH') siteMode = savedMode;
    } catch {}

    setAdmixtureMode(siteMode);
    const resolvedMixes = getInitialMixes(site, siteMode);
    setMixes(resolvedMixes);
    setEditForm(resolvedMixes[activeGrade] || (siteMode === 'GGBS' ? BILGI_QA_REV2_GGBS[activeGrade] : BILGI_QA_REV2_FLY_ASH[activeGrade]));
  };

  useEffect(() => {
    window.addEventListener('concrete360_site_switched', syncActiveState);
    return () => {
      window.removeEventListener('concrete360_site_switched', syncActiveState);
    };
  }, [activeGrade]);

  const handleModeSwitch = (newMode: AdmixtureMode) => {
    setAdmixtureMode(newMode);
    try {
      localStorage.setItem(getSiteModeKey(currentSiteKey), newMode);
      localStorage.setItem('concrete360_admixture_mode', newMode);
    } catch {}

    const newMixes = getInitialMixes(currentSiteKey, newMode);
    setMixes(newMixes);
    setIsEditing(false);
    setEditForm(newMixes[activeGrade] || (newMode === 'GGBS' ? BILGI_QA_REV2_GGBS[activeGrade] : BILGI_QA_REV2_FLY_ASH[activeGrade]));
    setSuccessMessage(`Switched to ${newMode === 'GGBS' ? 'GGBS (20% Binder Replacement)' : 'Fly Ash'} mode!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const currentMix = mixes[activeGrade] || (admixtureMode === 'GGBS' ? BILGI_QA_REV2_GGBS[activeGrade] : BILGI_QA_REV2_FLY_ASH[activeGrade]);

  const handleStartEdit = () => {
    if (!canModifyMixes) {
      alert('Permission Denied: Only ADMIN or EMPLOYEE accounts can modify mix proportions.');
      return;
    }
    setEditForm({ ...currentMix });
    setIsEditing(true);
  };

  // Dynamically update field values and recalculate w/b and total density in real time
  const handleFieldChange = (field: keyof MixRecipe, value: number) => {
    setEditForm(prev => {
      const updated = { ...prev, [field]: value };
      const totalBinder = (updated.cementKg || 0) + (updated.mineralAdmixtureKg || 0);
      const calculatedWcr = totalBinder > 0 ? Number(((updated.waterLitres || 0) / totalBinder).toFixed(2)) : 0.45;
      const calculatedDensity = Math.round(
        (updated.cementKg || 0) +
        (updated.mineralAdmixtureKg || 0) +
        (updated.waterLitres || 0) +
        (updated.mSandKg || 0) +
        (updated.agg20mmKg || 0) +
        (updated.agg10mmKg || 0) +
        (updated.admixtureKg || 0)
      );

      return {
        ...updated,
        wcr: calculatedWcr,
        totalDensity: calculatedDensity
      };
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyMixes) return;

    const updatedMixes = {
      ...mixes,
      [activeGrade]: { ...editForm }
    };

    setMixes(updatedMixes);
    setIsEditing(false);

    try {
      localStorage.setItem(getSiteMixKey(currentSiteKey, admixtureMode), JSON.stringify(updatedMixes));
      localStorage.setItem(getSiteModeKey(currentSiteKey), admixtureMode);

      const arr = Object.values(updatedMixes).map(m => ({
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
        totalDensity: m.totalDensity
      }));

      localStorage.setItem('concrete360_mix_designs', JSON.stringify(arr));
      localStorage.setItem(`concrete360_mix_designs_${currentSiteKey}`, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('concrete360_mix_designs_updated', { detail: arr }));
    } catch {}

    if (supabase) {
      await (supabase as any).from('mix_designs').upsert({
        grade: editForm.grade,
        target_mpa: editForm.targetMpa,
        wcr: editForm.wcr,
        cement_kg: editForm.cementKg,
        mineral_admixture_kg: editForm.mineralAdmixtureKg,
        water_litres: editForm.waterLitres,
        m_sand_kg: editForm.mSandKg,
        agg_20mm_kg: editForm.agg20mmKg,
        agg_10mm_kg: editForm.agg10mmKg,
        admixture_kg: editForm.admixtureKg,
        total_density: editForm.totalDensity,
        mode: admixtureMode,
        updated_at: new Date().toISOString()
      }, { onConflict: 'grade' });
      await cloudStorage.pullFromCloud();
    }

    setSuccessMessage(`Mix design for ${activeGrade} saved successfully!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleForceResetAll = () => {
    if (!canModifyMixes) return;
    if (window.confirm(`Force-load Bilgi QA Batch Cards (Rev. 2) for ${currentSiteKey}?`)) {
      const freshMixes = admixtureMode === 'GGBS' ? { ...BILGI_QA_REV2_GGBS } : { ...BILGI_QA_REV2_FLY_ASH };
      setMixes(freshMixes);
      localStorage.setItem(getSiteMixKey(currentSiteKey, admixtureMode), JSON.stringify(freshMixes));
      setEditForm(freshMixes[activeGrade]);
      setIsEditing(false);
      setSuccessMessage('Successfully reloaded Bilgi Buildcon RMC QA Cards (Rev. 2)!');
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  };

  const totalCementitious = currentMix.cementKg + currentMix.mineralAdmixtureKg;

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Header & Admixture Controls */}
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
              <span>COMMAND:</span>
            </div>

            <button
              type="button"
              onClick={() => handleModeSwitch('GGBS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                admixtureMode === 'GGBS'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-[#121c2d]'
              }`}
            >
              <span>USE GGBS (20%)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch('FLY_ASH')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                admixtureMode === 'FLY_ASH'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-[#121c2d]'
              }`}
            >
              <span>USE FLY ASH</span>
            </button>
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
          const m = mixes[gradeKey] || (admixtureMode === 'GGBS' ? BILGI_QA_REV2_GGBS[gradeKey] : BILGI_QA_REV2_FLY_ASH[gradeKey]);
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

            <div className="p-5 bg-[#070d1a] border border-indigo-500/30 bg-indigo-950/10 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                {admixtureMode === 'GGBS' ? 'GGBS (SILO 2)' : 'CLASS F FLY ASH (SILO 2)'}
              </span>
              <div className="text-2xl font-extrabold text-indigo-300">{currentMix.mineralAdmixtureKg} kg</div>
              <span className="text-[11px] text-slate-500 block">
                {admixtureMode === 'GGBS' ? '20% Replacement (IS 16714)' : 'Pozzolanic Replacement (IS 3812)'}
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
                  value={editForm.targetMpa}
                  onChange={(e) => handleFieldChange('targetMpa', Number(e.target.value) || 0)}
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
                  onChange={(e) => handleFieldChange('wcr', Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-cyan-400 font-bold uppercase text-[10px]">Total Design Density (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.totalDensity}
                  onChange={(e) => handleFieldChange('totalDensity', Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-cyan-500/30 rounded-xl text-cyan-300 font-black outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">OPC 53 Cement - Silo 1 (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.cementKg}
                  onChange={(e) => handleFieldChange('cementKg', Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-blue-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className={`font-bold uppercase text-[10px] ${admixtureMode === 'GGBS' ? 'text-indigo-400' : 'text-purple-400'}`}>
                  {admixtureMode === 'GGBS' ? 'GGBS - Silo 2 (kg/m³)' : 'Fly Ash - Silo 2 (kg/m³)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={editForm.mineralAdmixtureKg}
                  onChange={(e) => handleFieldChange('mineralAdmixtureKg', Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-cyan-400 font-bold uppercase text-[10px]">Design Free Water (L/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.waterLitres}
                  onChange={(e) => handleFieldChange('waterLitres', Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-amber-400 font-bold uppercase text-[10px]">M-Sand - Fine Aggregate (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.mSandKg}
                  onChange={(e) => handleFieldChange('mSandKg', Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-amber-300 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-emerald-400 font-bold uppercase text-[10px]">20 MM Coarse Aggregate (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.agg20mmKg}
                  onChange={(e) => handleFieldChange('agg20mmKg', Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-300 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-emerald-400 font-bold uppercase text-[10px]">10 MM Coarse Aggregate (kg/m³)</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.agg10mmKg}
                  onChange={(e) => handleFieldChange('agg10mmKg', Number(e.target.value) || 0)}
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
                  value={editForm.admixtureKg}
                  onChange={(e) => handleFieldChange('admixtureKg', Number(e.target.value) || 0)}
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
