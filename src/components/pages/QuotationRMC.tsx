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

export interface MeasurementPrintLine {
  element: string;
  dimensionText: string;
  quantityM3: number;
}

export interface StudioWorkEntry {
  id: string;
  label?: string;
  workLabel?: string;
  reference?: string;
  mixGrade?: string;
  grade?: string;
  date?: string;
  unitSystem?: 'METRIC' | 'IMPERIAL' | string;
  unit?: string;
  selectedCategories?: string[];
  categories?: string[];
  slabRows?: any[];
  columnRows?: any[];
  beamRows?: any[];
  wallRows?: any[];
  stairsRows?: any[];
  footingRows?: any[];
  roadRows?: any[];
  categoryRows?: Record<string, any[]>;
  items?: any[];
  rows?: any[];
  elements?: any[];
  volumeM3: number;
  netVolumeM3?: number;
  wastagePercent?: number;
  wastage?: number;
  wastagePct?: number;
  wastageM3?: number;
  wastageVolume?: number;
  wastageVolumeM3?: number;
  grossVolumeM3?: number;
  totalVolumeM3?: number;
  finalVolumeM3?: number;
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
  wastageVolumeM3?: number;
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

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'BASVARAJ';
  let clean = String(name).trim();
  if (clean.includes('(')) clean = clean.split('(')[0].trim();
  return clean.toUpperCase();
};

const formatDateDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
};

// Rounds concrete quantity up to nearest 0.5 m³ (e.g., 8.38 -> 8.5, 9.02 -> 9.5)
const roundToHalfM3 = (val: number): number => {
  if (!val || val <= 0) return 0;
  return Math.ceil(val * 2 - 1e-9) / 2;
};

// Formats round m³ cleanly (e.g., 8.5 -> "8.5", 9 -> "9", 10 -> "10")
const formatRoundM3 = (val: number): string => {
  const num = Number(val) || 0;
  return Number.isInteger(num) ? String(num) : Number(num.toFixed(2)).toString();
};

// Extracts Net Volume, Wastage %, Wastage Volume, and Gross Volume directly from Site Measurement entry
const extractEntryWastage = (entry: StudioWorkEntry): {
  netVol: number;
  wastagePct: number;
  wastageVol: number;
  grossVol: number;
} => {
  const netVol = Number(entry.netVolumeM3 ?? entry.volumeM3) || 0;

  const rawPct = entry.wastagePercent ?? entry.wastagePct ?? entry.wastage;
  const rawWastageVol = entry.wastageVolumeM3 ?? entry.wastageVolume ?? entry.wastageM3;
  const rawGross = entry.grossVolumeM3 ?? entry.totalVolumeM3 ?? entry.finalVolumeM3;

  if (rawWastageVol !== undefined && Number(rawWastageVol) > 0) {
    const wVol = Number(rawWastageVol);
    const pct = rawPct !== undefined ? Number(rawPct) : (netVol > 0 ? Number(((wVol / netVol) * 100).toFixed(2)) : 0);
    return {
      netVol,
      wastagePct: pct,
      wastageVol: Number(wVol.toFixed(2)),
      grossVol: Number((netVol + wVol).toFixed(2))
    };
  }

  if (rawPct !== undefined && Number(rawPct) > 0) {
    const pct = Number(rawPct);
    const wVol = Number((netVol * (pct / 100)).toFixed(2));
    return {
      netVol,
      wastagePct: pct,
      wastageVol: wVol,
      grossVol: Number((netVol + wVol).toFixed(2))
    };
  }

  if (rawGross !== undefined && Number(rawGross) > netVol + 1e-4) {
    const gVol = Number(rawGross);
    const wVol = Number((gVol - netVol).toFixed(2));
    const pct = netVol > 0 ? Number(((wVol / netVol) * 100).toFixed(2)) : 0;
    return {
      netVol,
      wastagePct: pct,
      wastageVol: wVol,
      grossVol: gVol
    };
  }

  return {
    netVol,
    wastagePct: 0,
    wastageVol: 0,
    grossVol: netVol
  };
};

// Aggregates Net, Wastage %, Wastage Vol, and Gross Vol across multiple Site Measurement entries
const summarizeEntriesWastage = (entries: StudioWorkEntry[], siteKey?: string) => {
  let totalNet = 0;
  let totalWastage = 0;
  let totalGross = 0;

  entries.forEach(entry => {
    const stats = extractEntryWastage(entry);
    totalNet += stats.netVol;
    totalWastage += stats.wastageVol;
    totalGross += stats.grossVol;
  });

  if (totalWastage === 0 && totalNet > 0 && siteKey) {
    try {
      const siteWastageRaw =
        localStorage.getItem(`concrete360_site_wastage_${siteKey}`) ||
        localStorage.getItem(`concrete360_wastage_${siteKey}`);
      if (siteWastageRaw) {
        const parsedPct = Number(JSON.parse(siteWastageRaw));
        if (parsedPct > 0) {
          totalWastage = Number((totalNet * (parsedPct / 100)).toFixed(2));
          totalGross = Number((totalNet + totalWastage).toFixed(2));
        }
      }
    } catch {}
  }

  const effectivePct = totalNet > 0 ? Number(((totalWastage / totalNet) * 100).toFixed(2)) : 0;

  return {
    netVol: Number(totalNet.toFixed(2)),
    wastagePct: effectivePct,
    wastageVol: Number(totalWastage.toFixed(2)),
    grossVol: Number(totalGross.toFixed(2))
  };
};

const normalizeCategoryName = (raw: string): { key: string; shortName: string } => {
  const s = String(raw || '').toUpperCase();
  if (s.includes('SLAB') || s.includes('DECK')) return { key: 'SLAB', shortName: 'Slab' };
  if (s.includes('COL')) return { key: 'COLUMN', shortName: 'Column' };
  if (s.includes('BEAM')) return { key: 'BEAM', shortName: 'Beam' };
  if (s.includes('WALL')) return { key: 'WALL', shortName: 'RCC Wall' };
  if (s.includes('STAIR')) return { key: 'STAIRS', shortName: 'Stairs' };
  if (s.includes('FOOT')) return { key: 'FOOTING', shortName: 'Footing' };
  if (s.includes('ROAD')) return { key: 'ROAD', shortName: 'Road Work' };
  return { key: s || 'CUSTOM', shortName: raw || 'Concrete Work' };
};

// Converts SiteMeasurementStudio rows into clean compact lines
const extractCompactMeasurementLines = (entry: StudioWorkEntry, idx = 0): MeasurementPrintLine[] => {
  const unitRaw = String(entry.unitSystem || entry.unit || '').toUpperCase();
  const isImp = unitRaw.includes('IMPERIAL') || unitRaw.includes('FT');
  const lines: MeasurementPrintLine[] = [];

  const calcRowVolM3 = (catKey: string, r: any): number => {
    if (typeof r.volumeM3 === 'number' && r.volumeM3 > 0) return r.volumeM3;
    const count = Number(r.count ?? r.nos ?? r.qty ?? 1) || 1;
    const l = Number(r.length ?? r.l) || 0;
    const w = Number(r.width ?? r.breadth ?? r.w ?? r.b) || 0;
    const h = Number(r.height ?? r.h) || 0;
    const d1 = Number(r.dim1) || 0;
    const d2 = Number(r.dim2) || 0;
    const t = Number(r.thickness ?? r.depth ?? r.height ?? r.t ?? r.d ?? r.h) || 0;

    if (catKey === 'SLAB') {
      return isImp ? (count * l * w * (t / 12)) / 35.3146667 : count * l * w * (t / 1000);
    }
    if (catKey === 'COLUMN') {
      const colH = h || l;
      const colW = d1 || w;
      const colD = d2 || t;
      return isImp
        ? (count * (colW / 12) * (colD / 12) * colH) / 35.3146667
        : count * (colW / 1000) * (colD / 1000) * colH;
    }
    if (catKey === 'BEAM') {
      return isImp ? (count * l * (w / 12) * (t / 12)) / 35.3146667 : count * l * (w / 1000) * (t / 1000);
    }
    if (catKey === 'FOOTING') {
      return isImp ? (count * l * w * (t / 12)) / 35.3146667 : count * l * w * (t / 1000);
    }
    if (catKey === 'WALL') {
      const wallH = h || w;
      const wallT = Number(r.thickness ?? r.t) || t;
      return isImp ? (count * l * wallH * (wallT / 12)) / 35.3146667 : count * l * wallH * (wallT / 1000);
    }
    if (catKey === 'STAIRS') {
      const flights = Number(r.flights ?? count) || 1;
      const width = Number(r.width ?? l) || 0;
      const steps = Number(r.steps) || 1;
      const riser = Number(r.riser ?? t) || 0;
      const tread = Number(r.tread ?? w) || 0;
      const waist = Number(r.waist ?? r.thickness) || 0;
      if (isImp) {
        const stepVol = steps * 0.5 * (riser / 12) * (tread / 12) * width;
        const waistLen = steps * Math.sqrt(Math.pow(riser / 12, 2) + Math.pow(tread / 12, 2));
        return (flights * (stepVol + waistLen * width * (waist / 12))) / 35.3146667;
      }
      const stepVol = steps * 0.5 * (riser / 1000) * (tread / 1000) * width;
      const waistLen = steps * Math.sqrt(Math.pow(riser / 1000, 2) + Math.pow(tread / 1000, 2));
      return flights * (stepVol + waistLen * width * (waist / 1000));
    }
    if (catKey === 'ROAD') {
      const lenKm = Number(r.lengthKm ?? l) || 0;
      return isImp
        ? ((lenKm * 5280) * w * (t / 12)) / 35.3146667
        : (lenKm * 1000) * w * (t / 1000);
    }
    return 0;
  };

  const formatCompactDim = (catKey: string, r: any): string => {
    const count = Number(r.count ?? r.nos ?? r.qty ?? 1) || 1;
    const l = Number(r.length ?? r.l) || 0;
    const w = Number(r.width ?? r.breadth ?? r.w ?? r.b) || 0;
    const h = Number(r.height ?? r.h) || 0;
    const d1 = Number(r.dim1) || 0;
    const d2 = Number(r.dim2) || 0;
    const t = Number(r.thickness ?? r.depth ?? r.height ?? r.t ?? r.d ?? r.h) || 0;
    const countLabel = `${count} ${count === 1 ? 'No.' : 'Nos'} × `;

    if (catKey === 'SLAB') {
      return isImp ? `${countLabel}${l}' × ${w}' × ${t}"` : `${countLabel}${l}m × ${w}m × ${t}mm`;
    }
    if (catKey === 'COLUMN') {
      const colH = h || l;
      const colW = d1 || w;
      const colD = d2 || t;
      return isImp
        ? `${countLabel}${colW}" × ${colD}" × H ${colH}'`
        : `${countLabel}${colW}mm × ${colD}mm × H ${colH}m`;
    }
    if (catKey === 'BEAM') {
      return isImp ? `${countLabel}${l}' × ${w}" × ${t}"` : `${countLabel}${l}m × ${w}mm × ${t}mm`;
    }
    if (catKey === 'FOOTING') {
      return isImp ? `${countLabel}${l}' × ${w}' × ${t}"` : `${countLabel}${l}m × ${w}m × ${t}mm`;
    }
    if (catKey === 'WALL') {
      const wallH = h || w;
      const wallT = Number(r.thickness ?? r.t) || t;
      return isImp
        ? `${countLabel}${l}' × H ${wallH}' × ${wallT}"`
        : `${countLabel}${l}m × H ${wallH}m × ${wallT}mm`;
    }
    if (catKey === 'STAIRS') {
      const flights = Number(r.flights ?? count) || 1;
      const width = Number(r.width ?? l) || 0;
      const steps = Number(r.steps) || 1;
      const waist = Number(r.waist ?? r.thickness) || 0;
      return isImp
        ? `${flights} Flight(s), ${steps} Steps × W ${width}' × Waist ${waist}"`
        : `${flights} Flight(s), ${steps} Steps × W ${width}m × Waist ${waist}mm`;
    }
    if (catKey === 'ROAD') {
      const lenKm = Number(r.lengthKm ?? l) || 0;
      return isImp ? `${lenKm} mi × ${w}' × ${t}"` : `${lenKm} km × ${w}m × ${t}mm`;
    }
    return `${countLabel}${l} × ${w} × ${t}`;
  };

  const hasValidDimensions = (catKey: string, r: any): boolean => {
    if ((Number(r.volumeM3) || 0) > 0) return true;
    if (catKey === 'ROAD') return (Number(r.lengthKm ?? r.length) || 0) > 0 && (Number(r.width) || 0) > 0;
    if (catKey === 'COLUMN') return (Number(r.height ?? r.length) || 0) > 0 && (Number(r.dim1 ?? r.width) || 0) > 0;
    if (catKey === 'STAIRS') return (Number(r.steps) || 0) > 0 && (Number(r.width ?? r.length) || 0) > 0;
    return (Number(r.length ?? r.l) || 0) > 0 || (Number(r.width ?? r.w) || 0) > 0;
  };

  const explicitDefs: { key: string; shortName: string; rows?: any[] }[] = [
    { key: 'SLAB', shortName: 'Slab', rows: entry.slabRows },
    { key: 'COLUMN', shortName: 'Column', rows: entry.columnRows },
    { key: 'BEAM', shortName: 'Beam', rows: entry.beamRows },
    { key: 'WALL', shortName: 'RCC Wall', rows: entry.wallRows },
    { key: 'STAIRS', shortName: 'Stairs', rows: entry.stairsRows },
    { key: 'FOOTING', shortName: 'Footing', rows: entry.footingRows },
    { key: 'ROAD', shortName: 'Road Work', rows: entry.roadRows }
  ];

  explicitDefs.forEach(def => {
    if (Array.isArray(def.rows)) {
      def.rows.forEach((r, rIdx) => {
        if (hasValidDimensions(def.key, r)) {
          const itemTitle = def.rows!.length > 1 ? `${def.shortName} #${rIdx + 1}` : def.shortName;
          lines.push({
            element: itemTitle,
            dimensionText: formatCompactDim(def.key, r),
            quantityM3: Number(calcRowVolM3(def.key, r).toFixed(2))
          });
        }
      });
    }
  });

  if (lines.length === 0 && entry.categoryRows && typeof entry.categoryRows === 'object') {
    Object.entries(entry.categoryRows).forEach(([rawCat, rows]) => {
      if (Array.isArray(rows)) {
        const norm = normalizeCategoryName(rawCat);
        rows.forEach((r, rIdx) => {
          if (hasValidDimensions(norm.key, r)) {
            const itemTitle = rows.length > 1 ? `${norm.shortName} #${rIdx + 1}` : norm.shortName;
            lines.push({
              element: itemTitle,
              dimensionText: formatCompactDim(norm.key, r),
              quantityM3: Number(calcRowVolM3(norm.key, r).toFixed(2))
            });
          }
        });
      }
    });
  }

  const mixedRows = entry.rows || entry.items || entry.elements;
  if (lines.length === 0 && Array.isArray(mixedRows)) {
    mixedRows.forEach(r => {
      const norm = normalizeCategoryName(r.category || r.elementType || r.type || (entry.selectedCategories?.[0] ?? 'SLAB'));
      if (hasValidDimensions(norm.key, r)) {
        lines.push({
          element: norm.shortName,
          dimensionText: formatCompactDim(norm.key, r),
          quantityM3: Number(calcRowVolM3(norm.key, r).toFixed(2))
        });
      }
    });
  }

  if (lines.length === 0 && (Number(entry.volumeM3) || 0) > 0) {
    const catList = entry.selectedCategories || entry.categories || [];
    const norm = normalizeCategoryName(catList[0] || resolveWorkLabel(entry, idx));
    lines.push({
      element: norm.shortName,
      dimensionText: resolveWorkLabel(entry, idx),
      quantityM3: Number((Number(entry.volumeM3) || 0).toFixed(2))
    });
  }

  return lines;
};

const loadStudioWorksForSite = (siteKey: string): StudioWorkEntry[] => {
  const results: StudioWorkEntry[] = [];
  const seen = new Set<string>();

  let backupMap: Record<string, any> = {};
  try {
    const backupRaw = localStorage.getItem(`concrete360_dimensions_backup_${siteKey}`);
    if (backupRaw) backupMap = JSON.parse(backupRaw);
  } catch {}

  const candidateKeys = [
    `concrete360_advanced_measurements_${siteKey}`,
    `concrete360_site_inventory_${siteKey}`,
    `siteInventory_${siteKey}`,
    `concrete360_measurements_${siteKey}`
  ];

  for (const key of candidateKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : (parsed?.elements || parsed?.items || parsed?.works || []);
        if (Array.isArray(arr)) {
          arr.forEach((item: any, i: number) => {
            const id = String(item.id || `${key}-${i + 1}`);
            const backup = backupMap[id] || {};
            const merged = {
              ...backup,
              ...item,
              slabRows: Array.isArray(item.slabRows) && item.slabRows.length > 0 ? item.slabRows : backup.slabRows,
              columnRows: Array.isArray(item.columnRows) && item.columnRows.length > 0 ? item.columnRows : backup.columnRows,
              beamRows: Array.isArray(item.beamRows) && item.beamRows.length > 0 ? item.beamRows : backup.beamRows,
              wallRows: Array.isArray(item.wallRows) && item.wallRows.length > 0 ? item.wallRows : backup.wallRows,
              stairsRows: Array.isArray(item.stairsRows) && item.stairsRows.length > 0 ? item.stairsRows : backup.stairsRows,
              footingRows: Array.isArray(item.footingRows) && item.footingRows.length > 0 ? item.footingRows : backup.footingRows,
              roadRows: Array.isArray(item.roadRows) && item.roadRows.length > 0 ? item.roadRows : backup.roadRows,
              categories: Array.isArray(item.categories) && item.categories.length > 0 ? item.categories : backup.categories,
              unitSystem: item.unitSystem || backup.unitSystem,
              wastagePercent: item.wastagePercent ?? item.wastagePct ?? item.wastage ?? backup.wastagePercent ?? backup.wastagePct ?? backup.wastage,
              wastageM3: item.wastageM3 ?? item.wastageVolume ?? item.wastageVolumeM3 ?? backup.wastageM3 ?? backup.wastageVolume ?? backup.wastageVolumeM3,
              grossVolumeM3: item.grossVolumeM3 ?? item.totalVolumeM3 ?? backup.grossVolumeM3 ?? backup.totalVolumeM3
            };

            if (!seen.has(id)) {
              seen.add(id);
              results.push({ ...merged, id });
            } else {
              const idx = results.findIndex(r => r.id === id);
              if (idx >= 0) results[idx] = { ...merged, ...results[idx] };
            }
          });
        }
      }
    } catch {}
  }

  return results;
};

const resolveWorkLabel = (it: StudioWorkEntry, idx = 0): string => {
  const raw = it.label || it.workLabel || it.reference;
  if (raw && String(raw).trim() && String(raw).trim().toLowerCase() !== 'undefined') {
    return String(raw).trim();
  }
  const cats = it.selectedCategories || it.categories || [];
  return cats.length > 0 ? cats.join(' + ') : `Structural Work #${idx + 1}`;
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
    return 'BASVARAJ';
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(getActiveSiteKey());
  const [quotations, setQuotations] = useState<RMCQuotation[]>([]);
  const [measurementItems, setMeasurementItems] = useState<StudioWorkEntry[]>([]);
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
  const [wastagePercent, setWastagePercent] = useState<number | string>(0);
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
    items: StudioWorkEntry[],
    workId: string,
    siteKey: string,
    overrideWastagePct?: number
  ) => {
    if (!Array.isArray(items) || items.length === 0) return;

    if (workId === 'ALL') {
      const siteSummary = summarizeEntriesWastage(items, siteKey);
      const wPct = overrideWastagePct !== undefined ? overrideWastagePct : siteSummary.wastagePct;
      if (overrideWastagePct === undefined) {
        setWastagePercent(wPct);
      }

      const grossVol = overrideWastagePct !== undefined
        ? siteSummary.netVol * (1 + wPct / 100)
        : siteSummary.grossVol;
      const roundedVol = roundToHalfM3(grossVol);

      const explicitGrade =
        localStorage.getItem(`concrete360_active_mix_grade_${siteKey}`) ||
        items.find(it => it.mixGrade || it.grade)?.mixGrade ||
        items.find(it => it.grade)?.grade ||
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
        const entryStats = extractEntryWastage(found);
        const wPct = overrideWastagePct !== undefined ? overrideWastagePct : entryStats.wastagePct;
        if (overrideWastagePct === undefined) {
          setWastagePercent(wPct);
        }

        const grossVol = overrideWastagePct !== undefined
          ? entryStats.netVol * (1 + wPct / 100)
          : entryStats.grossVol;
        const roundedVol = roundToHalfM3(grossVol);

        const cleanG = (found.mixGrade || found.grade || 'M25').substring(0, 3).toUpperCase();
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

      const loadedMeasurements = loadStudioWorksForSite(siteKey);
      setMeasurementItems(loadedMeasurements);

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
    const parsedM = loadStudioWorksForSite(siteKey);

    if (parsedM.length > 0) {
      applyMeasurementToForm(parsedM, 'ALL', siteKey);
    } else {
      setWastagePercent(0);
      setMixGrade('M25');
      setUnitRate(resolveGradeCatalogRate('M25'));
      setEstimatedQtyM3(10);
      setRemarks('Rates valid for 15 days. Concrete supplied as per IS 456 / IS 4926 standards.');
    }
    setIsModalOpen(true);
  };

  const handleWorkSelectionChange = (wId: string) => {
    setSelectedWorkId(wId);
    applyMeasurementToForm(measurementItems, wId, currentSiteKey);
  };

  const handleWastageChange = (valStr: string) => {
    const parsed = valStr === '' ? '' : Number(valStr);
    setWastagePercent(parsed);
    const numVal = Number(parsed) || 0;
    if (measurementItems.length > 0) {
      applyMeasurementToForm(measurementItems, selectedWorkId, currentSiteKey, numVal);
    }
  };

  const handleGradeChange = (g: string) => {
    setMixGrade(g);
    setUnitRate(resolveGradeCatalogRate(g));
  };

  const qtyNum = Number(estimatedQtyM3) || 0;
  const rateNum = Number(unitRate) || 0;
  const wastagePctNum = Number(wastagePercent) || 0;
  const pumpTotal = includePump ? (Number(pumpRentPerShift) || 0) * (Number(pumpShifts) || 1) : 0;
  const subtotal = qtyNum * rateNum + pumpTotal;
  const gstAmount = applyGst ? subtotal * 0.18 : 0;
  const grandTotal = Math.round(subtotal + gstAmount);

  const activeSpecsForSelection: StudioWorkEntry[] =
    selectedWorkId === 'ALL'
      ? measurementItems
      : measurementItems.filter(it => it.id === selectedWorkId);

  const collectedMeasurementLines: MeasurementPrintLine[] = activeSpecsForSelection.flatMap(
    (entry, idx) => extractCompactMeasurementLines(entry, idx)
  );

  const selectedStats = summarizeEntriesWastage(activeSpecsForSelection, currentSiteKey);
  const selectedNetTotal = selectedStats.netVol;
  const selectedWastageVol = Number((selectedNetTotal * (wastagePctNum / 100)).toFixed(2));
  const selectedGrossTotal = Number((selectedNetTotal + selectedWastageVol).toFixed(2));

  const allSiteSummary = summarizeEntriesWastage(measurementItems, currentSiteKey);
  const allNetVolume = allSiteSummary.netVol;
  const allWastageVolume = allSiteSummary.wastageVol;
  const allRoundedVolume = roundToHalfM3(allSiteSummary.grossVol);

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
      netVolumeM3: selectedNetTotal,
      wastagePercent: wastagePctNum,
      wastageVolumeM3: selectedWastageVol,
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

    // Resolve live compact lines from SiteMeasurementStudio
    const liveWorks = loadStudioWorksForSite(currentSiteKey);
    const targetWorks = q.workElementId && q.workElementId !== 'ALL'
      ? liveWorks.filter(w => w.id === q.workElementId)
      : liveWorks;

    let lines: MeasurementPrintLine[] = targetWorks.flatMap((w, idx) => extractCompactMeasurementLines(w, idx));
    if (lines.length === 0 && q.measurementLines && q.measurementLines.length > 0) {
      lines = q.measurementLines;
    }

    const totalNetQty = lines.reduce((sum, l) => sum + l.quantityM3, 0);
    const liveWastageSummary = summarizeEntriesWastage(targetWorks, currentSiteKey);
    const hasWastage =
      (Number(q.wastagePercent) || 0) > 0 ||
      (Number(q.wastageVolumeM3) || 0) > 0 ||
      liveWastageSummary.wastagePct > 0 ||
      liveWastageSummary.wastageVol > 0;

    const netLabel = hasWastage
      ? 'Calculated Net Total (incl. Wastage):'
      : 'Calculated Net Total:';

    // Clean any accidental wastage % mention from remarks before printing
    const cleanPrintRemarks = (q.remarks || '').replace(/\s*incl\.\s*[\d.]+%\s*wastage/gi, '');

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
            <tr style="background:#f8fafc;">
              <td colspan="3" class="right" style="font-weight:bold;">${netLabel}</td>
              <td class="right" style="font-weight:bold;">${totalNetQty.toFixed(2)} m³</td>
            </tr>
            <tr style="background:#f1f5f9;">
              <td colspan="3" class="right" style="font-weight:bold; color:#0f172a;">
                Total Quoted Quantity (Round Figure):
              </td>
              <td class="right" style="font-weight:900; color:#0f172a;">${formatRoundM3(q.estimatedQtyM3)} m³</td>
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
                <td>
                  <strong>Ready-Mix Concrete (${q.mixGrade} Grade)</strong><br/>
                  <span style="color:#64748b;font-size:9px;">
                    Supply & Transit Mixer Delivery as per IS 456 / IS 4926
                  </span>
                </td>
                <td><strong>${formatRoundM3(q.estimatedQtyM3)} m³</strong></td>
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

          <p style="margin-top:14px;font-size:10px;"><strong>Terms & Remarks:</strong> ${cleanPrintRemarks}</p>
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
          {allWastageVolume > 0 && (
            <div className="border-l border-[#1b273d] pl-4">
              <span className="text-amber-400 uppercase text-[10px] font-bold block">
                Site Wastage ({allSiteSummary.wastagePct}%)
              </span>
              <strong className="text-amber-300 text-sm">
                +{allWastageVolume.toFixed(2)} m³
              </strong>
            </div>
          )}
          <div className="border-l border-[#1b273d] pl-4">
            <span className="text-emerald-400 uppercase text-[10px] font-bold block">
              Total Quotation Vol (Round)
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
                    <td className="py-4 px-5">
                      <div className="font-bold">{formatRoundM3(q.estimatedQtyM3)} m³</div>
                      {(q.wastagePercent ?? 0) > 0 && (
                        <div className="text-[10px] text-amber-400">+{q.wastagePercent}% wastage</div>
                      )}
                    </td>
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
                          title="Print Commercial Quotation"
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
              {/* Linked Site Measurement Selector + Compact Preview + Wastage */}
              <div className="bg-[#070d1a] border border-[#1b273d] p-3 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[10px]">
                    <Filter className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Import from Site Measurements:</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-bold">Round Fig. (0.5 m³)</span>
                </div>
                <select
                  value={selectedWorkId}
                  onChange={(e) => handleWorkSelectionChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0b1322] border border-[#1b273d] rounded-xl text-white font-bold outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">
                    All Site Elements ({collectedMeasurementLines.length} rows • {allNetVolume.toFixed(2)} m³ → {formatRoundM3(allRoundedVolume)} m³)
                  </option>
                  {measurementItems.map((it, idx) => {
                    const st = extractEntryWastage(it);
                    const rndV = roundToHalfM3(st.grossVol);
                    return (
                      <option key={it.id} value={it.id}>
                        {resolveWorkLabel(it, idx)} ({st.netVol.toFixed(2)} m³{st.wastagePct > 0 ? ` + ${st.wastagePct}%` : ''} → {formatRoundM3(rndV)} m³) {it.mixGrade ? `[${it.mixGrade}]` : ''}
                      </option>
                    );
                  })}
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

                {/* Wastage Imported from Site Measurement (Internal Calculation Only) */}
                <div className="pt-1.5 border-t border-[#142033] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-amber-400 font-bold uppercase text-[10px] whitespace-nowrap">
                      Site Wastage (%):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="25"
                      value={wastagePercent}
                      onChange={(e) => handleWastageChange(e.target.value)}
                      className="w-16 px-2 py-1 bg-[#0b1322] border border-amber-500/40 rounded-lg text-amber-300 font-bold text-center outline-none text-xs"
                    />
                  </div>
                  {selectedNetTotal > 0 && (
                    <div className="text-[10px] text-right text-slate-300">
                      <span>Net: <strong>{selectedNetTotal.toFixed(2)}</strong> + Wastage: <strong className="text-amber-400">{selectedWastageVol.toFixed(2)}</strong></span>
                      <span className="block text-emerald-400 font-bold">
                        Gross: {selectedGrossTotal.toFixed(2)} m³ → {formatRoundM3(roundToHalfM3(selectedGrossTotal))} m³
                      </span>
                    </div>
                  )}
                </div>
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
