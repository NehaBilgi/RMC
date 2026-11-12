import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  Printer, 
  Trash2, 
  X, 
  ArrowRightCircle, 
  CheckCircle2,
  Phone,
  Filter,
  Layers
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cloudStorage } from '../../services/cloudStorage';
import {
  ConcreteItem,
  StructuralType,
  readStoredMeasurements,
  extractCleanSiteName
} from '../measurement/SiteMeasurementStudio';

export interface MeasurementPrintLine {
  element: string;
  dimensionText: string;
  quantityM3: number;
}

interface RMCQuotation {
  id: string;
  quoteNo: string;
  date: string;
  validUntil: string;
  clientName: string;
  clientAddress: string;
  clientGstin: string;
  clientPhone: string;
  projectSite: string;
  workElementId?: string;
  workElementLabel?: string;
  mixGrade: string;
  netVolumeM3?: number;
  wastagePercent?: number;
  estimatedQtyM3: number;
  unitRate: number;
  includePump: boolean;
  pumpRentPerShift: number;
  pumpShifts: number;
  applyGst: boolean;
  grandTotal: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED';
  remarks: string;
  measurementLines?: MeasurementPrintLine[];
}

const STANDARD_RMC_RATES: Record<string, number> = {
  'M10': 3600,
  'M15': 3900,
  'M20': 4200,
  'M25': 4500,
  'M30': 4800,
  'M35': 5200,
  'M40': 5600,
  'M45': 6000,
  'M50': 6500
};

const formatDateDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
};

// Applies wastage % internally and rounds up to nearest 0.5 m³ (e.g., 8.38 + 5% = 8.799 -> 9, 8.1 + 5% = 8.505 -> 8.5)
const computeRoundedWithWastage = (netVol: number, wastagePct: number): number => {
  if (!netVol || netVol <= 0) return 0;
  const withWastage = netVol * (1 + (Number(wastagePct) || 0) / 100);
  return Math.ceil(withWastage * 2 - 1e-9) / 2;
};

// Formats round m³ cleanly (e.g., 8.5 -> "8.5", 9 -> "9", 10 -> "10")
const formatRoundM3 = (val: number): string => {
  const num = Number(val) || 0;
  return Number.isInteger(num) ? String(num) : Number(num.toFixed(2)).toString();
};

const resolveWorkLabel = (it: ConcreteItem, idx = 0): string => {
  const raw = it.label;
  if (raw && String(raw).trim() && String(raw).trim().toLowerCase() !== 'undefined') {
    return String(raw).trim();
  }
  const cats = it.categories || [];
  return cats.length > 0 ? cats.join(' + ') : `Structural Work #${idx + 1}`;
};

// Converts ConcreteItem rows from SiteMeasurementStudio into clean compact print lines
const extractCompactMeasurementLines = (entry: ConcreteItem, idx = 0): MeasurementPrintLine[] => {
  const isImp = entry.unitSystem === 'IMPERIAL';
  const lines: MeasurementPrintLine[] = [];
  const activeCats: StructuralType[] =
    Array.isArray(entry.categories) && entry.categories.length > 0
      ? entry.categories
      : ['SLAB', 'COLUMN', 'BEAM', 'RCC_WALL', 'STAIRS', 'FOOTING', 'ROAD_WORK'];

  // 1. SLAB
  if (activeCats.includes('SLAB') && Array.isArray(entry.slabRows)) {
    entry.slabRows.forEach((r, rIdx) => {
      const l = Number(r.length) || 0;
      const w = Number(r.width) || 0;
      const t = Number(r.thickness) || 0;
      if (l > 0 || w > 0) {
        const vol = isImp ? (l * w * (t / 12)) / 35.3146667 : l * w * (t / 1000);
        lines.push({
          element: entry.slabRows!.length > 1 ? `Slab #${rIdx + 1}` : 'Slab',
          dimensionText: isImp ? `1 No. × ${l}' × ${w}' × ${t}"` : `1 No. × ${l}m × ${w}m × ${t}mm`,
          quantityM3: Number(vol.toFixed(2))
        });
      }
    });
  }

  // 2. COLUMN
  if (activeCats.includes('COLUMN') && Array.isArray(entry.columnRows)) {
    entry.columnRows.forEach((r, rIdx) => {
      const cnt = Number(r.count) || 0;
      const h = Number(r.height) || 0;
      const d1 = Number(r.dim1) || 0;
      const d2 = Number(r.dim2) || 0;
      if (cnt > 0 || h > 0) {
        const vol = isImp ? (cnt * (d1 / 12) * (d2 / 12) * h) / 35.3146667 : cnt * (d1 / 1000) * (d2 / 1000) * h;
        const countLabel = `${cnt || 1} ${(cnt || 1) === 1 ? 'No.' : 'Nos'} × `;
        lines.push({
          element: entry.columnRows!.length > 1 ? `Column #${rIdx + 1}` : 'Column',
          dimensionText: isImp ? `${countLabel}${d1}" × ${d2}" × H ${h}'` : `${countLabel}${d1}mm × ${d2}mm × H ${h}m`,
          quantityM3: Number(vol.toFixed(2))
        });
      }
    });
  }

  // 3. BEAM
  if (activeCats.includes('BEAM') && Array.isArray(entry.beamRows)) {
    entry.beamRows.forEach((r, rIdx) => {
      const cnt = Number(r.count) || 0;
      const l = Number(r.length) || 0;
      const w = Number(r.width) || 0;
      const d = Number(r.depth) || 0;
      if (cnt > 0 || l > 0) {
        const vol = isImp ? (cnt * l * (w / 12) * (d / 12)) / 35.3146667 : cnt * l * (w / 1000) * (d / 1000);
        const countLabel = `${cnt || 1} ${(cnt || 1) === 1 ? 'No.' : 'Nos'} × `;
        lines.push({
          element: entry.beamRows!.length > 1 ? `Beam #${rIdx + 1}` : 'Beam',
          dimensionText: isImp ? `${countLabel}${l}' × ${w}" × ${d}"` : `${countLabel}${l}m × ${w}mm × ${d}mm`,
          quantityM3: Number(vol.toFixed(2))
        });
      }
    });
  }

  // 4. RCC WALL
  if (activeCats.includes('RCC_WALL') && Array.isArray(entry.wallRows)) {
    entry.wallRows.forEach((r, rIdx) => {
      const cnt = Number(r.count) || 0;
      const l = Number(r.length) || 0;
      const h = Number(r.height) || 0;
      const t = Number(r.thickness) || 0;
      if (cnt > 0 || l > 0) {
        const vol = isImp ? (cnt * l * h * (t / 12)) / 35.3146667 : cnt * l * h * (t / 1000);
        const countLabel = `${cnt || 1} ${(cnt || 1) === 1 ? 'No.' : 'Nos'} × `;
        lines.push({
          element: entry.wallRows!.length > 1 ? `RCC Wall #${rIdx + 1}` : 'RCC Wall',
          dimensionText: isImp ? `${countLabel}${l}' × H ${h}' × ${t}"` : `${countLabel}${l}m × H ${h}m × ${t}mm`,
          quantityM3: Number(vol.toFixed(2))
        });
      }
    });
  }

  // 5. STAIRS
  if (activeCats.includes('STAIRS') && Array.isArray(entry.stairsRows)) {
    entry.stairsRows.forEach((r, rIdx) => {
      const f = Number(r.flights) || 0;
      const w = Number(r.width) || 0;
      const steps = Number(r.steps) || 0;
      const tr = Number(r.tread) || 0;
      const rs = Number(r.riser) || 0;
      const wt = Number(r.waist) || 0;
      if (f > 0 || steps > 0) {
        const trConv = isImp ? tr / 12 : tr / 1000;
        const rConv = isImp ? rs / 12 : rs / 1000;
        const wtConv = isImp ? wt / 12 : wt / 1000;
        const rawVol = f * (0.5 * trConv * rConv * w * steps + Math.sqrt(trConv * trConv + rConv * rConv) * steps * w * wtConv);
        const vol = isImp ? rawVol / 35.3146667 : rawVol;
        lines.push({
          element: entry.stairsRows!.length > 1 ? `Stairs #${rIdx + 1}` : 'Stairs',
          dimensionText: isImp
            ? `${f || 1} Flight(s), ${steps} Steps × W ${w}' × Waist ${wt}"`
            : `${f || 1} Flight(s), ${steps} Steps × W ${w}m × Waist ${wt}mm`,
          quantityM3: Number(vol.toFixed(2))
        });
      }
    });
  }

  // 6. FOOTING
  if (activeCats.includes('FOOTING') && Array.isArray(entry.footingRows)) {
    entry.footingRows.forEach((r, rIdx) => {
      const cnt = Number(r.count) || 0;
      const l = Number(r.length) || 0;
      const w = Number(r.width) || 0;
      const d = Number(r.depth) || 0;
      if (cnt > 0 || l > 0) {
        const vol = isImp ? (cnt * l * w * (d / 12)) / 35.3146667 : cnt * l * w * (d / 1000);
        const countLabel = `${cnt || 1} ${(cnt || 1) === 1 ? 'No.' : 'Nos'} × `;
        lines.push({
          element: entry.footingRows!.length > 1 ? `Footing #${rIdx + 1}` : 'Footing',
          dimensionText: isImp ? `${countLabel}${l}' × ${w}' × ${d}"` : `${countLabel}${l}m × ${w}m × ${d}mm`,
          quantityM3: Number(vol.toFixed(2))
        });
      }
    });
  }

  // 7. ROAD WORK
  if (activeCats.includes('ROAD_WORK') && Array.isArray(entry.roadRows)) {
    entry.roadRows.forEach((r, rIdx) => {
      const lKm = Number(r.lengthKm) || 0;
      const w = Number(r.width) || 0;
      const t = Number(r.thickness) || 0;
      if (lKm > 0 || w > 0) {
        const vol = isImp ? ((lKm * 5280) * w * (t / 12)) / 35.3146667 : (lKm * 1000) * w * (t / 1000);
        lines.push({
          element: entry.roadRows!.length > 1 ? `Road Work #${rIdx + 1}` : 'Road Work',
          dimensionText: isImp ? `${lKm} mi × ${w}' × ${t}"` : `${lKm} km × ${w}m × ${t}mm`,
          quantityM3: Number(vol.toFixed(2))
        });
      }
    });
  }

  if (lines.length === 0 && (Number(entry.volumeM3) || 0) > 0) {
    lines.push({
      element: (entry.categories || []).join(' + ') || 'Structural Work',
      dimensionText: resolveWorkLabel(entry, idx),
      quantityM3: Number((Number(entry.volumeM3) || 0).toFixed(2))
    });
  }

  return lines;
};

export const QuotationRMC: React.FC = () => {
  const getActiveSiteKey = () => {
    try {
      const selected = sessionStorage.getItem('concrete360_selected_site') || localStorage.getItem('concrete360_selected_site');
      if (selected) return extractCleanSiteName(selected);

      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        return extractCleanSiteName(parsed.name || parsed.siteName || parsed.id);
      }
    } catch {}
    return 'MBBILGI';
  };

  const getPersistedWastage = (siteKey: string): number => {
    try {
      const saved = localStorage.getItem(`concrete360_wastage_percent_${siteKey}`);
      if (saved !== null && saved !== '') {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) return Math.max(0, parsed);
      }
      const measurementSession = localStorage.getItem('concrete360_measurement');
      if (measurementSession) {
        const parsedS = JSON.parse(measurementSession);
        if (parsedS.safetyWastagePercent !== undefined && parsedS.safetyWastagePercent !== null && parsedS.safetyWastagePercent !== '') {
          const parsed = parseFloat(parsedS.safetyWastagePercent);
          if (!isNaN(parsed)) return Math.max(0, parsed);
        }
      }
    } catch {}
    return 5;
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(() => getActiveSiteKey());
  const [quotations, setQuotations] = useState<RMCQuotation[]>([]);
  const [measurementItems, setMeasurementItems] = useState<ConcreteItem[]>(() =>
    readStoredMeasurements(getActiveSiteKey())
  );
  const [wastagePercent, setWastagePercent] = useState<number>(() => getPersistedWastage(getActiveSiteKey()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [siteDetails, setSiteDetails] = useState({
    clientName: '',
    clientAddress: '',
    clientGstin: '',
    clientPhone: '',
    projectSite: ''
  });

  // Form states
  const [selectedWorkId, setSelectedWorkId] = useState<string>('ALL');
  const [quoteDate, setQuoteDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [mixGrade, setMixGrade] = useState<string>('M25');
  const [estimatedQtyM3, setEstimatedQtyM3] = useState<number | string>(30);
  const [unitRate, setUnitRate] = useState<number | string>(4500);
  const [includePump, setIncludePump] = useState<boolean>(false);
  const [pumpRentPerShift, setPumpRentPerShift] = useState<number | string>(6500);
  const [pumpShifts, setPumpShifts] = useState<number | string>(1);
  const [applyGst, setApplyGst] = useState<boolean>(true);
  const [remarks, setRemarks] = useState<string>('Rates valid for 15 days. Concrete supplied as per IS 456 / IS 4926 standards.');

  const resolveGradeCatalogRate = (gradeCode: string): number => {
    const cleanGrade = (gradeCode || 'M25').substring(0, 3).toUpperCase();
    try {
      const catKeys = ['concrete360_material_categories', 'pave_material_categories', 'concrete360_mix_designs'];
      for (const k of catKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const match = arr.find((m: any) => String(m.grade || m.name || m.code || '').toUpperCase().includes(cleanGrade));
            if (match && (match.rate || match.unitRate || match.price)) {
              return Number(match.rate || match.unitRate || match.price);
            }
          }
        }
      }
    } catch {}
    return STANDARD_RMC_RATES[cleanGrade] || 4500;
  };

  const applyMeasurementToForm = (
    items: ConcreteItem[],
    workId: string,
    wastage: number,
    siteKey: string
  ) => {
    if (!Array.isArray(items) || items.length === 0) return;

    if (workId === 'ALL') {
      const netVol = items.reduce((sum, it) => sum + (Number(it.volumeM3) || 0), 0);
      const roundedVol = computeRoundedWithWastage(netVol, wastage);
      const explicitGrade =
        localStorage.getItem(`concrete360_active_mix_grade_${siteKey}`) ||
        items.find(it => it.mixGrade)?.mixGrade ||
        'M25';
      const cleanG = explicitGrade.substring(0, 3).toUpperCase();

      setMixGrade(cleanG);
      setUnitRate(resolveGradeCatalogRate(cleanG));
      if (roundedVol > 0) setEstimatedQtyM3(roundedVol);

      const elementNames = items.map((it, idx) => resolveWorkLabel(it, idx)).filter(Boolean).join(', ');
      if (elementNames) {
        setRemarks(`Scope: ${elementNames} (${formatRoundM3(roundedVol)} m³ total). Valid for 15 days.`);
      }
    } else {
      const idx = items.findIndex(it => it.id === workId);
      const found = idx >= 0 ? items[idx] : undefined;
      if (found) {
        const netVol = Number(found.volumeM3) || 0;
        const roundedVol = computeRoundedWithWastage(netVol, wastage);
        const cleanG = (found.mixGrade || 'M25').substring(0, 3).toUpperCase();
        const label = resolveWorkLabel(found, idx);

        setMixGrade(cleanG);
        setUnitRate(resolveGradeCatalogRate(cleanG));
        setEstimatedQtyM3(roundedVol);
        setRemarks(`Work Scope: ${label} (${formatRoundM3(roundedVol)} m³ total). Valid for 15 days.`);
      }
    }
  };

  const loadSiteAndQuotes = () => {
    const siteKey = getActiveSiteKey();
    setCurrentSiteKey(siteKey);

    try {
      const ongoingRaw = localStorage.getItem('concrete360_ongoing_sites') || localStorage.getItem('concrete360_sites');
      const phoneRegRaw = localStorage.getItem('concrete360_site_phone_registry');
      const phoneMap = phoneRegRaw ? JSON.parse(phoneRegRaw) : {};

      let foundSite: any = null;
      if (ongoingRaw) {
        const list = JSON.parse(ongoingRaw);
        if (Array.isArray(list)) {
          foundSite = list.find((s: any) => extractCleanSiteName(s.name || s.siteName || s.id) === siteKey);
        }
      }
      if (!foundSite) {
        const activeRaw = localStorage.getItem('concrete360_active_site');
        if (activeRaw) foundSite = JSON.parse(activeRaw);
      }

      if (foundSite) {
        setSiteDetails({
          clientName: foundSite.clientName || foundSite.client || siteKey,
          clientAddress: foundSite.location || foundSite.address || 'Ainapur Site',
          clientGstin: foundSite.gstin || '',
          clientPhone: foundSite.phone || foundSite.phoneNumber || phoneMap[siteKey] || '',
          projectSite: foundSite.siteName || foundSite.name || siteKey
        });
      }

      // Directly pull normalized ConcreteItem[] from SiteMeasurementStudio's reader
      const loadedMeasurements = readStoredMeasurements(siteKey);
      setMeasurementItems(loadedMeasurements);

      const currentWastage = getPersistedWastage(siteKey);
      setWastagePercent(currentWastage);

      const savedQuotes = localStorage.getItem(`concrete360_site_quotations_${siteKey}`);
      if (savedQuotes) {
        const parsed = JSON.parse(savedQuotes);
        if (Array.isArray(parsed)) setQuotations(parsed);
      } else {
        setQuotations([]);
      }
    } catch {}
  };

  useEffect(() => {
    loadSiteAndQuotes();
    window.addEventListener('concrete360_site_switched', loadSiteAndQuotes);
    window.addEventListener('concrete360_measurement_updated', loadSiteAndQuotes);
    window.addEventListener('storage', loadSiteAndQuotes);
    return () => {
      window.removeEventListener('concrete360_site_switched', loadSiteAndQuotes);
      window.removeEventListener('concrete360_measurement_updated', loadSiteAndQuotes);
      window.removeEventListener('storage', loadSiteAndQuotes);
    };
  }, []);

  const handleOpenCreateModal = () => {
    loadSiteAndQuotes();
    setSelectedWorkId('ALL');
    const siteKey = getActiveSiteKey();
    const parsedM = readStoredMeasurements(siteKey);
    const currentWastage = getPersistedWastage(siteKey);

    if (parsedM.length > 0) {
      applyMeasurementToForm(parsedM, 'ALL', currentWastage, siteKey);
    } else {
      setMixGrade('M25');
      setUnitRate(resolveGradeCatalogRate('M25'));
      setEstimatedQtyM3(10);
      setRemarks('Rates valid for 15 days. Concrete supplied as per IS 456 / IS 4926 standards.');
    }
    setIsModalOpen(true);
  };

  const handleWorkSelectionChange = (wId: string) => {
    setSelectedWorkId(wId);
    applyMeasurementToForm(measurementItems, wId, wastagePercent, currentSiteKey);
  };

  const handleGradeChange = (g: string) => {
    setMixGrade(g);
    setUnitRate(resolveGradeCatalogRate(g));
  };

  const qtyNum = Number(estimatedQtyM3) || 0;
  const rateNum = Number(unitRate) || 0;
  const pumpTotal = includePump ? (Number(pumpRentPerShift) || 0) * (Number(pumpShifts) || 1) : 0;
  const subtotal = qtyNum * rateNum + pumpTotal;
  const gstAmount = applyGst ? subtotal * 0.18 : 0;
  const grandTotal = Math.round(subtotal + gstAmount);

  const activeSpecsForSelection: ConcreteItem[] =
    selectedWorkId === 'ALL'
      ? measurementItems
      : measurementItems.filter(it => it.id === selectedWorkId);

  const collectedMeasurementLines: MeasurementPrintLine[] = activeSpecsForSelection.flatMap(
    (entry, idx) => extractCompactMeasurementLines(entry, idx)
  );

  const selectedNetTotal = activeSpecsForSelection.reduce((sum, it) => sum + (Number(it.volumeM3) || 0), 0);
  const allNetVolume = measurementItems.reduce((s, it) => s + (Number(it.volumeM3) || 0), 0);
  const allRoundedVolume = computeRoundedWithWastage(allNetVolume, wastagePercent);

  const handleCreateQuotation = (e: React.FormEvent) => {
    e.preventDefault();

    const idx = selectedWorkId !== 'ALL' ? measurementItems.findIndex(it => it.id === selectedWorkId) : -1;
    const selectedItemObj = idx >= 0 ? measurementItems[idx] : null;

    const newQuote: RMCQuotation = {
      id: `QT-${Date.now()}`,
      quoteNo: `QT-2026-${Math.floor(100 + Math.random() * 900)}`,
      date: quoteDate,
      validUntil,
      clientName: siteDetails.clientName || currentSiteKey,
      clientAddress: siteDetails.clientAddress || 'Ainapur Site',
      clientGstin: siteDetails.clientGstin,
      clientPhone: siteDetails.clientPhone,
      projectSite: siteDetails.projectSite || currentSiteKey,
      workElementId: selectedWorkId,
      workElementLabel: selectedItemObj ? resolveWorkLabel(selectedItemObj, idx) : 'All Site Structural Works',
      mixGrade,
      netVolumeM3: Number(selectedNetTotal.toFixed(2)),
      wastagePercent,
      estimatedQtyM3: qtyNum,
      unitRate: rateNum,
      includePump,
      pumpRentPerShift: Number(pumpRentPerShift) || 0,
      pumpShifts: Number(pumpShifts) || 1,
      applyGst,
      grandTotal,
      status: 'SENT',
      remarks,
      measurementLines: collectedMeasurementLines
    };

    const updated = [newQuote, ...quotations];
    setQuotations(updated);
    localStorage.setItem(`concrete360_site_quotations_${currentSiteKey}`, JSON.stringify(updated));
    setIsModalOpen(false);
    setToastMsg(`Quotation ${newQuote.quoteNo} created!`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleConvertToInvoice = async (q: RMCQuotation) => {
    const invKey = `concrete360_site_invoices_${currentSiteKey}`;
    const existingRaw = localStorage.getItem(invKey);
    const existingInvoices = existingRaw ? JSON.parse(existingRaw) : [];

    const newInvoice = {
      id: `INV-${Date.now()}`,
      invoiceNo: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
      clientName: q.clientName,
      clientAddress: q.clientAddress,
      clientGstin: q.clientGstin,
      clientPhone: q.clientPhone,
      paymentTerms: 'Advance',
      projectSite: q.projectSite,
      siteAddress: q.clientAddress,
      hsnCode: '38245010 (Ready-Mix Concrete)',
      mixGrade: q.mixGrade,
      vehicleNo: 'KA28AC3087',
      volumeM3: q.estimatedQtyM3,
      unitRate: q.unitRate,
      applyGst: q.applyGst,
      grandTotal: q.grandTotal,
      date: new Date().toISOString().split('T')[0],
      workElementId: q.workElementId || 'ALL'
    };

    const updatedInvoices = [newInvoice, ...existingInvoices];
    localStorage.setItem(invKey, JSON.stringify(updatedInvoices));
    window.dispatchEvent(new CustomEvent('concrete360_invoices_updated', { detail: { siteKey: currentSiteKey } }));

    const updatedQuotes = quotations.map(item =>
      item.id === q.id ? { ...item, status: 'CONVERTED' as const } : item
    );
    setQuotations(updatedQuotes);
    localStorage.setItem(`concrete360_site_quotations_${currentSiteKey}`, JSON.stringify(updatedQuotes));

    if (supabase) {
      try {
        await (supabase as any).from('invoices').upsert({
          id: newInvoice.id,
          site_name: currentSiteKey,
          invoice_no: newInvoice.invoiceNo,
          date: newInvoice.date,
          customer_name: newInvoice.clientName,
          mix_grade: newInvoice.mixGrade,
          volume_m3: newInvoice.volumeM3,
          rate_per_m3: newInvoice.unitRate,
          total_amount: newInvoice.grandTotal,
          raw_data: newInvoice
        });
        void cloudStorage.pullFromCloud();
      } catch {}
    }

    setToastMsg(`Converted ${q.quoteNo} into Tax Invoice ${newInvoice.invoiceNo}!`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleDeleteQuote = (id: string) => {
    const updated = quotations.filter(q => q.id !== id);
    setQuotations(updated);
    localStorage.setItem(`concrete360_site_quotations_${currentSiteKey}`, JSON.stringify(updated));
  };

  const handlePrintQuotation = (q: RMCQuotation) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const concreteSub = q.estimatedQtyM3 * q.unitRate;
    const pumpSub = q.includePump ? q.pumpRentPerShift * q.pumpShifts : 0;
    const sub = concreteSub + pumpSub;
    const gst = q.applyGst ? sub * 0.18 : 0;

    // Fetch live measurements directly via SiteMeasurementStudio's readStoredMeasurements
    const liveWorks = readStoredMeasurements(currentSiteKey);
    const targetWorks = q.workElementId && q.workElementId !== 'ALL'
      ? liveWorks.filter(w => w.id === q.workElementId)
      : liveWorks;

    let lines: MeasurementPrintLine[] = targetWorks.flatMap((w, idx) => extractCompactMeasurementLines(w, idx));
    if (lines.length === 0 && q.measurementLines && q.measurementLines.length > 0) {
      lines = q.measurementLines;
    }

    const cleanRemarks = String(q.remarks || '').replace(/\s*\([^)]*wastage[^)]*\)/gi, '').trim();
    const displayTotalM3 = formatRoundM3(q.estimatedQtyM3);

    const bottomMeasurementTableHtml = lines.length > 0 ? `
      <div style="margin-top:26px; page-break-inside:avoid;">
        <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#0f172a; margin-bottom:6px; letter-spacing:0.4px;">
          Measurement Details
        </div>
        <table class="commercial" style="margin-bottom:0;">
          <thead>
            <tr>
              <th style="width:6%;">#</th>
              <th style="width:24%;">Element</th>
              <th style="width:50%;">Dimensions</th>
              <th style="width:20%;" class="right">Quantity (m³)</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((line, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${line.element}</strong></td>
                <td>${line.dimensionText}</td>
                <td class="right"><strong>${line.quantityM3.toFixed(2)} m³</strong></td>
              </tr>
            `).join('')}
            <tr style="background:#f1f5f9;">
              <td colspan="3" class="right" style="font-weight:bold; color:#0f172a;">
                Total Quantity:
              </td>
              <td class="right" style="font-weight:900; color:#0f172a;">${displayTotalM3} m³</td>
            </tr>
          </tbody>
        </table>
      </div>
    ` : '';

    win.document.write(`
      <html>
        <head>
          <title>RMC Commercial Quotation - ${q.quoteNo}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 20px; font-weight: 900; }
            .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; font-weight: bold; font-size: 10px; border-radius: 4px; }
            .grid { display: flex; justify-content: space-between; border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; margin-bottom: 14px; }
            table.commercial { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            table.commercial th { background: #0f172a; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
            table.commercial td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; vertical-align: top; }
            .right { text-align: right; }
            .totals { width: 45%; margin-left: auto; border: 1px solid #cbd5e1; }
            .totals div { display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #cbd5e1; }
            .totals div:last-child { border-bottom: none; background: #f1f5f9; font-weight: bold; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>BILGI BUILDCON RMC</h1>
              <p style="margin:3px 0;color:#475569;">Commercial Ready-Mix Concrete Supply • CONMAT Batching Plant (0.75 m³)<br/>
              SY NO 118/13 AINAPUR GRAM BURNAPUR ROAD, VIJAYAPURA-586104 | GSTIN: <strong>29ABWFM2721J1ZA</strong></p>
            </div>
            <div style="text-align:right;">
              <span class="badge">ESTIMATE / QUOTATION</span><br/><br/>
              Quotation No: <strong>${q.quoteNo}</strong><br/>
              Date: <strong>${formatDateDDMMYYYY(q.date)}</strong><br/>
              Valid Until: <strong>${formatDateDDMMYYYY(q.validUntil)}</strong>
            </div>
          </div>

          <div class="grid">
            <div>
              <strong>TO (CLIENT / BUYER):</strong><br/>
              <strong>${q.clientName}</strong><br/>
              ${q.clientAddress}<br/>
              ${q.clientGstin ? `GSTIN: ${q.clientGstin}<br/>` : ''}
              ${q.clientPhone ? `Phone: <strong>${q.clientPhone}</strong>` : ''}
            </div>
            <div>
              <strong>SITE / STRUCTURAL SCOPE:</strong><br/>
              Project: <strong>${q.projectSite}</strong><br/>
              Scope: <strong>${q.workElementLabel || 'All Site Works'}</strong><br/>
              Delivery Location: ${q.clientAddress}<br/>
              HSN Code: 38245010
            </div>
          </div>

          <table class="commercial">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>Total Qty</th>
                <th>Unit Rate</th>
                <th class="right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td><strong>Ready-Mix Concrete (${q.mixGrade} Grade)</strong><br/><span style="color:#64748b;font-size:9px;">Supply & Transit Mixer Delivery as per IS 456 / IS 4926</span></td>
                <td>${displayTotalM3} m³</td>
                <td>₹${q.unitRate.toLocaleString('en-IN')} / m³</td>
                <td class="right">₹${Math.round(concreteSub).toLocaleString('en-IN')}</td>
              </tr>
              ${q.includePump ? `
              <tr>
                <td>2</td>
                <td><strong>Static Concrete Pump Rental</strong><br/><span style="color:#64748b;font-size:9px;">Boom / Line Pump deployment at site</span></td>
                <td>${q.pumpShifts} Shift(s)</td>
                <td>₹${q.pumpRentPerShift.toLocaleString('en-IN')} / shift</td>
                <td class="right">₹${Math.round(pumpSub).toLocaleString('en-IN')}</td>
              </tr>` : ''}
            </tbody>
          </table>

          <div class="totals">
            <div><span>Estimated Subtotal:</span><span>₹${Math.round(sub).toLocaleString('en-IN')}</span></div>
            ${q.applyGst ? `<div><span>GST (18%):</span><span>₹${Math.round(gst).toLocaleString('en-IN')}</span></div>` : ''}
            <div><span>ESTIMATED GRAND TOTAL:</span><span>₹${q.grandTotal.toLocaleString('en-IN')}</span></div>
          </div>

          <p style="margin-top:14px;font-size:10px;"><strong>Terms & Remarks:</strong> ${cleanRemarks}</p>
          <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:10px;">
            <div style="border-top:1px dashed #64748b;width:180px;text-align:center;padding-top:4px;">Client Acceptance Sign & Stamp</div>
            <div style="border-top:1px dashed #64748b;width:180px;text-align:center;padding-top:4px;">For BILGI BUILDCON RMC</div>
          </div>

          ${bottomMeasurementTableHtml}

          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
            ESTIMATE & QUOTATION ({currentSiteKey}) [Client: {siteDetails.clientName}]
          </span>
          <h2 className="text-xl font-black text-white mt-1">RMC Commercial Estimates & Quotations</h2>
          {siteDetails.clientPhone && (
            <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contact: <strong className="text-emerald-300">{siteDetails.clientPhone}</strong></span>
            </p>
          )}
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Create Estimate / Quotation</span>
        </button>
      </div>

      {/* Linked Site Inventory Measurement Summary Bar */}
      <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 font-mono text-xs shadow-xl">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-bold block">Linked Site Inventory Measurements</span>
            <strong className="text-white text-sm">
              {measurementItems.flatMap((w, i) => extractCompactMeasurementLines(w, i)).length} Measured Item(s)
            </strong>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-bold block">Net Measured Vol</span>
            <strong className="text-cyan-300 text-sm">
              {allNetVolume.toFixed(2)} m³
            </strong>
          </div>
          <div className="border-l border-[#1b273d] pl-4">
            <span className="text-emerald-400 uppercase text-[10px] font-bold block">
              Quotation Vol (+{wastagePercent}% Round)
            </span>
            <strong className="text-emerald-300 text-sm">
              {formatRoundM3(allRoundedVolume)} m³
            </strong>
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Quotations Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-5">Quote No / Date</th>
                <th className="py-4 px-5">Client & Scope</th>
                <th className="py-4 px-5">Mix Grade</th>
                <th className="py-4 px-5">Total Volume</th>
                <th className="py-4 px-5">Rate / m³</th>
                <th className="py-4 px-5">Est. Total</th>
                <th className="py-4 px-5">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 font-sans">
                    No estimates or quotations generated for {currentSiteKey} yet.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-[#0e1728] transition-colors">
                    <td className="py-4 px-5">
                      <div className="text-amber-400 font-bold">{q.quoteNo}</div>
                      <div className="text-[10px] text-slate-400">{formatDateDDMMYYYY(q.date)}</div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-sans font-bold text-cyan-300">{q.clientName}</div>
                      {q.workElementLabel && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{q.workElementLabel}</div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-cyan-400 font-bold">{q.mixGrade}</td>
                    <td className="py-4 px-5 font-bold">{formatRoundM3(q.estimatedQtyM3)} m³</td>
                    <td className="py-4 px-5">₹{q.unitRate.toLocaleString('en-IN')}</td>
                    <td className="py-4 px-5 text-emerald-400 font-extrabold">₹{q.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="py-4 px-5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        q.status === 'CONVERTED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      }`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {q.status !== 'CONVERTED' && (
                          <button
                            onClick={() => handleConvertToInvoice(q)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition font-bold text-[10px] cursor-pointer"
                            title="Convert Estimate directly into Tax Invoice"
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5" />
                            <span>To Invoice</span>
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintQuotation(q)}
                          className="text-slate-400 hover:text-cyan-400 p-1 transition cursor-pointer"
                          title="Print Commercial Quotation with Measurement Table at Bottom"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuote(q.id)}
                          className="text-slate-400 hover:text-rose-400 p-1 transition cursor-pointer"
                          title="Delete Quotation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Quotation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 font-mono max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1b273d] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">
                    NEW RMC ESTIMATE / QUOTATION
                  </h3>
                  <p className="text-[11px] text-cyan-400">
                    Client: <strong className="text-white">{siteDetails.clientName || currentSiteKey}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-[#121c2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="space-y-4 text-xs">
              {/* Linked Site Measurement Selector + Compact Preview */}
              <div className="bg-[#070d1a] border border-[#1b273d] p-3 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[10px]">
                    <Filter className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Import from Site Measurements:</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-bold">+{wastagePercent}% Wastage → Round Fig.</span>
                </div>
                <select
                  value={selectedWorkId}
                  onChange={(e) => handleWorkSelectionChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0b1322] border border-[#1b273d] rounded-xl text-white font-bold outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">
                    All Site Elements ({collectedMeasurementLines.length} rows • {allNetVolume.toFixed(2)} m³ net → {formatRoundM3(allRoundedVolume)} m³)
                  </option>
                  {measurementItems.map((it, idx) => (
                    <option key={it.id} value={it.id}>
                      {resolveWorkLabel(it, idx)} ({Number(it.volumeM3 || 0).toFixed(2)} m³ → {formatRoundM3(computeRoundedWithWastage(Number(it.volumeM3 || 0), wastagePercent))} m³) {it.mixGrade ? `[${it.mixGrade}]` : ''}
                    </option>
                  ))}
                </select>

                {/* Compact Element | Dimensions | Quantity Preview */}
                {collectedMeasurementLines.length > 0 && (
                  <div className="bg-[#0b1322] border border-[#17253e] rounded-xl p-2.5 space-y-1 max-h-32 overflow-y-auto text-[10px]">
                    {collectedMeasurementLines.map((line, idx) => (
                      <div key={idx} className="flex justify-between items-center text-slate-300 border-b border-[#142033] last:border-none pb-1 last:pb-0">
                        <span>
                          <strong className="text-cyan-300">{line.element}</strong>: {line.dimensionText}
                        </span>
                        <span className="text-emerald-400 font-bold shrink-0">{line.quantityM3.toFixed(2)} m³</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Estimate Date</label>
                  <input
                    type="date"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Concrete Grade</label>
                  <select
                    value={mixGrade}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none cursor-pointer"
                  >
                    {Object.keys(STANDARD_RMC_RATES).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Total Qty (m³)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={estimatedQtyM3}
                    onChange={(e) => setEstimatedQtyM3(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-300 font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Rate (₹ / m³)</label>
                  <input
                    type="number"
                    required
                    value={unitRate}
                    onChange={(e) => setUnitRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none"
                  />
                </div>
              </div>

              {/* Static Pump Rental Toggle */}
              <div className="bg-[#070d1a] border border-[#1b273d] p-3 rounded-2xl space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-bold">
                  <input
                    type="checkbox"
                    checked={includePump}
                    onChange={(e) => setIncludePump(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Include Static Concrete Pump Rental</span>
                </label>

                {includePump && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Pump Rent / Shift (₹)</label>
                      <input
                        type="number"
                        value={pumpRentPerShift}
                        onChange={(e) => setPumpRentPerShift(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#0b1322] border border-[#1b273d] rounded-xl text-white font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">No. of Shifts</label>
                      <input
                        type="number"
                        value={pumpShifts}
                        onChange={(e) => setPumpShifts(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#0b1322] border border-[#1b273d] rounded-xl text-white font-bold outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-bold">
                <input
                  type="checkbox"
                  checked={applyGst}
                  onChange={(e) => setApplyGst(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span>Include GST (18%) in Estimate</span>
              </label>

              <div>
                <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Commercial Terms / Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-slate-200 outline-none font-sans"
                />
              </div>

              <div className="bg-[#070d1a] border border-[#1b273d] p-4 rounded-2xl space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Estimated Subtotal:</span>
                  <span>₹{Math.round(subtotal).toLocaleString('en-IN')}</span>
                </div>
                {applyGst && (
                  <div className="flex justify-between text-slate-400">
                    <span>GST (18%):</span>
                    <span>₹{Math.round(gstAmount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-[#1b273d] text-sm font-black text-emerald-400">
                  <span>Estimated Grand Total:</span>
                  <span>₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#1b273d]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-[#070d1a] text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  Save & Issue Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationRMC;
