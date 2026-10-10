import React, { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, Edit3, X, Wrench } from 'lucide-react';
import { canCreateRecords, getSessionUser, isAdminUser } from '../../utils/accessControl';

interface EquipmentItem {
  id: string;
  vehicleNo: string;
  equipmentType: string;
  rent: number;
}

export const ConcretePumpsPage: React.FC = () => {
  const sessionUser = getSessionUser();
  const canCreate = canCreateRecords(sessionUser);
  const canEditOrDelete = isAdminUser(sessionUser);
  const getActiveSiteKey = () => {
    try {
      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        if (parsed.name || parsed.siteName || parsed.id) {
          return String(parsed.name || parsed.siteName || parsed.id).trim();
        }
      }
      const selected = sessionStorage.getItem('concrete360_selected_site');
      if (selected) return String(selected).trim();
    } catch {}
    return 'DEFAULT';
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(getActiveSiteKey());
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    vehicleNo: '',
    equipmentType: 'Boom Pump',
    rent: 5000
  });

  const loadData = () => {
    const siteKey = getActiveSiteKey();
    setCurrentSiteKey(siteKey);
    try {
      const saved = localStorage.getItem(`concrete360_transit_mixers_${siteKey}`) || localStorage.getItem('concrete360_transit_mixers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setEquipmentList(parsed);
          return;
        }
      }
      // Default initial items
      setEquipmentList([
        { id: 'eq-1', vehicleNo: 'KA-01-TM-1234', equipmentType: 'Transit Mixer', rent: 0 },
        { id: 'eq-2', vehicleNo: 'KA-02-BP-5678', equipmentType: 'Boom Pump', rent: 40000 },
        { id: 'eq-3', vehicleNo: 'KA-03-SP-9012', equipmentType: 'Stationary Pump', rent: 5000 }
      ]);
    } catch {
      setEquipmentList([]);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const saveToStorage = (updated: EquipmentItem[]) => {
    setEquipmentList(updated);
    try {
      localStorage.setItem(`concrete360_transit_mixers_${currentSiteKey}`, JSON.stringify(updated));
      localStorage.setItem('concrete360_transit_mixers', JSON.stringify(updated));
    } catch {}
  };

  const handleOpenAdd = () => {
    if (!canCreate) return;
    setEditingId(null);
    setFormData({ vehicleNo: '', equipmentType: 'Boom Pump', rent: 5000 });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: EquipmentItem) => {
    if (!canEditOrDelete) return;
    setEditingId(item.id);
    setFormData({
      vehicleNo: item.vehicleNo,
      equipmentType: item.equipmentType || 'Boom Pump',
      rent: Number(item.rent) || 0
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canEditOrDelete) return;
    if (!window.confirm('Are you sure you want to delete this equipment record?')) return;
    const updated = equipmentList.filter(e => e.id !== id);
    saveToStorage(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || (editingId && !canEditOrDelete)) return;
    if (!formData.vehicleNo.trim()) return;

    if (editingId) {
      const updated = equipmentList.map(eq => eq.id === editingId ? {
        ...eq,
        vehicleNo: formData.vehicleNo.trim().toUpperCase(),
        equipmentType: formData.equipmentType,
        rent: Number(formData.rent)
      } : eq);
      saveToStorage(updated);
    } else {
      const newItem: EquipmentItem = {
        id: 'eq-' + Date.now(),
        vehicleNo: formData.vehicleNo.trim().toUpperCase(),
        equipmentType: formData.equipmentType,
        rent: Number(formData.rent)
      };
      saveToStorage([newItem, ...equipmentList]);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0b1322] border border-[#1b273d] p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">
              FLEET & PUMP MANAGEMENT ({currentSiteKey})
            </span>
            <h2 className="text-xl font-black text-white mt-1">Concrete Pumps & Transit Mixers</h2>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer rounded-xl shadow-lg shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Equipment / Pump</span>
          </button>
        )}
      </div>

      {/* Equipment Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-6">Vehicle / Reg No</th>
                <th className="py-4 px-6">Equipment Type</th>
                <th className="py-4 px-6">Default Rent / Tariff</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {equipmentList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-500 font-sans">
                    No concrete pumps or vehicles registered. Click "+ Add Equipment / Pump" to create one.
                  </td>
                </tr>
              ) : (
                equipmentList.map((item) => (
                  <tr key={item.id} className="hover:bg-[#0e1728] transition-colors group">
                    <td className="py-4 px-6 text-white font-black text-sm">{item.vehicleNo}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.equipmentType?.includes('Boom') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 
                        item.equipmentType?.includes('Stationary') ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {item.equipmentType || 'Transit Mixer'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-emerald-400 font-bold">₹{(item.rent || 0).toLocaleString('en-IN')}</td>
                    <td className="py-4 px-6 text-right space-x-2">
                      {canEditOrDelete && <>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Equipment"
                        className="p-1.5 rounded-lg bg-[#121d2f] hover:bg-blue-600/20 text-blue-400 transition cursor-pointer inline-flex items-center"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        title="Delete Equipment"
                        className="p-1.5 rounded-lg bg-[#121d2f] hover:bg-rose-600/20 text-rose-400 transition cursor-pointer inline-flex items-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      </>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-[#121824] border border-[#1e293b] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/10 p-2 rounded-xl text-blue-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <h3 className="text-white font-semibold text-lg">
                  {editingId ? 'Edit Equipment / Pump' : 'Add Concrete Pump or Vehicle'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider">Vehicle / Equipment No *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. KA-02-BP-5678"
                  value={formData.vehicleNo}
                  onChange={(e) => setFormData({...formData, vehicleNo: e.target.value})}
                  className="w-full bg-[#0b0f17] border border-[#2a374a] rounded-xl px-4 py-2.5 text-white font-bold uppercase outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider">Equipment Type *</label>
                <select 
                  value={formData.equipmentType}
                  onChange={(e) => setFormData({...formData, equipmentType: e.target.value})}
                  className="w-full bg-[#0b0f17] border border-[#2a374a] rounded-xl px-4 py-2.5 text-amber-400 font-bold outline-none focus:border-blue-500"
                >
                  <option value="Boom Pump">Boom Pump</option>
                  <option value="Stationary Pump">Stationary Pump</option>
                  <option value="Transit Mixer">Transit Mixer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider">Default Rent / Tariff (₹) *</label>
                <input 
                  type="number"
                  required
                  value={formData.rent}
                  onChange={(e) => setFormData({...formData, rent: Number(e.target.value)})}
                  className="w-full bg-[#0b0f17] border border-[#2a374a] rounded-xl px-4 py-2.5 text-emerald-400 font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1e293b]">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white cursor-pointer font-sans text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer font-sans text-sm transition"
                >
                  {editingId ? 'Update Record' : 'Save Equipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcretePumpsPage;
