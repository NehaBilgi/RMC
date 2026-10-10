import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Check, X, Truck, Plus, Trash2, Edit2, Printer, Filter, Calendar, RotateCcw, Lock, Eye } from 'lucide-react';

interface RMCInvoice {
  id: string;
  invoiceNo: string;
  clientName: string;
  clientAddress: string;
  clientGstin: string;
  paymentTerms: string;
  projectSite: string;
  siteAddress: string;
  hsnCode: string;
  mixGrade: string;
  vehicleNo: string;
  volumeM3: number;
  unitRate: number;
  applyGst: boolean;
  grandTotal: number;
  date: string;
  workElementId?: string;
}

interface TransitMixerTruck {
  id?: string;
  vehicleNo: string;
  equipmentType?: string;
  capacityM3?: number;
  status?: string;
  ownership?: string;
  isActive?: boolean;
}

interface MaterialCategoryItem {
  id?: string;
  grade?: string;
  name?: string;
  code?: string;
  category?: string;
  description?: string;
  rate?: number;
  unitRate?: number;
  price?: number;
}

const DEFAULT_RECIPES: Record<string, any> = {
  'M20': { rate: 4200, cementKgPerM3: 320, flyAshKgPerM3: 75, waterLitresPerM3: 165, mSandKgPerM3: 726, agg20mmKgPerM3: 726, agg10mmKgPerM3: 388 },
  'M25': { rate: 4500, cementKgPerM3: 350, flyAshKgPerM3: 60, waterLitresPerM3: 165, mSandKgPerM3: 720, agg20mmKgPerM3: 680, agg10mmKgPerM3: 450 },
  'M30': { rate: 4800, cementKgPerM3: 380, flyAshKgPerM3: 70, waterLitresPerM3: 160, mSandKgPerM3: 700, agg20mmKgPerM3: 700, agg10mmKgPerM3: 460 },
  'M35': { rate: 5200, cementKgPerM3: 410, flyAshKgPerM3: 80, waterLitresPerM3: 155, mSandKgPerM3: 680, agg20mmKgPerM3: 710, agg10mmKgPerM3: 470 },
  'M40': { rate: 5600, cementKgPerM3: 440, flyAshKgPerM3: 90, waterLitresPerM3: 150, mSandKgPerM3: 660, agg20mmKgPerM3: 720, agg10mmKgPerM3: 480 }
};

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'MBBILGI';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

const formatDateDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
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

export const BillingRMC: React.FC = () => {
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
  const canPrint = userRole === 'ADMIN' || userRole === 'EMPLOYEE'; // READ_ONLY disabled from printing

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const monthBounds = getCurrentMonthBounds();
  const [fromDate, setFromDate] = useState<string>(monthBounds.start);
  const [toDate, setToDate] = useState<string>(monthBounds.end);

  const [siteDetails, setSiteDetails] = useState({
    clientName: 'MMBILGI',
    clientAddress: 'AL-AMNI ROAD TIKOTA',
    clientGstin: '27AABCG1234F1Z8',
    paymentTerms: 'Advance',
    projectSite: 'RETAINING WALL',
    siteAddress: 'AL-AMNI ROAD TIKOTA',
    hsnCode: '38245010 (Ready-Mix Concrete)'
  });

  const [measurementItems, setMeasurementItems] = useState<any[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('ALL');

  const [invoices, setInvoices] = useState<RMCInvoice[]>([]);
  const [materialGrades, setMaterialGrades] = useState<MaterialCategoryItem[]>([]);
  const [mixGrade, setMixGrade] = useState('M20');

  // Transit Mixer state loaded from TransitMixerPage storage
  const [transitTrucks, setTransitTrucks] = useState<TransitMixerTruck[]>([]);
  const [selectedVehicleNo, setSelectedVehicleNo] = useState<string>('');
  
  const [totalReportVolume, setTotalReportVolume] = useState<number>(0);
  const [remainingVolume, setRemainingVolume] = useState<number>(0);
  const [volumeM3, setVolumeM3] = useState<any>(9);
  const [unitRate, setUnitRate] = useState<any>(4200);
  const [applyGst, setApplyGst] = useState(true);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const loadMaterialCategories = () => {
    try {
      const keys = ['concrete360_material_categories', 'pave_material_categories', 'concrete360_mix_designs', 'concrete360_mixes'];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMaterialGrades(parsed);
            return;
          }
        }
      }
    } catch {}

    setMaterialGrades([
      { grade: 'M20', rate: 4200 },
      { grade: 'M25', rate: 4500 },
      { grade: 'M30', rate: 4800 },
      { grade: 'M35', rate: 5200 },
      { grade: 'M40', rate: 5600 }
    ]);
  };

  const fetchRateForGrade = (gradeStr: string) => {
    const code = gradeStr.substring(0, 3).toUpperCase();
    const found = materialGrades.find(m => String(m.grade || m.name || m.code || '').toUpperCase().includes(code));
    if (found && (found.rate || found.unitRate || found.price)) {
      return Number(found.rate || found.unitRate || found.price);
    }
    return DEFAULT_RECIPES[code]?.rate || 4500;
  };

  const handleMixGradeChange = (newGrade: string) => {
    setMixGrade(newGrade);
    const resolvedRate = fetchRateForGrade(newGrade);
    setUnitRate(resolvedRate);
  };

  const loadTransitMixers = (siteKey: string) => {
    const possibleMixerKeys = [
      `concrete360_transit_mixers_${siteKey}`,
      'concrete360_transit_mixers',
      `concrete360_transit_mixer_fleet_${siteKey}`,
      'concrete360_transit_mixer_fleet',
      `concrete360_site_transit_mixers_${siteKey}`,
      'pave_transit_mixers',
      'concrete360_fleet_vehicles'
    ];

    let foundMixers: any[] = [];
    for (const key of possibleMixerKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            foundMixers = parsed;
            break;
          }
        } catch {}
      }
    }

    let parsedTrucks: TransitMixerTruck[] = [];
    if (foundMixers.length > 0) {
      parsedTrucks = foundMixers
        .map((v: any) => {
          const vNo = String(
            v.vehicleNo ||
            v.vehicleNumber ||
            v.vNo ||
            v.truckNo ||
            v.regNo ||
            v.number ||
            v.name ||
            v.id ||
            ''
          ).trim();

          const eqType = String(v.equipmentType || v.type || v.category || 'Transit Mixer').trim();
          const cap = Number(v.mixerCapacity || v.capacityM3 || v.capacity || 9);
          const statusText = String(v.status || '').toLowerCase();
          const isActive = v.isActive !== false && !statusText.includes('inactive') && !statusText.includes('breakdown');

          return {
            id: v.id ? String(v.id) : undefined,
            vehicleNo: vNo,
            equipmentType: eqType,
            capacityM3: isNaN(cap) || cap <= 0 ? 9 : cap,
            status: v.status || 'Active',
            isActive
          };
        })
        .filter(v => {
          const isMixer =
            v.equipmentType.toLowerCase().includes('mixer') ||
            v.equipmentType.toLowerCase().includes('transit') ||
            !v.equipmentType;
          return v.vehicleNo.length > 0 && isMixer && v.isActive;
        });
    }

    const finalTrucks = parsedTrucks.length > 0
      ? parsedTrucks
      : [{ vehicleNo: '7196', equipmentType: 'Transit Mixer', capacityM3: 9, isActive: true }];

    setTransitTrucks(finalTrucks);
    return finalTrucks;
  };

  const loadSiteData = () => {
    const siteKey = getActiveSiteKey();
    setCurrentSiteKey(siteKey);
    loadMaterialCategories();

    try {
      let foundSite: any = null;
      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        try { foundSite = JSON.parse(activeRaw); } catch {}
      }

      const ongoingRaw = localStorage.getItem('concrete360_ongoing_sites');
      if (ongoingRaw) {
        const parsedList = JSON.parse(ongoingRaw);
        if (Array.isArray(parsedList) && parsedList.length > 0) {
          const match = parsedList.find((s: any) => extractCleanSiteName(s.name || s.id) === siteKey);
          if (match) foundSite = match;
        }
      }

      if (foundSite) {
        setSiteDetails({
          clientName: foundSite.client || foundSite.clientName || siteKey,
          clientAddress: foundSite.location || foundSite.address || 'Ainapur Site',
          clientGstin: foundSite.gstin || '29AKMKMJNJN1',
          paymentTerms: foundSite.paymentTerms || 'Advance',
          projectSite: foundSite.name || foundSite.projectName || siteKey,
          siteAddress: foundSite.location || foundSite.address || 'Ainapur Site',
          hsnCode: foundSite.hsnCode || '38245010 (Ready-Mix Concrete)'
        });
      }

      const loadedTrucks = loadTransitMixers(siteKey);

      // Load Invoices for active normalized site
      const savedInvoices = localStorage.getItem(`concrete360_site_invoices_${siteKey}`);
      let existingInvoices: RMCInvoice[] = [];
      if (savedInvoices) {
        const parsedI = JSON.parse(savedInvoices);
        if (Array.isArray(parsedI)) {
          existingInvoices = parsedI;
          setInvoices(parsedI);
        } else {
          setInvoices([]);
        }
      } else {
        setInvoices([]);
      }

      // Load Measurements & Remaining Volumes
      let measurementsRaw = localStorage.getItem(`concrete360_advanced_measurements_${siteKey}`);
      let parsedM: any[] = [];
      if (measurementsRaw) {
        try {
          const arr = JSON.parse(measurementsRaw);
          if (Array.isArray(arr)) parsedM = arr;
        } catch {}
      }

      setMeasurementItems(parsedM);
      const netTotalVol = parsedM.reduce((sum: number, it: any) => sum + (Number(it.volumeM3) || 0), 0);
      
      let wastage = 5;
      const measurementSession = localStorage.getItem('concrete360_measurement');
      if (measurementSession) {
        try {
          const parsedS = JSON.parse(measurementSession);
          if (parsedS.safetyWastagePercent !== undefined) {
            wastage = Number(parsedS.safetyWastagePercent);
          }
        } catch {}
      }
      const grossTotalVol = netTotalVol * (1 + wastage / 100);
      setTotalReportVolume(Number(grossTotalVol.toFixed(2)));

      const alreadyInvoiced = existingInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.volumeM3) || 0), 0);
      let rem = Math.max(0, grossTotalVol - alreadyInvoiced);
      rem = Number(rem.toFixed(2));
      setRemainingVolume(rem);

      if (selectedWorkId !== 'ALL') {
        const selItem = parsedM.find(it => it.id === selectedWorkId);
        if (selItem) {
          const selGross = (Number(selItem.volumeM3) || 0) * (1 + wastage / 100);
          const workAlreadyInvoiced = existingInvoices
            .filter(inv => inv.workElementId === selectedWorkId)
            .reduce((sum, inv) => sum + (Number(inv.volumeM3) || 0), 0);
          rem = Number(Math.max(0, selGross - workAlreadyInvoiced).toFixed(2));
          setRemainingVolume(rem);
        }
      }

      let activeVNo = selectedVehicleNo;
      if (!activeVNo || !loadedTrucks.some(t => t.vehicleNo === activeVNo)) {
        activeVNo = loadedTrucks[0]?.vehicleNo || '7196';
        setSelectedVehicleNo(activeVNo);
      }

      const activeMixer = loadedTrucks.find(t => t.vehicleNo === activeVNo) || loadedTrucks[0];
      const mixerCapacity = activeMixer?.capacityM3 || 9;
      const defaultVol = rem > 0 && rem < mixerCapacity ? rem : mixerCapacity;
      setVolumeM3(defaultVol);

    } catch {}
  };

  useEffect(() => {
    loadSiteData();

    const handleSync = () => loadSiteData();
    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('concrete360_transit_mixer_updated', handleSync);
    window.addEventListener('concrete360_fleet_updated', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('concrete360_transit_mixer_updated', handleSync);
      window.removeEventListener('concrete360_fleet_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(`concrete360_site_invoices_${currentSiteKey}`, JSON.stringify(invoices));
    } catch {}
  }, [invoices, currentSiteKey]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!inv.date) return true;
      if (fromDate && inv.date < fromDate) return false;
      if (toDate && inv.date > toDate) return false;
      return true;
    });
  }, [invoices, fromDate, toDate]);

  const handleVehicleChange = (vNo: string) => {
    setSelectedVehicleNo(vNo);
    const matched = transitTrucks.find(t => t.vehicleNo === vNo);
    if (matched && matched.capacityM3) {
      const cap = Number(matched.capacityM3);
      const autoVol = remainingVolume > 0 && remainingVolume < cap ? remainingVolume : cap;
      setVolumeM3(autoVol);
    }
  };

  const handleWorkElementChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wId = e.target.value;
    setSelectedWorkId(wId);
    if (wId === 'ALL') {
      loadSiteData();
    } else {
      const item = measurementItems.find(it => it.id === wId);
      if (item) {
        let wastage = 5;
        try {
          const measurementSession = localStorage.getItem('concrete360_measurement');
          if (measurementSession) {
            const parsedS = JSON.parse(measurementSession);
            if (parsedS.safetyWastagePercent !== undefined) wastage = Number(parsedS.safetyWastagePercent);
          }
        } catch {}

        const grossVol = (Number(item.volumeM3) || 0) * (1 + wastage / 100);
        const alreadyInvoiced = invoices
          .filter(inv => inv.workElementId === wId)
          .reduce((sum, inv) => sum + (Number(inv.volumeM3) || 0), 0);
        const rem = Number(Math.max(0, grossVol - alreadyInvoiced).toFixed(2));
        setRemainingVolume(rem);

        const currentTruck = transitTrucks.find(t => t.vehicleNo === selectedVehicleNo);
        const cap = currentTruck?.capacityM3 || 9;
        setVolumeM3(rem > 0 && rem < cap ? rem : cap);

        if (item.mixGrade) {
          const gradeCode = item.mixGrade;
          setMixGrade(gradeCode);
          setUnitRate(fetchRateForGrade(gradeCode));
        }
      }
    }
  };

  const numVolume = Number(volumeM3) || 0;
  const numRate = Number(unitRate) || 0;
  const subtotal = numVolume * numRate;
  const gstAmount = applyGst ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gstAmount;

  const currentMixerCapacity = useMemo(() => {
    const found = transitTrucks.find(t => t.vehicleNo === selectedVehicleNo);
    return found?.capacityM3 || 9;
  }, [transitTrucks, selectedVehicleNo]);

  const handleOpenAddModal = () => {
    if (!canCreate) {
      alert('Read-Only mode: Data entry is restricted.');
      return;
    }
    loadSiteData();
    setEditingInvoiceId(null);
    if (transitTrucks.length > 0) {
      const firstTruck = transitTrucks[0];
      setSelectedVehicleNo(firstTruck.vehicleNo);
      const cap = firstTruck.capacityM3 || 9;
      const initialVol = remainingVolume > 0 && remainingVolume < cap ? remainingVolume : cap;
      setVolumeM3(initialVol);
    }
    setApplyGst(true);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (inv: RMCInvoice) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can edit invoices.');
      return;
    }
    setEditingInvoiceId(inv.id);
    setMixGrade(inv.mixGrade);
    setSelectedVehicleNo(inv.vehicleNo || (transitTrucks[0]?.vehicleNo ?? '7196'));
    setVolumeM3(inv.volumeM3);
    setUnitRate(inv.unitRate);
    setApplyGst(inv.applyGst ?? true);
    setInvoiceDate(inv.date || new Date().toISOString().split('T')[0]);
    if (inv.workElementId) {
      setSelectedWorkId(inv.workElementId);
      const item = measurementItems.find(it => it.id === inv.workElementId);
      if (item) {
        let wastage = 5;
        try {
          const measurementSession = localStorage.getItem('concrete360_measurement');
          if (measurementSession) {
            const parsedS = JSON.parse(measurementSession);
            if (parsedS.safetyWastagePercent !== undefined) wastage = Number(parsedS.safetyWastagePercent);
          }
        } catch {}

        const grossVol = (Number(item.volumeM3) || 0) * (1 + wastage / 100);
        const otherInvoices = invoices.filter(i => i.workElementId === inv.workElementId && i.id !== inv.id);
        const alreadyInvoiced = otherInvoices.reduce((sum, i) => sum + (Number(i.volumeM3) || 0), 0);
        setRemainingVolume(Number(Math.max(0, grossVol - alreadyInvoiced).toFixed(2)));
      }
    } else {
      setSelectedWorkId('ALL');
    }
    setIsModalOpen(true);
  };

  const handlePrintInvoice = (inv: RMCInvoice) => {
    if (!canPrint) {
      alert('Permission Denied: Read-Only accounts cannot print invoice documents.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let compProfile = {
      name: 'BILGI RMC',
      gstin: '29AKMKMJNJN1',
      address: 'AINAPUR',
      division: 'Commercial Ready-Mix Concrete Batching & Supply Division',
      bankName: 'KOTAK MAHINDRA BANK',
      accountName: 'M/s MOHAMMED JAFAR BASHEER AHMED BILGI',
      accountNo: '9449817122',
      ifscSwift: 'KKBK0008324',
      branch: 'JALANAGAR , HUDCO'
    };

    try {
      const savedProf = localStorage.getItem('concrete360_company_profile');
      if (savedProf) {
        const parsedP = JSON.parse(savedProf);
        compProfile = { ...compProfile, ...parsedP };
      }
    } catch {}

    const sub = inv.volumeM3 * inv.unitRate;
    const isGstActive = inv.applyGst ?? true;
    const cgst = isGstActive ? sub * 0.09 : 0;
    const sgst = isGstActive ? sub * 0.09 : 0;
    const calculatedGrandTotal = sub + cgst + sgst;

    const gradeKey = (inv.mixGrade || 'M20').substring(0, 3).toUpperCase();
    let recipe = DEFAULT_RECIPES[gradeKey] || DEFAULT_RECIPES['M20'];

    try {
      const keysToCheck = ['concrete360_mix_designs', 'concrete360_mix_design_recipes', 'concrete360_mixes', 'pave_mix_designs'];
      for (const key of keysToCheck) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const found = parsed.find((d: any) => String(d.grade || d.code || '').toUpperCase().includes(gradeKey));
            if (found) {
              recipe = {
                cementKgPerM3: Number(found.cementKgPerM3 ?? found.cement ?? recipe.cementKgPerM3),
                flyAshKgPerM3: Number(found.flyAshKgPerM3 ?? found.flyAsh ?? recipe.flyAshKgPerM3),
                waterLitresPerM3: Number(found.waterLitresPerM3 ?? found.water ?? recipe.waterLitresPerM3),
                mSandKgPerM3: Number(found.mSandKgPerM3 ?? found.sand ?? recipe.mSandKgPerM3),
                agg20mmKgPerM3: Number(found.agg20mmKgPerM3 ?? found.agg20 ?? recipe.agg20mmKgPerM3),
                agg10mmKgPerM3: Number(found.agg10mmKgPerM3 ?? found.agg10 ?? recipe.agg10mmKgPerM3)
              };
              break;
            }
          }
        }
      }
    } catch {}

    let linkedReport = null;
    if (inv.workElementId && measurementItems.length > 0) {
      linkedReport = measurementItems.find(it => it.id === inv.workElementId);
    }

    const cementKg = Math.round(inv.volumeM3 * recipe.cementKgPerM3);
    const flyAshKg = Math.round(inv.volumeM3 * recipe.flyAshKgPerM3);
    const mSandKg = Math.round(inv.volumeM3 * recipe.mSandKgPerM3);
    const agg20Kg = Math.round(inv.volumeM3 * recipe.agg20mmKgPerM3);
    const agg10Kg = Math.round(inv.volumeM3 * recipe.agg10mmKgPerM3);
    const waterLtr = Math.round(inv.volumeM3 * recipe.waterLitresPerM3);
    const formattedPrintDate = formatDateDDMMYYYY(inv.date);

    printWindow.document.write(`
      <html>
        <head>
          <title></title>
          <style>
            @page {
              size: A4;
              margin: 0mm;
            }
            body { font-family: Helvetica, Arial, sans-serif; padding: 20mm; color: #111; font-size: 11px; line-height: 1.4; margin: 0; }
            .top-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 12px; }
            .brand h1 { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
            .brand h1 span { color: #f97316; }
            .brand p { font-size: 9px; color: #475569; margin: 3px 0 0 0; }
            .invoice-meta { text-align: right; }
            .parties { display: flex; justify-content: space-between; border: 1px solid #cbd5e1; margin-bottom: 12px; background: #f8fafc; }
            .party-box { width: 50%; padding: 10px; }
            .party-box:first-child { border-right: 1px solid #cbd5e1; }
            .party-title { font-weight: bold; font-size: 10px; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            th { background: #0f172a; color: #ffffff; font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 6px 8px; text-align: left; border: 1px solid #0f172a; }
            td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; }
            .text-right { text-align: right; }
            .summary-section { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .bank-box { width: 55%; border: 1px solid #cbd5e1; padding: 8px; background: #f8fafc; font-size: 9px; }
            .totals-box { width: 42%; border: 1px solid #cbd5e1; }
            .totals-row { display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #cbd5e1; font-size: 10px; }
            .totals-row:last-child { border-bottom: none; font-weight: bold; background: #f1f5f9; font-size: 11px; color: #0f172a; }
            .material-breakdown { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; font-size: 10px; margin-bottom: 20px; }
            .material-breakdown-title { font-weight: bold; color: #0f172a; margin-bottom: 6px; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 25px; font-size: 9px; }
            .sig-line { width: 160px; border-top: 1px dashed #64748b; text-align: center; padding-top: 4px; }
          </style>
        </head>
        <body>
          <div class="top-header">
            <div class="brand">
              <h1>${compProfile.name}</h1>
              <p>${compProfile.division}<br/>
              Corporate Office: ${compProfile.address}<br/>
              Company GSTIN: <strong>${compProfile.gstin}</strong></p>
            </div>
            <div class="invoice-meta">
              <div style="font-size: 10px; color: #334155;">
                Invoice Date: <strong>${formattedPrintDate}</strong><br/>
                ${linkedReport ? `Linked Report ID: <strong>${linkedReport.id}</strong>` : ''}
              </div>
            </div>
          </div>

          <div class="parties">
            <div class="party-box">
              <div class="party-title">Billed To (Buyer Details):</div>
              <div><strong>${inv.clientName}</strong></div>
              <div>${inv.clientAddress}</div>
              <div>GSTIN / Tax ID: ${inv.clientGstin}</div>
              <div>Payment Terms: ${inv.paymentTerms}</div>
            </div>
            <div class="party-box">
              <div class="party-title">Delivery / Site Dispatch Destination:</div>
              <div><strong>Project:</strong> ${inv.projectSite}</div>
              <div><strong>Site Address:</strong> ${inv.siteAddress}</div>
              <div><strong>HSN/SAC Code:</strong> ${inv.hsnCode}</div>
              <div><strong>Transit Mixer Billed:</strong> 1 Load (${inv.volumeM3} m³ total) [V.No: ${inv.vehicleNo}]</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 45%;">Description of Goods / Services</th>
                <th style="width: 15%;">HSN/SAC</th>
                <th style="width: 10%;">Qty</th>
                <th style="width: 12%;">Unit Rate (₹)</th>
                <th style="width: 13%;" class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>
                  <strong>Ready-Mix Grade: ${inv.mixGrade}</strong><br/>
                  <span style="font-size:10px; font-weight:bold; color:#0f172a;">Vehicle No (Transit Mixer): ${inv.vehicleNo || 'N/A'}</span><br/>
                  <span style="font-size:9px; color:#555;">Batch delivery as per IS 4926 / ASTM C94 quality dockets</span>
                </td>
                <td>38245010</td>
                <td>${inv.volumeM3.toFixed(2)} m³</td>
                <td>₹${inv.unitRate.toLocaleString('en-IN')}</td>
                <td class="text-right">₹${Math.round(sub).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-section">
            <div class="bank-box">
              <strong>COMPANY REMITTANCE BANK ACCOUNT:</strong><br/>
              Bank Name: ${compProfile.bankName}<br/>
              Account Name: ${compProfile.accountName}<br/>
              Account Number: ${compProfile.accountNo}<br/>
              IFSC / Swift: ${compProfile.ifscSwift} | Branch: ${compProfile.branch}
            </div>
            <div class="totals-box">
              <div class="totals-row"><span>Subtotal (Taxable Value):</span><span>₹${Math.round(sub).toLocaleString('en-IN')}</span></div>
              ${isGstActive ? `
                <div class="totals-row"><span>CGST (9%):</span><span>₹${Math.round(cgst).toLocaleString('en-IN')}</span></div>
                <div class="totals-row"><span>SGST / UTGST (9%):</span><span>₹${Math.round(sgst).toLocaleString('en-IN')}</span></div>
              ` : ''}
              <div class="totals-row" style="font-weight: bold; background: #f1f5f9; color: #0f172a; font-size: 11px;"><span>PAYABLE AMOUNT:</span><span>₹${Math.round(calculatedGrandTotal).toLocaleString('en-IN')}</span></div>
            </div>
          </div>

          <div class="material-breakdown">
            <div class="material-breakdown-title">BATCH MATERIAL BREAKDOWN TABLE (LINKED REPORT CONSUMPTION FOR ${inv.volumeM3} M³):</div>
            <table>
              <thead>
                <tr>
                  <th>Material Component</th>
                  <th class="text-right">Proportion per m³</th>
                  <th class="text-right">Total Quantity (${inv.volumeM3} m³)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Cement (OPC)</td><td class="text-right">${recipe.cementKgPerM3} kg/m³</td><td class="text-right"><strong>${cementKg.toLocaleString('en-IN')} kg</strong></td></tr>
                <tr><td>Fly Ash</td><td class="text-right">${recipe.flyAshKgPerM3} kg/m³</td><td class="text-right"><strong>${flyAshKg.toLocaleString('en-IN')} kg</strong></td></tr>
                <tr><td>M-Sand</td><td class="text-right">${recipe.mSandKgPerM3} kg/m³</td><td class="text-right"><strong>${mSandKg.toLocaleString('en-IN')} kg</strong></td></tr>
                <tr><td>20MM Aggregate</td><td class="text-right">${recipe.agg20mmKgPerM3} kg/m³</td><td class="text-right"><strong>${agg20Kg.toLocaleString('en-IN')} kg</strong></td></tr>
                <tr><td>10MM Aggregate</td><td class="text-right">${recipe.agg10mmKgPerM3} kg/m³</td><td class="text-right"><strong>${agg10Kg.toLocaleString('en-IN')} kg</strong></td></tr>
                <tr><td>Batching Water</td><td class="text-right">${recipe.waterLitresPerM3} L/m³</td><td class="text-right"><strong>${waterLtr.toLocaleString('en-IN')} Litres</strong></td></tr>
              </tbody>
            </table>
          </div>

          <div class="signatures">
            <div class="sig-line">Customer / Receiver Signature & Stamp</div>
            <div class="sig-line" style="visibility: hidden;"></div>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      alert('Permission Denied: Read-Only accounts cannot create or modify invoices.');
      return;
    }
    loadSiteData();

    if (editingInvoiceId) {
      if (!canEditOrDelete) {
        alert('Permission Denied: Only ADMIN accounts can modify records.');
        return;
      }
      const oldInv = invoices.find(i => i.id === editingInvoiceId);
      const oldVol = oldInv ? oldInv.volumeM3 : 0;
      const volDiff = numVolume - oldVol;

      if (remainingVolume - volDiff < 0) {
        alert('Volume exceeds remaining report balance!');
        return;
      }

      setInvoices(prev => prev.map(i => i.id === editingInvoiceId ? {
        ...i,
        clientName: siteDetails.clientName,
        clientAddress: siteDetails.clientAddress,
        clientGstin: siteDetails.clientGstin,
        paymentTerms: siteDetails.paymentTerms,
        projectSite: siteDetails.projectSite,
        siteAddress: siteDetails.siteAddress,
        hsnCode: siteDetails.hsnCode,
        mixGrade,
        vehicleNo: selectedVehicleNo || 'N/A',
        volumeM3: numVolume,
        unitRate: numRate,
        applyGst,
        grandTotal: Math.round(grandTotal),
        date: invoiceDate,
        workElementId: selectedWorkId
      } : i));

      setRemainingVolume(prev => Number((prev - volDiff).toFixed(2)));
    } else {
      const newInvoice: RMCInvoice = {
        id: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceNo: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
        clientName: siteDetails.clientName,
        clientAddress: siteDetails.clientAddress,
        clientGstin: siteDetails.clientGstin,
        paymentTerms: siteDetails.paymentTerms,
        projectSite: siteDetails.projectSite,
        siteAddress: siteDetails.siteAddress,
        hsnCode: siteDetails.hsnCode,
        mixGrade,
        vehicleNo: selectedVehicleNo || 'N/A',
        volumeM3: numVolume,
        unitRate: numRate,
        applyGst,
        grandTotal: Math.round(grandTotal),
        date: invoiceDate,
        workElementId: selectedWorkId
      };

      setInvoices(prev => [newInvoice, ...prev]);
      setRemainingVolume(prev => Number(Math.max(0, prev - numVolume).toFixed(2)));
    }

    setIsModalOpen(false);
  };

  const handleDeleteInvoice = (id: string, deletedVol: number) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: EMPLOYEE and READ_ONLY roles cannot delete invoices.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    setInvoices(prev => prev.filter(i => i.id !== id));
    setRemainingVolume(prev => Number((prev + deletedVol).toFixed(2)));
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Header & Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
            BILLING &amp; INVOICING ({currentSiteKey}) [Client: {siteDetails.clientName}]
          </span>
          <h2 className="text-xl font-black text-white mt-1">Customer RMC Tax Invoices</h2>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>+ Generate Customer Invoice</span>
          </button>
        )}
      </div>

      {/* Remaining Report Volume Banner */}
      <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex items-center justify-between font-mono text-xs shadow-xl">
        <div>
          <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Report Volume</span>
          <strong className="text-white text-sm">{totalReportVolume} m³</strong>
        </div>
        <div className="border-l border-[#1b273d] pl-4">
          <span className="text-cyan-400 uppercase text-[10px] font-bold block">Remaining Balance for Next Trip</span>
          <strong className="text-cyan-300 text-sm">{remainingVolume} m³</strong>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0b1322] border border-[#1b273d] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
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

          {(fromDate || toDate) && (
            <button
              onClick={() => {
                const b = getCurrentMonthBounds();
                setFromDate(b.start);
                setToDate(b.end);
              }}
              className="px-3 py-2 bg-[#070d1a] hover:bg-[#121c2d] border border-[#1b273d] text-slate-300 hover:text-white rounded-xl transition cursor-pointer flex items-center gap-1.5"
              title="Reset to Current Month"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset Month</span>
            </button>
          )}
        </div>

        <div className="text-slate-400 text-right">
          Showing <strong className="text-white">{filteredInvoices.length}</strong> of {invoices.length} invoices
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Vehicle No</th>
                <th className="py-4 px-6">Client Name</th>
                <th className="py-4 px-6">Mix Grade</th>
                <th className="py-4 px-6">Volume</th>
                <th className="py-4 px-6">Grand Total</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 font-sans">
                    No tax invoices found matching the selected date range for this site.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#0e1728] transition-colors">
                    {/* Date Column First */}
                    <td className="py-4 px-6 text-slate-300 font-bold">{formatDateDDMMYYYY(inv.date)}</td>
                    
                    {/* Vehicle No Column Second */}
                    <td className="py-4 px-6 text-amber-400 font-black text-sm">{inv.vehicleNo || 'N/A'}</td>
                    
                    <td className="py-4 px-6 font-sans font-bold text-cyan-300">{inv.clientName}</td>
                    <td className="py-4 px-6 text-cyan-400">{inv.mixGrade}</td>
                    <td className="py-4 px-6 font-bold">{inv.volumeM3} m³</td>
                    <td className="py-4 px-6 text-emerald-400 font-extrabold">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {canPrint && (
                          <button
                            onClick={() => handlePrintInvoice(inv)}
                            className="text-slate-400 hover:text-cyan-400 p-1 transition cursor-pointer"
                            title="Print Professional Tax Invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}

                        {canEditOrDelete && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(inv)}
                              className="text-slate-400 hover:text-blue-400 p-1 transition cursor-pointer"
                              title="Edit Invoice"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteInvoice(inv.id, inv.volumeM3)}
                              className="text-slate-400 hover:text-rose-400 p-1 transition cursor-pointer"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {!canPrint && !canEditOrDelete && (
                          <span className="text-slate-500 text-[10px] flex items-center gap-1 font-mono">
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Only</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Generation / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 font-mono max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1b273d] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">
                    {editingInvoiceId ? 'EDIT CUSTOMER RMC INVOICE' : 'GENERATE CUSTOMER RMC INVOICE'}
                  </h3>
                  <p className="text-[11px] text-cyan-400 font-mono">
                    Active Client: <strong className="text-white">{siteDetails.clientName}</strong> | Site: {currentSiteKey}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-[#121c2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4 text-xs">
              {/* Work Element Selector */}
              <div className="bg-[#070d1a] border border-[#1b273d] p-3 rounded-2xl space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                  <Filter className="w-3.5 h-3.5 text-blue-400" />
                  <span>Select Structural Work Element (Linked Report):</span>
                </label>
                <select
                  value={selectedWorkId}
                  onChange={handleWorkElementChange}
                  className="w-full px-3 py-2.5 bg-[#0b1322] border border-[#1b273d] rounded-xl text-white font-bold outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Site Works Combined</option>
                  {measurementItems.map(it => (
                    <option key={it.id} value={it.id}>
                      {it.id}: {it.label} ({it.volumeM3} m³)
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Date */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Invoice Date:</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500 text-xs"
                />
              </div>

              {/* Concrete Mix Grade */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">Concrete Mix Grade (From Category of Material)</label>
                <select
                  value={mixGrade}
                  onChange={(e) => handleMixGradeChange(e.target.value)}
                  className="w-full px-3 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none cursor-pointer text-xs"
                >
                  {materialGrades.map((mat, idx) => {
                    const gradeLabel = `${mat.grade || mat.name || 'M25'}`;
                    return (
                      <option key={idx} value={gradeLabel}>
                        {gradeLabel}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Vehicle Number (From TransitMixerPage) */}
              <div className="bg-[#070d1a] border border-[#1b273d] p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span>Vehicle Number:</span>
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">From Transit Mixer Page</span>
                </div>

                <select
                  value={selectedVehicleNo}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0b1322] border border-[#1b273d] rounded-xl text-amber-400 font-bold outline-none cursor-pointer text-xs"
                >
                  {transitTrucks.map((t, idx) => (
                    <option key={t.id || idx} value={t.vehicleNo}>
                      {t.vehicleNo} {t.capacityM3 ? `(${t.capacityM3} m³)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-bold uppercase tracking-wider">Volume (m³)</label>
                    <span className={`text-[10px] font-bold ${remainingVolume > 0 && remainingVolume < currentMixerCapacity ? 'text-amber-400' : 'text-cyan-400'}`}>
                      {remainingVolume > 0 && remainingVolume < currentMixerCapacity
                        ? `Rem. Balance (${remainingVolume} m³)`
                        : `Capacity (${currentMixerCapacity} m³)`}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={volumeM3}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVolumeM3(val === '' ? '' : Number(val));
                    }}
                    className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none focus:border-blue-500 text-sm"
                  />
                  {remainingVolume > 0 && numVolume > remainingVolume && (
                    <p className="text-[10px] text-rose-400 mt-1 font-sans">
                      ⚠️ Exceeds remaining site balance ({remainingVolume} m³)
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-bold uppercase tracking-wider">Unit Rate (₹ / m³)</label>
                    <span className="text-[10px] text-amber-400">From Category</span>
                  </div>
                  <input
                    type="number"
                    value={unitRate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUnitRate(val === '' ? '' : Number(val));
                    }}
                    className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="gstCheck"
                  checked={applyGst}
                  onChange={(e) => setApplyGst(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#070d1a] border-[#1b273d] text-blue-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="gstCheck" className="text-slate-300 font-bold cursor-pointer">
                  Apply GST (18%) on Concrete Supply
                </label>
              </div>

              {/* Summary Calculation Box */}
              <div className="bg-[#070d1a] border border-[#1b273d] p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Concrete Subtotal ({numVolume} m³ × ₹{numRate}):</span>
                  <span>₹{Math.round(subtotal).toLocaleString('en-IN')}</span>
                </div>
                {applyGst && (
                  <div className="flex justify-between text-slate-400">
                    <span>GST (18% on Concrete):</span>
                    <span>₹{Math.round(gstAmount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-[#1b273d] text-sm font-black text-emerald-400">
                  <span>Grand Total:</span>
                  <span className="text-base">₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1b273d]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 bg-[#070d1a] hover:bg-[#121c2d] text-slate-300 font-bold rounded-xl cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer text-xs transition"
                >
                  {editingInvoiceId ? 'Update Tax Invoice' : 'Issue Tax Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingRMC;
