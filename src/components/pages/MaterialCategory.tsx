import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Layers, 
  Plus, 
  ShieldCheck, 
  Boxes, 
  Trash2, 
  Edit3, 
  X,
  Eye,
  Lock
} from 'lucide-react';

export const MaterialCategory: React.FC = () => {
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
  const canEditOrDelete = userRole === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'concrete' | 'raw'>('concrete');

  // Concrete Mix Grades (Per m³)
  const [concreteGrades, setConcreteGrades] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('concrete360_grades');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'c-1', code: 'M20', type: 'Standard (PCC & Footings)', targetStrength: '20 N/mm²', slump: '100 ± 25 mm', ratePerM3: 4200, status: 'Active' },
      { id: 'c-2', code: 'M25', type: 'Standard (Beams & Slabs)', targetStrength: '25 N/mm²', slump: '120 ± 25 mm', ratePerM3: 4500, status: 'Active' },
      { id: 'c-3', code: 'M30', type: 'Structural RCC', targetStrength: '30 N/mm²', slump: '120 ± 25 mm', ratePerM3: 4750, status: 'Active' },
      { id: 'c-4', code: 'M35', type: 'High-Rise Columns & Slabs', targetStrength: '35 N/mm²', slump: '150 ± 25 mm', ratePerM3: 5050, status: 'Active' },
      { id: 'c-5', code: 'M40', type: 'Heavy Commercial Structure', targetStrength: '40 N/mm²', slump: '150 ± 25 mm', ratePerM3: 5350, status: 'Active' },
      { id: 'c-6', code: 'M45', type: 'High-Performance Bridge Piles', targetStrength: '45 N/mm²', slump: '150 ± 25 mm', ratePerM3: 5700, status: 'Active' },
      { id: 'c-7', code: 'M50', type: 'High-Strength Infrastructure', targetStrength: '50 N/mm²', slump: '175 ± 25 mm', ratePerM3: 6100, status: 'Active' },
      { id: 'c-8', code: 'M55', type: 'Ultra High-Strength Piers', targetStrength: '55 N/mm²', slump: '175 ± 25 mm', ratePerM3: 6500, status: 'Active' },
      { id: 'c-9', code: 'M60', type: 'Long-Span Girders', targetStrength: '60 N/mm²', slump: '175 ± 25 mm', ratePerM3: 7000, status: 'Active' },
      { id: 'c-10', code: 'M65', type: 'Specialized Skyscraper Core', targetStrength: '65 N/mm²', slump: '175 ± 25 mm', ratePerM3: 7500, status: 'Active' },
      { id: 'c-11', code: 'M70', type: 'Massive Structural Columns', targetStrength: '70 N/mm²', slump: '200 ± 25 mm', ratePerM3: 8100, status: 'Active' },
      { id: 'c-12', code: 'M75', type: 'Extreme High-Performance RMC', targetStrength: '75 N/mm²', slump: '200 ± 25 mm', ratePerM3: 8800, status: 'Active' },
    ];
  });

  // Raw Materials (Only Material Name and Rate per Brass)
  const [rawMaterials, setRawMaterials] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('concrete360_raw_materials');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'RM-01', name: 'Manufactured Sand (M-Sand)', ratePerBrass: 1150 },
      { id: 'RM-02', name: 'Coarse Aggregate (20mm)', ratePerBrass: 1250 },
      { id: 'RM-03', name: 'Coarse Aggregate (10mm)', ratePerBrass: 1350 },
      { id: 'RM-04', name: 'GSB (Granular Sub-Base)', ratePerBrass: 1500 },
      { id: 'RM-05', name: 'WMM (Wet Mix Macadam)', ratePerBrass: 1500 },
      { id: 'RM-06', name: 'DBM (Dense Bituminous Macadam)', ratePerBrass: 5500 }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('concrete360_grades', JSON.stringify(concreteGrades));
    } catch {}
  }, [concreteGrades]);

  useEffect(() => {
    try {
      localStorage.setItem('concrete360_raw_materials', JSON.stringify(rawMaterials));
    } catch {}
  }, [rawMaterials]);

  // Modal States
  const [isConcreteModalOpen, setIsConcreteModalOpen] = useState(false);
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [editingConcrete, setEditingConcrete] = useState<any | null>(null);

  // Form Fields for Concrete Grade
  const [code, setCode] = useState('M50');
  const [type, setType] = useState('High-Strength Infrastructure');
  const [targetStrength, setTargetStrength] = useState('50 N/mm²');
  const [slump, setSlump] = useState('175 ± 25 mm');
  const [ratePerM3, setRatePerM3] = useState<number>(6100);

  // Form Fields for Raw Material (Only Name and Rate per Brass)
  const [rawName, setRawName] = useState('');
  const [ratePerBrass, setRatePerBrass] = useState<number>(1200);

  const handleOpenAddConcrete = () => {
    if (!canCreate) {
      alert('Permission Denied: Read-Only accounts cannot add concrete grades.');
      return;
    }
    setEditingConcrete(null);
    setCode('M80');
    setType('Special High-Performance RMC');
    setTargetStrength('80 N/mm²');
    setSlump('200 ± 25 mm');
    setRatePerM3(9500);
    setIsConcreteModalOpen(true);
  };

  const handleOpenEditConcrete = (item: any) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can edit concrete grades.');
      return;
    }
    setEditingConcrete(item);
    setCode(item.code);
    setType(item.type);
    setTargetStrength(item.targetStrength);
    setSlump(item.slump);
    setRatePerM3(item.ratePerM3);
    setIsConcreteModalOpen(true);
  };

  const handleSaveConcrete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    if (!code.trim()) return;

    if (editingConcrete) {
      if (!canEditOrDelete) {
        alert('Permission Denied: Only ADMIN accounts can edit concrete grades.');
        return;
      }
      setConcreteGrades(prev => prev.map(item => item.id === editingConcrete.id ? {
        ...item,
        code: code.toUpperCase(),
        type,
        targetStrength,
        slump,
        ratePerM3: Number(ratePerM3)
      } : item));
    } else {
      const newItem = {
        id: `c-${Date.now()}`,
        code: code.toUpperCase(),
        type,
        targetStrength,
        slump,
        ratePerM3: Number(ratePerM3),
        status: 'Active'
      };
      setConcreteGrades(prev => [...prev, newItem]);
    }
    setIsConcreteModalOpen(false);
  };

  const handleDeleteConcrete = (id: string) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can delete concrete grades.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this concrete grade?')) return;
    setConcreteGrades(prev => prev.filter(c => c.id !== id));
  };

  const handleOpenAddRaw = () => {
    if (!canCreate) {
      alert('Permission Denied: Read-Only accounts cannot add raw material stocks.');
      return;
    }
    setRawName('');
    setRatePerBrass(1200);
    setIsRawModalOpen(true);
  };

  const handleSaveRawMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    if (!rawName.trim()) return;

    const newItem = {
      id: `RM-0${rawMaterials.length + 1}`,
      name: rawName.trim(),
      ratePerBrass: Number(ratePerBrass)
    };

    setRawMaterials(prev => [newItem, ...prev]);
    setIsRawModalOpen(false);
    setRawName('');
    setRatePerBrass(1200);
  };

  const handleDeleteRawMaterial = (id: string) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can delete raw material stocks.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this raw material?')) return;
    setRawMaterials(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Header Banner */}
      <div className="bg-[#0b1322] border border-[#1b273d] p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
              MATERIAL &amp; MIX SPECIFICATION CATALOG
            </span>
            <h2 className="text-xl font-black text-white mt-1 tracking-tight">
              Ready-Mix Concrete Grades &amp; Raw Stock Inventory
            </h2>
          </div>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            {activeTab === 'concrete' ? (
              <button
                onClick={handleOpenAddConcrete}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition shrink-0 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Add Concrete Grade</span>
              </button>
            ) : (
              <button
                onClick={handleOpenAddRaw}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition shrink-0 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Add Raw Material Stock</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab Selectors */}
      <div className="flex gap-2 border-b border-[#1b273d] pb-3">
        <button
          onClick={() => setActiveTab('concrete')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'concrete'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0b1322] text-slate-400 hover:text-white border border-[#1b273d]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Concrete Mix Grades (M20 - M75)</span>
        </button>
        <button
          onClick={() => setActiveTab('raw')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'raw'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0b1322] text-slate-400 hover:text-white border border-[#1b273d]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Raw Materials (Per Brass Rates)</span>
        </button>
      </div>

      {/* TAB 1: CONCRETE GRADES GRID */}
      {activeTab === 'concrete' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {concreteGrades.map((grade) => (
            <div key={grade.id} className="bg-[#0b1322] border border-[#1b273d] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-mono font-black">
                    {grade.code} GRADE
                  </span>
                  <div className="flex items-center gap-1.5">
                    {canEditOrDelete ? (
                      <>
                        <button
                          onClick={() => handleOpenEditConcrete(grade)}
                          className="p-1.5 text-slate-400 hover:text-white bg-[#121c2d] hover:bg-blue-600 rounded-lg transition cursor-pointer"
                          title="Edit Grade & Rate"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteConcrete(grade.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-[#121c2d] hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                          title="Delete Grade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-500 text-[10px] inline-flex items-center gap-1 font-mono">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white mt-3">{grade.type}</h3>

                <div className="mt-4 bg-[#0d1627] border border-[#17253e] rounded-xl p-3 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Target Strength:</span>
                    <strong className="text-white">{grade.targetStrength}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Design Slump:</span>
                    <strong className="text-emerald-400">{grade.slump}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300 pt-1 border-t border-[#17253e]">
                    <span className="text-slate-400">Rate per m³:</span>
                    <strong className="text-blue-400 font-extrabold">₹{grade.ratePerM3.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#172439] flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1 text-blue-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> IS 456 Compliant
                </span>
                {!canEditOrDelete && (
                  <span className="text-slate-500 text-[10px]">Read-Only Catalog</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: RAW MATERIALS TABLE (PER BRASS) */}
      {activeTab === 'raw' && (
        <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#070d1a] border-b border-[#1b273d] text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-4 px-6">Material ID</th>
                  <th className="py-4 px-6">Material Name</th>
                  <th className="py-4 px-6">Rate per Brass (₹)</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152238] text-slate-200">
                {rawMaterials.map(mat => (
                  <tr key={mat.id} className="hover:bg-[#0f192c] transition">
                    <td className="py-3.5 px-6 font-bold text-blue-400">{mat.id}</td>
                    <td className="py-3.5 px-6 font-bold text-white">{mat.name}</td>
                    <td className="py-3.5 px-6 font-extrabold text-emerald-400">
                      ₹{Number(mat.ratePerBrass || 0).toLocaleString('en-IN')} <span className="text-[10px] text-slate-400 font-normal">/ Brass</span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {canEditOrDelete ? (
                        <button
                          onClick={() => handleDeleteRawMaterial(mat.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-[#121c2d] hover:bg-rose-500/10 rounded-lg transition ml-auto cursor-pointer"
                          title="Delete Material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-500 text-[10px] inline-flex items-center gap-1 font-mono">
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Only</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CONCRETE GRADE */}
      {isConcreteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0b1322] border border-[#1e2d46] rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  {editingConcrete ? 'Edit Concrete Grade & Rate' : 'Add New Concrete Grade'}
                </h3>
              </div>
              <button
                onClick={() => setIsConcreteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-[#121c2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConcrete} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">GRADE CODE *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. M40"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">RATE PER m³ (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 5200"
                    value={ratePerM3}
                    onChange={(e) => setRatePerM3(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-blue-400 font-extrabold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold">STRUCTURAL APPLICATION TYPE</label>
                <input
                  type="text"
                  placeholder="e.g. High-Rise Columns & Slabs"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-sans text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">TARGET STRENGTH</label>
                  <input
                    type="text"
                    placeholder="e.g. 40 N/mm²"
                    value={targetStrength}
                    onChange={(e) => setTargetStrength(e.target.value)}
                    className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">DESIGN SLUMP</label>
                  <input
                    type="text"
                    placeholder="e.g. 150 ± 25 mm"
                    value={slump}
                    onChange={(e) => setSlump(e.target.value)}
                    className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-emerald-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1a273b]">
                <button
                  type="button"
                  onClick={() => setIsConcreteModalOpen(false)}
                  className="px-5 py-3 text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 text-xs transition cursor-pointer"
                >
                  {editingConcrete ? 'Update Concrete Grade' : 'Save Concrete Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD RAW MATERIAL (ONLY NAME AND RATE PER BRASS) */}
      {isRawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0b1322] border border-[#1e2d46] rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Add Raw Material (Per Brass Rate)
                </h3>
              </div>
              <button
                onClick={() => setIsRawModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-[#121c2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRawMaterial} className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">MATERIAL NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. M-Sand / GSB / WMM"
                  value={rawName}
                  onChange={(e) => setRawName(e.target.value)}
                  className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans text-sm"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold">RATE PER BRASS (₹) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={ratePerBrass}
                  onChange={(e) => setRatePerBrass(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121d2f] border border-[#22334f] rounded-2xl px-4 py-3 text-emerald-400 font-extrabold focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1a273b]">
                <button
                  type="button"
                  onClick={() => setIsRawModalOpen(false)}
                  className="px-5 py-3 text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 text-xs transition cursor-pointer"
                >
                  Save Material Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialCategory;
