import React, { useState, useEffect } from 'react';
import { Layers, Edit2, Save, X, Check, RotateCcw, Lock, Eye } from 'lucide-react';

export interface MixRecipe {
  grade: string;
  targetMpa: number;
  wcr: number;
  cementKg: number;
  flyAshKg: number;
  waterLitres: number;
  mSandKg: number;
  agg20mmKg: number;
  agg10mmKg: number;
  admixtureKg: number;
  totalDensity: number;
}

const DEFAULT_MIX_RECIPES: Record<string, MixRecipe> = {
  'M20': { grade: 'M20', targetMpa: 29.0, wcr: 0.42, cementKg: 350, flyAshKg: 50, waterLitres: 125, mSandKg: 752, agg20mmKg: 722, agg10mmKg: 401, admixtureKg: 0, totalDensity: 2400 },
  'M25': { grade: 'M25', targetMpa: 35.0, wcr: 0.40, cementKg: 380, flyAshKg: 60, waterLitres: 135, mSandKg: 720, agg20mmKg: 680, agg10mmKg: 450, admixtureKg: 3.5, totalDensity: 2450 },
  'M30': { grade: 'M30', targetMpa: 38.2, wcr: 0.38, cementKg: 410, flyAshKg: 70, waterLitres: 140, mSandKg: 700, agg20mmKg: 700, agg10mmKg: 460, admixtureKg: 4.0, totalDensity: 2480 },
  'M35': { grade: 'M35', targetMpa: 43.2, wcr: 0.36, cementKg: 430, flyAshKg: 80, waterLitres: 145, mSandKg: 680, agg20mmKg: 710, agg10mmKg: 470, admixtureKg: 4.5, totalDensity: 2500 },
  'M40': { grade: 'M40', targetMpa: 48.2, wcr: 0.35, cementKg: 450, flyAshKg: 90, waterLitres: 150, mSandKg: 660, agg20mmKg: 720, agg10mmKg: 480, admixtureKg: 5.2, totalDensity: 2520 },
  'M45': { grade: 'M45', targetMpa: 53.2, wcr: 0.33, cementKg: 470, flyAshKg: 100, waterLitres: 152, mSandKg: 640, agg20mmKg: 730, agg10mmKg: 490, admixtureKg: 5.8, totalDensity: 2540 },
  'M50': { grade: 'M50', targetMpa: 58.2, wcr: 0.32, cementKg: 490, flyAshKg: 110, waterLitres: 155, mSandKg: 620, agg20mmKg: 740, agg10mmKg: 500, admixtureKg: 6.5, totalDensity: 2560 }
};

const STORAGE_KEY = 'concrete360_mix_designs_v2';

export const MixDesignModule: React.FC = () => {
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
  const canModifyMixes = userRole === 'ADMIN';

  const [mixes, setMixes] = useState<Record<string, MixRecipe>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_MIX_RECIPES;
  });

  const [activeGrade, setActiveGrade] = useState<string>('M20');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<MixRecipe>(mixes['M20'] || DEFAULT_MIX_RECIPES['M20']);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mixes));
      
      // Broadcast mix design recipes for billing, reports, and docket consumption
      const arr = Object.values(mixes).map(m => ({
        grade: m.grade,
        code: m.grade,
        cementKgPerM3: m.cementKg,
        flyAshKgPerM3: m.flyAshKg,
        waterLitresPerM3: m.waterLitres,
        mSandKgPerM3: m.mSandKg,
        agg20mmKgPerM3: m.agg20mmKg,
        agg10mmKgPerM3: m.agg10mmKg,
        admixtureKgPerM3: m.admixtureKg
      }));
      localStorage.setItem('concrete360_mix_designs', JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('concrete360_mix_designs_updated', { detail: arr }));
    } catch {}
  }, [mixes]);

  const currentMix = mixes[activeGrade] || DEFAULT_MIX_RECIPES[activeGrade];

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
    setSuccessMessage(`Mix design for ${activeGrade} successfully updated!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleResetMix = () => {
    if (!canModifyMixes) {
      alert('Permission Denied: Only ADMIN accounts can reset mix designs.');
      return;
    }
    if (window.confirm(`Reset ${activeGrade} to original factory default proportions?`)) {
      const defaultVal = DEFAULT_MIX_RECIPES[activeGrade];
      setMixes(prev => ({
        ...prev,
        [activeGrade]: { ...defaultVal }
      }));
      setSuccessMessage(`${activeGrade} successfully reset to defaults!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
            MATERIAL &amp; MIX SPECIFICATION CATALOG
          </span>
          <h2 className="text-xl font-black text-white mt-1">Ready-Mix Concrete Grades &amp; Raw Stock Inventory</h2>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grade Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 font-mono">
        {Object.keys(DEFAULT_MIX_RECIPES).map((gradeKey) => {
          const m = mixes[gradeKey] || DEFAULT_MIX_RECIPES[gradeKey];
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
              <h3 className="text-base font-black text-white">CONSTITUENT PROPORTIONS FOR {activeGrade} GRADE (1 M³)</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Water-Cement Ratio (w/c): <strong className="text-amber-400 font-bold">{currentMix.wcr}</strong>
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
                    title="Reset to Default Proportions"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cement (OPC / PPC)</span>
              <div className="text-2xl font-extrabold text-blue-400">{currentMix.cementKg} kg</div>
              <span className="text-[11px] text-slate-500 block">({Math.round(currentMix.cementKg / 50)} Bags @ 50kg) • Primary binder</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fly Ash / GGBS</span>
              <div className="text-2xl font-extrabold text-purple-400">{currentMix.flyAshKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Pozzolanic Mineral Admixture</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batching Water</span>
              <div className="text-2xl font-extrabold text-cyan-400">{currentMix.waterLitres} Litres</div>
              <span className="text-[11px] text-slate-500 block">Density 1.0 kg/L</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">M-Sand (Fine Aggregate)</span>
              <div className="text-2xl font-extrabold text-amber-400">{currentMix.mSandKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Zone II Manufactured Sand</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">20 MM Aggregate</span>
              <div className="text-2xl font-extrabold text-emerald-400">{currentMix.agg20mmKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Coarse Fraction A</span>
            </div>

            <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">10 MM Aggregate</span>
              <div className="text-2xl font-extrabold text-emerald-400">{currentMix.agg10mmKg} kg</div>
              <span className="text-[11px] text-slate-500 block">Coarse Fraction B</span>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Superplasticizer Admixture</span>
              <div className="text-2xl font-extrabold text-rose-400">{currentMix.admixtureKg} kg</div>
              <span className="text-[11px] text-slate-500 block">High-Range Water Reducer • Total Mix Density: {currentMix.totalDensity} kg/m³</span>
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
                <label className="text-slate-300 font-bold uppercase text-[10px]">Cement (kg/m³)</label>
                <input
                  type="number"
                  value={editForm.cementKg}
                  onChange={(e) => setEditForm({ ...editForm, cementKg: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-blue-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">Fly Ash (kg/m³)</label>
                <input
                  type="number"
                  value={editForm.flyAshKg}
                  onChange={(e) => setEditForm({ ...editForm, flyAshKg: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-purple-400 font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold uppercase text-[10px]">Water (Litres/m³)</label>
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
                <label className="text-slate-300 font-bold uppercase text-[10px]">Admixture (kg/m³)</label>
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
