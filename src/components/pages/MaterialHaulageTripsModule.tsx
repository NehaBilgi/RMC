import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus,
  Search,
  X,
  Trash2,
  Edit2,
  Truck,
  ChevronDown,
  Printer,
  Fuel,
  Calendar,
  RotateCcw,
  KeyRound,
  Eye,
  Lock
} from 'lucide-react';

export interface HaulageTripRecord {
  id: string;
  tripDate: string;
  siteName: string;
  vehicleNumber: string;
  materialName: string;
  purchasedFrom: string;
  dayTrips: number;
  brassPerTrip: number;
  ratePerBrass: number;
  totalAmount: number;
}

export interface FleetVehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  category: string;
  metricType: 'KM' | 'HMR';
  ownershipType?: 'company' | 'rented';
  rentalRateType?: 'per_day' | 'per_trip';
  rentalAmount?: number;
}

export interface DieselFuelRecord {
  id: string;
  date: string;
  siteName: string;
  vehicleNumber: string;
  litres: number;
  ratePerLitre: number;
  totalCost: number;
}

export interface VendorAdvanceRecord {
  id: string;
  date: string;
  siteName?: string;
  vendorName?: string;
  supplierName?: string;
  amount: number;
  notes?: string;
  paymentMode?: string;
}

const STORAGE_HAULAGE_KEY = 'CONSTRUCTION_PRO_HAULAGE_TRIPS_V2';
const STORAGE_FLEET_KEY = 'CONSTRUCTION_PRO_FLEET_VEHICLES_V1';
const STORAGE_DIESEL_KEY = 'CONSTRUCTION_PRO_DIESEL_LOGS_V1';
const STORAGE_VENDOR_ADVANCES_KEY = 'CONSTRUCTION_PRO_VENDOR_ADVANCES_V1';

const DEFAULT_FLEET: FleetVehicle[] = [
  { id: 'v-1', vehicleNumber: 'KA-28-EX-8901', vehicleType: 'Hydraulic Excavator', category: 'Earthmoving', metricType: 'HMR', ownershipType: 'company' },
  { id: 'v-2', vehicleNumber: '3146', vehicleType: 'Tipper (Hired)', category: 'Haulage', metricType: 'KM', ownershipType: 'rented', rentalRateType: 'per_trip', rentalAmount: 1500 },
  { id: 'v-3', vehicleNumber: '7243', vehicleType: 'Tipper (Hired)', category: 'Haulage', metricType: 'KM', ownershipType: 'rented', rentalRateType: 'per_trip', rentalAmount: 1500 },
  { id: 'v-4', vehicleNumber: '9260', vehicleType: 'Tipper (Hired)', category: 'Haulage', metricType: 'KM', ownershipType: 'rented', rentalRateType: 'per_trip', rentalAmount: 1500 },
  { id: 'v-5', vehicleNumber: '5321', vehicleType: 'Tipper (Hired)', category: 'Haulage', metricType: 'KM', ownershipType: 'rented', rentalRateType: 'per_trip', rentalAmount: 1500 },
  { id: 'v-6', vehicleNumber: '8797', vehicleType: 'Tipper / Dump Truck', category: 'Haulage', metricType: 'KM', ownershipType: 'company' },
  { id: 'v-7', vehicleNumber: '9579', vehicleType: 'Tipper / Dump Truck', category: 'Haulage', metricType: 'KM', ownershipType: 'company' }
];

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'MBBILGI';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

const formatDateDMY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }
  return dateStr;
};

const getCurrentMonthBounds = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { start: format(firstDay), end: format(lastDay) };
};

export const MaterialHaulageTripsModule: React.FC = () => {
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
  const canPrint = userRole === 'ADMIN' || userRole === 'EMPLOYEE';

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
    return 'MBBILGI';
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(getActiveSiteKey());

  const availableRawMaterials = useMemo(() => {
    try {
      const saved = localStorage.getItem('concrete360_raw_materials');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          name: m.name,
          rate: m.ratePerBrass || 1200,
          unit: 'Brass'
        }));
      }
    } catch {}
    return [
      { name: 'Manufactured Sand (M-Sand)', rate: 1150, unit: 'Brass' },
      { name: 'Coarse Aggregate (20mm)', rate: 1250, unit: 'Brass' },
      { name: 'Coarse Aggregate (10mm)', rate: 1350, unit: 'Brass' },
      { name: 'GSB (Granular Sub-Base)', rate: 1500, unit: 'Brass' },
      { name: 'WMM (Wet Mix Macadam)', rate: 1500, unit: 'Brass' },
      { name: 'DBM (Dense Bituminous Macadam)', rate: 5500, unit: 'Brass' }
    ];
  }, []);

  const loadSiteTrips = (siteKey: string) => {
    try {
      const siteTripsRaw = localStorage.getItem(`concrete360_site_haulage_trips_${siteKey}`);
      if (siteTripsRaw) {
        const parsed = JSON.parse(siteTripsRaw);
        if (Array.isArray(parsed)) return parsed;
      }
      const globalRaw = localStorage.getItem(STORAGE_HAULAGE_KEY);
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  };

  const [trips, setTrips] = useState<HaulageTripRecord[]>(() => loadSiteTrips(getActiveSiteKey()));

  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FLEET_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_FLEET;
    } catch {
      return DEFAULT_FLEET;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FLEET_KEY, JSON.stringify(fleetVehicles));
    } catch {}
  }, [fleetVehicles]);

  const [dieselLogs, setDieselLogs] = useState<DieselFuelRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DIESEL_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [advances, setAdvances] = useState<VendorAdvanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VENDOR_ADVANCES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  
  const monthBounds = getCurrentMonthBounds();
  const [fromDate, setFromDate] = useState<string>(monthBounds.start);
  const [toDate, setToDate] = useState<string>(monthBounds.end);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isVehicleMenuOpen, setIsVehicleMenuOpen] = useState(false);
  const vehicleDropdownRef = useRef<HTMLDivElement>(null);

  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [newVNo, setNewVNo] = useState('');
  const [newVOwnership, setNewVOwnership] = useState<'company' | 'rented'>('rented');
  const [newVRentalRate, setNewVRentalRate] = useState<number | ''>(1500);

  const defaultMat = availableRawMaterials[0] || { name: 'Manufactured Sand (M-Sand)', rate: 1150, unit: 'Brass' };
  const [materialName, setMaterialName] = useState(defaultMat.name);
  const [dayTrips, setDayTrips] = useState<number | ''>(3);
  const [brassPerTrip, setBrassPerTrip] = useState<number | ''>(6);
  const [ratePerBrass, setRatePerBrass] = useState<number | ''>(defaultMat.rate);

  // Sync active site changes
  useEffect(() => {
    const handleSync = () => {
      const siteKey = getActiveSiteKey();
      setCurrentSiteKey(siteKey);
      setTrips(loadSiteTrips(siteKey));
    };

    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const selectedVehicleObj = useMemo(() => {
    return fleetVehicles.find(
      (v) => v.vehicleNumber.trim().toUpperCase() === vehicleNumber.trim().toUpperCase()
    );
  }, [fleetVehicles, vehicleNumber]);

  const isSelectedVehicleRented = selectedVehicleObj?.ownershipType === 'rented';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(e.target as Node)) {
        setIsVehicleMenuOpen(false);
        setIsAddingVehicle(false);
        setEditingVehicleId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMaterialChange = (selectedMatName: string) => {
    setMaterialName(selectedMatName);
    const found = availableRawMaterials.find((m: any) => m.name === selectedMatName);
    if (found && !isSelectedVehicleRented) {
      setRatePerBrass(found.rate);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(`concrete360_site_haulage_trips_${currentSiteKey}`, JSON.stringify(trips));
      localStorage.setItem(STORAGE_HAULAGE_KEY, JSON.stringify(trips));
    } catch (error) {
      console.error('Failed saving trips', error);
    }
  }, [trips, currentSiteKey]);

  const computedTotalAmount = useMemo(() => {
    const tripsNum = Number(dayTrips) || 0;
    if (isSelectedVehicleRented) {
      const tripRentalRate = Number(selectedVehicleObj?.rentalAmount) || Number(ratePerBrass) || 1500;
      return tripsNum * tripRentalRate;
    }
    const brassNum = Number(brassPerTrip) || 0;
    const rateNum = Number(ratePerBrass) || 0;
    return tripsNum * brassNum * rateNum;
  }, [dayTrips, brassPerTrip, ratePerBrass, isSelectedVehicleRented, selectedVehicleObj]);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      const matchDate = (!fromDate || t.tripDate >= fromDate) && (!toDate || t.tripDate <= toDate);
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        t.vehicleNumber.toLowerCase().includes(q) ||
        t.materialName.toLowerCase().includes(q) ||
        t.tripDate.includes(q) ||
        formatDateDMY(t.tripDate).includes(q);

      return matchDate && matchQuery;
    });
  }, [trips, fromDate, toDate, searchQuery]);

  const rentedVehiclesMap = useMemo(() => {
    const map = new Map<string, FleetVehicle>();
    fleetVehicles.forEach((v) => {
      map.set(v.vehicleNumber.trim().toUpperCase(), v);
    });
    return map;
  }, [fleetVehicles]);

  const getRowDiesel = (rowDate: string, rowVehicle: string) => {
    const vObj = rentedVehiclesMap.get(rowVehicle.trim().toUpperCase());
    const isRented = vObj?.ownershipType === 'rented';
    if (!isRented) return { litres: 0, cost: 0 };

    const matchingLogs = dieselLogs.filter(
      (d) =>
        d.date === rowDate &&
        d.vehicleNumber.trim().toUpperCase() === rowVehicle.trim().toUpperCase()
    );

    const litres = matchingLogs.reduce((sum, l) => sum + (Number(l.litres) || 0), 0);
    const cost = matchingLogs.reduce((sum, l) => sum + (Number(l.totalCost) || 0), 0);
    return { litres, cost };
  };

  const overallTotals = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        const tr = Number(t.dayTrips) || 0;
        const totalBrass = tr * (Number(t.brassPerTrip) || 0);
        const diesel = getRowDiesel(t.tripDate, t.vehicleNumber);

        const vObj = rentedVehiclesMap.get(t.vehicleNumber.trim().toUpperCase());
        const isRented = vObj?.ownershipType === 'rented';

        let tripAmount = 0;
        if (isRented) {
          const rentalRate = vObj?.rentalAmount ?? Number(t.ratePerBrass) ?? 1500;
          tripAmount = tr * rentalRate;
        } else {
          tripAmount = tr * (Number(t.brassPerTrip) || 0) * (Number(t.ratePerBrass) || 0);
        }

        return {
          trips: acc.trips + tr,
          brass: acc.brass + totalBrass,
          amount: acc.amount + tripAmount,
          dieselLitres: acc.dieselLitres + diesel.litres,
          dieselCost: acc.dieselCost + diesel.cost
        };
      },
      { trips: 0, brass: 0, amount: 0, dieselLitres: 0, dieselCost: 0 }
    );
  }, [filtered, rentedVehiclesMap, dieselLogs]);

  const matchingAdvances = useMemo(() => {
    return advances.filter((a) => {
      const matchDate = (!fromDate || a.date >= fromDate) && (!toDate || a.date <= toDate);
      return matchDate;
    });
  }, [advances, fromDate, toDate]);

  const totalVendorAdvancePaid = useMemo(() => {
    return matchingAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [matchingAdvances]);

  const totalDeductions = totalVendorAdvancePaid + overallTotals.dieselCost;
  const rawBalance = overallTotals.amount - totalDeductions;
  
  const isAdvanceExcess = rawBalance < 0;
  const netPayableAmount = Math.abs(rawBalance);

  const handlePrint = () => {
    if (!canPrint) {
      alert('Permission Denied: Read-Only accounts cannot print records.');
      return;
    }
    window.print();
  };

  const handleOpenAdd = () => {
    if (!canCreate) {
      alert('Permission Denied: Read-Only accounts cannot log trips.');
      return;
    }
    setEditingId(null);
    setTripDate(new Date().toISOString().split('T')[0]);
    setVehicleNumber('');
    setIsVehicleMenuOpen(false);

    setMaterialName(defaultMat.name);
    setDayTrips(3);
    setBrassPerTrip(6);
    setRatePerBrass(defaultMat.rate);

    setIsModalOpen(true);
  };

  const handleEdit = (trip: HaulageTripRecord) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can edit trips.');
      return;
    }
    setEditingId(trip.id);
    setTripDate(trip.tripDate);
    setVehicleNumber(trip.vehicleNumber);
    setMaterialName(trip.materialName);
    setDayTrips(trip.dayTrips);
    setBrassPerTrip(trip.brassPerTrip);
    setRatePerBrass(trip.ratePerBrass);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can delete trips.');
      return;
    }
    if (window.confirm('Delete this record?')) {
      setTrips((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    if (dayTrips === '' || brassPerTrip === '' || ratePerBrass === '') return;

    if (editingId && !canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can modify records.');
      return;
    }

    const record: HaulageTripRecord = {
      id: editingId || `TRIP-${Date.now().toString().slice(-4)}`,
      tripDate,
      siteName: currentSiteKey,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      purchasedFrom: 'RAW MATERIAL CATALOG',
      materialName,
      dayTrips: Number(dayTrips),
      brassPerTrip: Number(brassPerTrip),
      ratePerBrass: Number(ratePerBrass),
      totalAmount: computedTotalAmount
    };

    if (editingId) {
      setTrips(trips.map((t) => (t.id === editingId ? record : t)));
    } else {
      setTrips([record, ...trips]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 font-sans text-slate-100 print:text-black print:space-y-0 w-full max-w-full">
      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              SITE LOGISTICS ({currentSiteKey})
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">Material Haulage Trips</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canPrint && (
            <button 
              onClick={handlePrint} 
              className="px-3.5 py-2.5 rounded-xl bg-[#131d33] hover:bg-[#1a2847] border border-[#1E293B] text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Print to PDF</span>
            </button>
          )}

          {canCreate && (
            <button 
              onClick={handleOpenAdd} 
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/30 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Log Haulage Trips</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <div className="p-4 rounded-2xl bg-[#0B1220] border border-[#1E293B]">
          <div className="text-[10px] font-bold uppercase text-slate-400">Gross Haulage Total</div>
          <div className="text-xl font-black text-white font-mono mt-1">₹{overallTotals.amount.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-500">{overallTotals.trips} Trips ({overallTotals.brass} Brass)</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B1220] border border-[#1E293B]">
          <div className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
            <Fuel className="w-3 h-3 text-amber-400" />
            <span>(-) Less: Rented Diesel</span>
          </div>
          <div className="text-xl font-black text-amber-400 font-mono mt-1">₹{overallTotals.dieselCost.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</div>
          <div className="text-[10px] text-slate-500">{overallTotals.dieselLitres.toFixed(1)} Litres Issued</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B1220] border border-[#1E293B]">
          <div className="text-[10px] font-bold uppercase text-rose-400">(-) Less: Advance Paid</div>
          <div className="text-xl font-black text-rose-400 font-mono mt-1">₹{totalVendorAdvancePaid.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-500">{matchingAdvances.length} Advance Payments Recorded</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isAdvanceExcess ? 'bg-rose-950/20 border-rose-500/30' : 'bg-amber-950/20 border-amber-500/30'}`}>
          <div className={`text-[10px] font-bold uppercase ${isAdvanceExcess ? 'text-rose-400' : 'text-amber-400'}`}>
            {isAdvanceExcess ? '(+) Advance Balance' : '(=) Net Payable'}
          </div>
          <div className={`text-xl font-black font-mono mt-1 ${isAdvanceExcess ? 'text-rose-400' : 'text-amber-400'}`}>
            {isAdvanceExcess ? '+' : ''}₹{netPayableAmount.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
          </div>
          <div className="text-[10px] text-slate-400">
            {isAdvanceExcess ? 'Excess advance holding' : 'Pending balance'}
          </div>
        </div>
      </div>

      {/* Search & Date Range Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0b1322] border border-[#1b273d] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-xl no-print">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by vehicle, material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white outline-none focus:border-blue-500 placeholder-slate-500 font-sans"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <span className="text-slate-400 text-[10px] font-bold uppercase">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-white outline-none cursor-pointer text-xs"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <span className="text-slate-400 text-[10px] font-bold uppercase">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-white outline-none cursor-pointer text-xs"
            />
          </div>

          {(fromDate || toDate || searchQuery) && (
            <button
              onClick={() => {
                const b = getCurrentMonthBounds();
                setFromDate(b.start);
                setToDate(b.end);
                setSearchQuery('');
              }}
              className="px-3 py-2 bg-[#070d1a] hover:bg-[#121c2d] border border-[#1b273d] text-slate-300 hover:text-white rounded-xl transition cursor-pointer flex items-center gap-1.5"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="text-slate-400 text-right">
          Showing <strong className="text-white">{filtered.length}</strong> of {trips.length} records
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#0B1220] border border-[#1E293B] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] text-[10px] font-extrabold uppercase text-slate-400 bg-[#080d19]/80">
                <th className="py-3 px-4 text-left">DATE</th>
                <th className="py-3 px-4 text-center">VEHICLE</th>
                <th className="py-3 px-4 text-left">RAW MATERIAL (CATALOG)</th>
                <th className="py-3 px-3 text-center">TRIPS</th>
                <th className="py-3 px-3 text-right">BRASS / TRIP</th>
                <th className="py-3 px-3 text-right">RATE / BRASS (₹)</th>
                <th className="py-3 px-4 text-right">TOTAL AMOUNT (₹)</th>
                <th className="py-3 px-4 text-center no-print">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No haulage trips logged matching the selected range.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const vObj = rentedVehiclesMap.get(t.vehicleNumber.trim().toUpperCase());
                  const isRented = vObj?.ownershipType === 'rented';

                  let rowGrossAmount = 0;
                  if (isRented) {
                    const rentalRate = vObj?.rentalAmount ?? Number(t.ratePerBrass) ?? 1500;
                    rowGrossAmount = Number(t.dayTrips) * rentalRate;
                  } else {
                    rowGrossAmount = Number(t.dayTrips) * (Number(t.brassPerTrip) || 0) * (Number(t.ratePerBrass) || 0);
                  }

                  return (
                    <tr key={t.id} className="hover:bg-[#121c33]/50 transition-colors">
                      {/* Date First */}
                      <td className="py-3 px-4 font-mono text-left whitespace-nowrap text-slate-300 font-bold">
                        {formatDateDMY(t.tripDate)}
                      </td>
                      
                      {/* Vehicle Number Second */}
                      <td className="py-3 px-4 font-mono text-center">
                        <span className="font-bold text-amber-400">{t.vehicleNumber}</span>
                        {isRented ? (
                          <span className="block text-[9px] text-purple-400 font-sans font-bold uppercase">(Rented)</span>
                        ) : (
                          <span className="block text-[9px] text-blue-400 font-sans font-bold uppercase">(Company)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-bold text-cyan-300">{t.materialName}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">{t.dayTrips}</td>
                      
                      <td className="py-3 px-3 text-right font-mono">
                        {t.brassPerTrip} Brass
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-emerald-400">
                        ₹{(isRented ? (vObj?.rentalAmount ?? t.ratePerBrass) : t.ratePerBrass).toLocaleString('en-IN')} / Brass
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-400">
                        ₹{rowGrossAmount.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-4 text-center no-print">
                        {canEditOrDelete ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => handleEdit(t)} 
                              className="p-1.5 rounded-lg bg-[#121d2f] hover:bg-blue-600/20 text-blue-400 cursor-pointer transition"
                              title="Edit Trip"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(t.id)} 
                              className="p-1.5 rounded-lg bg-[#121d2f] hover:bg-rose-600/20 text-rose-400 cursor-pointer transition"
                              title="Delete Trip"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print animate-in fade-in">
          <div className="bg-[#121927] border border-[#1E293B] rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1E293B] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>{editingId ? 'Edit Haulage Trip' : 'Log Total Day Haulage Trips'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Trip Date *</label>
                <input
                  type="date"
                  required
                  value={tripDate}
                  onChange={(e) => setTripDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Vehicle Number Input with Auto-suggest */}
              <div className="relative" ref={vehicleDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-bold">Vehicle Number *</label>
                  {isSelectedVehicleRented ? (
                    <span className="text-[10px] text-purple-400 font-bold flex items-center gap-1">
                      <KeyRound className="w-3 h-3" /> Hired / Rented Truck Tariff
                    </span>
                  ) : selectedVehicleObj ? (
                    <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Company Owned Vehicle
                    </span>
                  ) : null}
                </div>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="Select or enter vehicle no"
                    value={vehicleNumber}
                    onFocus={() => setIsVehicleMenuOpen(true)}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setVehicleNumber(val);
                      setIsVehicleMenuOpen(true);
                      const vObj = fleetVehicles.find(
                        (v) => v.vehicleNumber.trim().toUpperCase() === val.trim()
                      );
                      if (vObj?.ownershipType === 'rented') {
                        setRatePerBrass(vObj.rentalAmount || 1500);
                      }
                    }}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-[#162032] border border-[#1E293B] focus:border-blue-500 rounded-xl text-white font-mono font-bold uppercase outline-none placeholder:text-slate-500 placeholder:font-normal placeholder:font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setIsVehicleMenuOpen(!isVehicleMenuOpen)}
                    className="absolute right-3 text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${isVehicleMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {isVehicleMenuOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-[#0F172A] border border-[#1E293B] rounded-2xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto space-y-2">
                    <div className="flex items-center justify-between px-2 pb-1 border-b border-[#1E293B]">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Registered Fleet Vehicles</span>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingVehicle(true);
                            setEditingVehicleId(null);
                            setNewVNo('');
                            setNewVOwnership('rented');
                            setNewVRentalRate(1500);
                          }}
                          className="text-[10px] font-bold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Add Vehicle No
                        </button>
                      )}
                    </div>

                    {isAddingVehicle && (
                      <div className="bg-[#162032] border border-blue-500/40 p-3 rounded-xl space-y-2.5">
                        <div className="text-[11px] font-bold text-white flex justify-between items-center">
                          <span>{editingVehicleId ? 'Edit Vehicle' : 'Add New Fleet Vehicle'}</span>
                          <button type="button" onClick={() => setIsAddingVehicle(false)} className="text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Vehicle Number *</label>
                          <input
                            type="text"
                            placeholder="e.g. KA-01-AB-1234"
                            value={newVNo}
                            onChange={(e) => setNewVNo(e.target.value.toUpperCase())}
                            className="w-full px-2.5 py-1.5 bg-[#080d19] border border-[#1E293B] rounded-lg text-white font-mono uppercase text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Ownership</label>
                            <select
                              value={newVOwnership}
                              onChange={(e) => setNewVOwnership(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 bg-[#080d19] border border-[#1E293B] rounded-lg text-white text-xs"
                            >
                              <option value="rented">Hired / Rented</option>
                              <option value="company">Company Owned</option>
                            </select>
                          </div>
                          {newVOwnership === 'rented' && (
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">Trip Rate (₹)</label>
                              <input
                                type="number"
                                value={newVRentalRate}
                                onChange={(e) => setNewVRentalRate(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 bg-[#080d19] border border-[#1E293B] rounded-lg text-amber-400 font-mono text-xs"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!newVNo.trim()) return;
                              const formatted = newVNo.trim().toUpperCase();
                              if (editingVehicleId) {
                                setFleetVehicles(prev => prev.map(v => v.id === editingVehicleId ? {
                                  ...v,
                                  vehicleNumber: formatted,
                                  ownershipType: newVOwnership,
                                  rentalAmount: Number(newVRentalRate) || 1500
                                } : v));
                              } else {
                                const newObj: FleetVehicle = {
                                  id: `v-${Date.now()}`,
                                  vehicleNumber: formatted,
                                  vehicleType: newVOwnership === 'rented' ? 'Tipper (Hired)' : 'Tipper / Dump Truck',
                                  category: 'Haulage',
                                  metricType: 'KM',
                                  ownershipType: newVOwnership,
                                  rentalRateType: 'per_trip',
                                  rentalAmount: Number(newVRentalRate) || 1500
                                };
                                setFleetVehicles(prev => [newObj, ...prev]);
                                setVehicleNumber(formatted);
                              }
                              setIsAddingVehicle(false);
                              setEditingVehicleId(null);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                          >
                            {editingVehicleId ? 'Update' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      {fleetVehicles.map((v) => (
                        <div
                          key={v.id}
                          className="w-full px-2.5 py-2 text-xs flex items-center justify-between hover:bg-[#162032] rounded-xl transition-colors group"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setVehicleNumber(v.vehicleNumber);
                              if (v.ownershipType === 'rented') {
                                setRatePerBrass(v.rentalAmount || 1500);
                              }
                              setIsVehicleMenuOpen(false);
                            }}
                            className="flex items-center gap-2 text-left flex-1 cursor-pointer truncate"
                          >
                            <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-mono font-bold text-white">{v.vehicleNumber}</span>
                            <span className="text-slate-400 text-[11px] truncate">— {v.vehicleType}</span>
                          </button>

                          {canEditOrDelete && (
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0 pl-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingVehicleId(v.id);
                                  setNewVNo(v.vehicleNumber);
                                  setNewVOwnership(v.ownershipType || 'rented');
                                  setNewVRentalRate(v.rentalAmount || 1500);
                                  setIsAddingVehicle(true);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-400 cursor-pointer"
                                title="Edit Vehicle"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete vehicle ${v.vehicleNumber}?`)) {
                                    setFleetVehicles(prev => prev.filter(item => item.id !== v.id));
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                                title="Delete Vehicle"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Raw Material Selection */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Select Raw Material from Catalog *</label>
                <select
                  value={materialName}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-amber-300 font-bold outline-none cursor-pointer focus:border-blue-500"
                >
                  {availableRawMaterials.map((m: any, idx: number) => (
                    <option key={idx} value={m.name}>
                      {m.name} (₹{m.rate} / Brass)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Day Trips *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={dayTrips}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDayTrips(val === '' ? '' : Number(val));
                    }}
                    className="w-full px-3 py-2 bg-[#162032] border border-[#1E293B] rounded-xl text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Brass / Trip *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={brassPerTrip}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBrassPerTrip(val === '' ? '' : Number(val));
                    }}
                    className="w-full px-3 py-2 bg-[#162032] border border-[#1E293B] rounded-xl text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Rate / Brass (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={ratePerBrass}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRatePerBrass(val === '' ? '' : Number(val));
                    }}
                    className="w-full px-3 py-2 bg-[#162032] border border-[#1E293B] rounded-xl text-emerald-400 font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#080d19] border border-[#1E293B] flex justify-between items-center font-mono">
                <div>
                  <span className="text-xs font-bold text-slate-300 block">Total Day Amount:</span>
                  <span className="text-[10px] text-slate-500">
                    {`(${dayTrips || 0} Trips × ${brassPerTrip || 0} Brass × ₹${ratePerBrass || 0})`}
                  </span>
                </div>
                <span className="text-base font-black text-amber-400">
                  ₹{computedTotalAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer font-sans">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer font-sans shadow-lg shadow-blue-600/30 transition">
                  {editingId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialHaulageTripsModule;
