import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  X, 
  Activity,
  Layers,
  HardHat,
  Building2,
  Lock,
  Eye
} from 'lucide-react';

export interface TransitMixerTruck {
  id: string;
  vehicleNo: string;
  equipmentType: string;
  capacityM3: number;
  driverName?: string;
  driverPhone?: string;
  status: 'Active on Site' | 'In Transit' | 'Maintenance' | 'Inactive';
  ownership: 'Company' | 'Hired' | 'Subcontractor';
  isActive: boolean;
  notes?: string;
  siteKey?: string;
}

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'DEFAULT';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

export const TransitMixerPage: React.FC = () => {
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

  const getActiveSiteKey = () => {
    try {
      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        try {
          const parsed = JSON.parse(activeRaw);
          if (parsed.name || parsed.siteName || parsed.id) {
            return extractCleanSiteName(parsed.name || parsed.siteName || parsed.id);
          }
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
  const [mixers, setMixers] = useState<TransitMixerTruck[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMixerId, setEditingMixerId] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<{
    vehicleNo: string;
    equipmentType: string;
    capacityM3: number;
    driverName: string;
    driverPhone: string;
    status: 'Active on Site' | 'In Transit' | 'Maintenance' | 'Inactive';
    ownership: 'Company' | 'Hired' | 'Subcontractor';
    notes: string;
  }>({
    vehicleNo: '',
    equipmentType: 'Transit Mixer',
    capacityM3: 9,
    driverName: '',
    driverPhone: '',
    status: 'Active on Site',
    ownership: 'Company',
    notes: ''
  });

  const loadMixers = () => {
    const siteKey = getActiveSiteKey();
    setCurrentSiteKey(siteKey);

    const siteSpecificKey = `concrete360_transit_mixers_${siteKey}`;
    const globalKey = 'concrete360_transit_mixers';

    try {
      const siteRaw = localStorage.getItem(siteSpecificKey);
      if (siteRaw) {
        const parsed = JSON.parse(siteRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMixers(parsed);
          return;
        }
      }

      const globalRaw = localStorage.getItem(globalKey);
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMixers(parsed);
          return;
        }
      }

      // Default initial mixer
      const defaultData: TransitMixerTruck[] = [
        {
          id: 'TM-7196',
          vehicleNo: '7196',
          equipmentType: 'Transit Mixer',
          capacityM3: 9,
          driverName: 'Ramesh Patil',
          driverPhone: '+91 98450 12345',
          status: 'Active on Site',
          ownership: 'Company',
          isActive: true,
          notes: 'Standard 9 m³ transit drum',
          siteKey
        }
      ];
      setMixers(defaultData);
      localStorage.setItem(siteSpecificKey, JSON.stringify(defaultData));
      localStorage.setItem(globalKey, JSON.stringify(defaultData));
    } catch {
      setMixers([]);
    }
  };

  useEffect(() => {
    loadMixers();

    const handleSync = () => loadMixers();
    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const saveToStorage = (updatedList: TransitMixerTruck[]) => {
    setMixers(updatedList);
    const siteKey = currentSiteKey || getActiveSiteKey();

    try {
      localStorage.setItem(`concrete360_transit_mixers_${siteKey}`, JSON.stringify(updatedList));
      localStorage.setItem('concrete360_transit_mixers', JSON.stringify(updatedList));
      localStorage.setItem(`concrete360_transit_mixer_fleet_${siteKey}`, JSON.stringify(updatedList));

      // Dispatch event to sync immediately across tabs / BillingRMC component
      window.dispatchEvent(new CustomEvent('concrete360_transit_mixer_updated', { detail: updatedList }));
    } catch (e) {
      console.error('Failed to sync transit mixer storage', e);
    }
  };

  const handleOpenAdd = () => {
    if (!canCreate) {
      alert('Permission Denied: Read-Only accounts cannot add vehicles.');
      return;
    }
    setEditingMixerId(null);
    setFormData({
      vehicleNo: '',
      equipmentType: 'Transit Mixer',
      capacityM3: 9,
      driverName: '',
      driverPhone: '',
      status: 'Active on Site',
      ownership: 'Company',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (truck: TransitMixerTruck) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can edit vehicles.');
      return;
    }
    setEditingMixerId(truck.id);
    setFormData({
      vehicleNo: truck.vehicleNo,
      equipmentType: truck.equipmentType || 'Transit Mixer',
      capacityM3: truck.capacityM3 || 9,
      driverName: truck.driverName || '',
      driverPhone: truck.driverPhone || '',
      status: truck.status,
      ownership: 'Company',
      notes: truck.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can delete vehicles.');
      return;
    }
    if (window.confirm('Are you sure you want to remove this Transit Mixer from the site fleet?')) {
      const updated = mixers.filter(m => m.id !== id);
      saveToStorage(updated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;

    const cleanVNo = formData.vehicleNo.trim().toUpperCase();
    if (!cleanVNo) {
      alert('Please enter a vehicle number');
      return;
    }

    if (editingMixerId) {
      if (!canEditOrDelete) {
        alert('Permission Denied: Only ADMIN accounts can modify vehicles.');
        return;
      }
      const updated = mixers.map(m => m.id === editingMixerId ? {
        ...m,
        ...formData,
        vehicleNo: cleanVNo,
        ownership: 'Company' as const,
        isActive: formData.status !== 'Inactive',
        siteKey: currentSiteKey
      } : m);
      saveToStorage(updated);
    } else {
      const newMixer: TransitMixerTruck = {
        id: `TM-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        vehicleNo: cleanVNo,
        equipmentType: formData.equipmentType || 'Transit Mixer',
        capacityM3: Number(formData.capacityM3) || 9,
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
        status: formData.status,
        ownership: 'Company',
        isActive: formData.status !== 'Inactive',
        notes: formData.notes,
        siteKey: currentSiteKey
      };
      saveToStorage([newMixer, ...mixers]);
    }
    setIsModalOpen(false);
  };

  const filteredMixers = useMemo(() => {
    return mixers.filter(m => {
      const matchesSearch = 
        m.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.driverName && m.driverName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [mixers, searchTerm, statusFilter]);

  const totalCapacity = useMemo(() => {
    return mixers
      .filter(m => m.status === 'Active on Site' || m.status === 'In Transit')
      .reduce((sum, m) => sum + (Number(m.capacityM3) || 0), 0);
  }, [mixers]);

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
            FLEET &amp; MACHINERY LOGISTICS ({currentSiteKey})
          </span>
          <h2 className="text-xl font-black text-white mt-1">Transit Mixer Fleet Management</h2>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenAdd}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transit Mixer</span>
          </button>
        )}
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-mono uppercase font-bold block">Total Mixers</span>
            <strong className="text-white text-lg font-mono">{mixers.length} Trucks</strong>
          </div>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-mono uppercase font-bold block">Combined Batch Capacity</span>
            <strong className="text-cyan-300 text-lg font-mono">{totalCapacity} m³</strong>
          </div>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-mono uppercase font-bold block">Active Fleet</span>
            <strong className="text-emerald-400 text-lg font-mono">
              {mixers.filter(m => m.status === 'Active on Site').length} Ready
            </strong>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0b1322] border border-[#1b273d] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-xl">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Vehicle No or Driver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-white outline-none w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-cyan-400 outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active on Site">Active on Site</option>
              <option value="In Transit">In Transit</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="text-slate-400 text-right">
          Showing <strong className="text-white">{filteredMixers.length}</strong> of {mixers.length} Vehicles
        </div>
      </div>

      {/* Mixer Vehicles Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-6">Vehicle No (V.No)</th>
                <th className="py-4 px-6">Capacity</th>
                <th className="py-4 px-6">Assigned Driver</th>
                <th className="py-4 px-6">Ownership</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Notes</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {filteredMixers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 font-sans">
                    No transit mixers found. Click "+ Add Transit Mixer" above to register one.
                  </td>
                </tr>
              ) : (
                filteredMixers.map((truck) => (
                  <tr key={truck.id} className="hover:bg-[#0e1728] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-400" />
                        <span className="text-white font-black text-sm">{truck.vehicleNo}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-cyan-400 font-bold">{truck.capacityM3} m³</td>
                    <td className="py-4 px-6 font-sans">
                      <strong className="text-slate-200 block text-xs">{truck.driverName || 'Unassigned'}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">{truck.driverPhone || 'No contact'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#121c2d] text-slate-300 border border-[#1b273d]">
                        {truck.ownership}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        truck.status === 'Active on Site' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : truck.status === 'In Transit'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : truck.status === 'Maintenance'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {truck.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-400 text-[11px] truncate max-w-xs font-sans">
                      {truck.notes || '—'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {canEditOrDelete ? (
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(truck)}
                            className="text-slate-400 hover:text-amber-400 p-1.5 transition cursor-pointer"
                            title="Edit Transit Mixer Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(truck.id)}
                            className="text-slate-400 hover:text-rose-400 p-1.5 transition cursor-pointer"
                            title="Delete Transit Mixer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px] inline-flex items-center gap-1 font-mono">
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Only</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Construction Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0b1220] border border-[#1b263b] rounded-3xl w-full max-w-[500px] shadow-2xl p-6 sm:p-7 space-y-6 text-slate-100">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <HardHat className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  {editingMixerId ? 'Edit Construction Vehicle' : 'Add Construction Vehicle'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-sm">
              
              {/* Vehicle / Reg Number */}
              <div className="space-y-2">
                <label className="text-slate-200 font-bold block text-xs tracking-wide">
                  Vehicle / Reg Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.G. 8797 OR KA-28-EX-8901"
                  value={formData.vehicleNo}
                  onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                  className="w-full px-4 py-3 bg-[#060b13] border border-[#172234] rounded-xl text-slate-200 font-medium placeholder:text-slate-600 outline-none focus:border-blue-500 transition text-xs"
                />
              </div>

              {/* Vehicle / Equipment Type */}
              <div className="space-y-2">
                <label className="text-slate-200 font-bold block text-xs tracking-wide">
                  Vehicle / Equipment Type *
                </label>
                <select
                  value={formData.equipmentType}
                  onChange={(e) => setFormData({ ...formData, equipmentType: e.target.value })}
                  className="w-full px-4 py-3 bg-[#060b13] border border-[#172234] rounded-xl text-slate-200 font-medium outline-none focus:border-blue-500 transition cursor-pointer text-xs"
                >
                  <option value="Transit Mixer">Transit Mixer</option>
                  <option value="Tipper / Dump Truck">Tipper / Dump Truck</option>
                  <option value="Concrete Pump">Concrete Pump</option>
                  <option value="Batching Plant Feeder">Batching Plant Feeder</option>
                  <option value="Water Tanker">Water Tanker</option>
                </select>
              </div>

              {/* Drum Capacity */}
              <div className="space-y-2">
                <label className="text-slate-200 font-bold block text-xs tracking-wide">
                  Drum Capacity (m³) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={formData.capacityM3}
                  onChange={(e) => setFormData({ ...formData, capacityM3: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-[#060b13] border border-[#172234] rounded-xl text-slate-200 font-medium outline-none focus:border-blue-500 transition text-xs"
                />
              </div>

              {/* Ownership Type */}
              <div className="space-y-2">
                <label className="text-slate-200 font-bold block text-xs tracking-wide">
                  Ownership Type
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, ownership: 'Company' })}
                  className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs bg-blue-600 text-white shadow-lg shadow-blue-600/30 cursor-default"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Company Owned</span>
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-slate-400 hover:text-white font-medium text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer transition active:scale-95"
                >
                  Save Vehicle
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransitMixerPage;
