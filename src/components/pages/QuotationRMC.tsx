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
  Layers,
  RotateCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cloudStorage } from '../../services/cloudStorage';

export interface MeasurementPrintLine {
  element: string;
  dimensionText: string;
  quantityM3: number;
}

export interface GradeLineItem {
  id: string;
  mixGrade: string;
  quantityM3: number | string;
  unitRate: number | string;
}

export interface TermConditionItem {
  id: string;
  title?: string;
  text: string;
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
  gradeItems?: { mixGrade: string; quantityM3: number; unitRate: number }[];
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
  termsList?: TermConditionItem[];
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

const getDefaultTerms = (isGstIncluded: boolean): TermConditionItem[] => [
  {
    id: 'term-measurement',
    title: 'Measurement',
    text: 'All billing is calculated strictly on cubic meter (m³) basis.'
  },
  {
    id: 'term-custom-mix',
    title: 'Custom Mix Design',
    text: 'If required, customers can provide their own mix design, and rates will change accordingly.'
  },
  {
    id: 'term-payment',
    title: 'Payment Terms',
    text: '100% advance payment required.'
  },
  {
    id: 'term-labor',
    title: 'Labor',
    text: 'We do not provide concrete leveling labour, it will be from the client side.'
  },
  {
    id: 'term-leveling',
    title: 'Leveling & Thickness',
    text: 'The client shall be responsible for ensuring that the concrete is laid, levelled, and maintained at the required levels and specified thickness as per the approved measurements and calculations. BILGI BUILDCON RMC shall not be held responsible for any variations in concrete levels or thickness resulting from improper levelling or execution at the site.'
  },
  {
    id: 'term-curing',
    title: 'Curing',
    text: 'Post concrete curing is mandatory.'
  },
  {
    id: 'term-taxes',
    title: 'Taxes',
    text: isGstIncluded
      ? 'The above rates are inclusive of GST 18%.'
      : 'The above rates are excluding GST 18% (GST extra as applicable @ 18%).'
  }
];

const extractCleanSiteName = (name: string): string => {
  if (!name) return '';
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
  if (!siteKey) return [];
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
  return cats.length > 0 ? cats.join(' + ') : `CONCRETE Work #${idx + 1}`;
};

export const QuotationRMC: React.FC = () => {
  const getActiveSiteKey = () => {
    try {
      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        try {
          const parsed = JSON.parse(activeRaw);
          const key = extractCleanSiteName(parsed.name || parsed.siteName || parsed.id);
          if (key) return key;
        } catch {
          const key = extractCleanSiteName(activeRaw);
          if (key) return key;
        }
      }

      const selected = sessionStorage.getItem('concrete360_selected_site') || localStorage.getItem('concrete360_selected_site');
      if (selected) return extractCleanSiteName(selected);
    } catch {}
    return '';
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(getActiveSiteKey());
  const [quotations, setQuotations] = useState<RMCQuotation[]>([]);
  const [measurementItems, setMeasurementItems] = useState<StudioWorkEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [siteDetails, setSiteDetails] = useState({
    clientName: '',
    clientAddress: 'Ainapur Site',
    clientGstin: '29UNREGISTERED',
    clientPhone: '',
    projectSite: ''
  });

  const [selectedWorkId, setSelectedWorkId] = useState<string>('ALL');
  const [quoteDate, setQuoteDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  // Multiple Concrete Grade Line Items
  const [gradeItems, setGradeItems] = useState<GradeLineItem[]>([
    { id: 'GRADE-1', mixGrade: 'M20', quantityM3: 0, unitRate: 4200 }
  ]);

  const [wastagePercent, setWastagePercent] = useState<number | string>(0);
  const [includePump, setIncludePump] = useState<boolean>(true);
  const [pumpRentPerShift, setPumpRentPerShift] = useState<number | string>(5000);
  const [pumpShifts, setPumpShifts] = useState<number | string>(1);
  const [applyGst, setApplyGst] = useState<boolean>(false);
  const [remarks, setRemarks] = useState<string>('Valid for 15 days.');

  // Editable, Deletable & Addable General Terms & Conditions
  const [termsList, setTermsList] = useState<TermConditionItem[]>(() => getDefaultTerms(false));
  const [newConditionTitle, setNewConditionTitle] = useState<string>('');
  const [newConditionText, setNewConditionText] = useState<string>('');

  const resolveGradeCatalogRate = (gradeCode: string): number => {
    const cleanGrade = (gradeCode || 'M20').substring(0, 3).toUpperCase();
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
    return STANDARD_RMC_RATES[cleanGrade] || 4200;
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
        'M20';
      const cleanG = explicitGrade.substring(0, 3).toUpperCase();

      setGradeItems([
        {
          id: `GRADE-${Date.now()}`,
          mixGrade: cleanG,
          quantityM3: roundedVol,
          unitRate: resolveGradeCatalogRate(cleanG),
        },
      ]);

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

        const cleanG = (found.mixGrade || found.grade || 'M20').substring(0, 3).toUpperCase();
        const label = resolveWorkLabel(found, idx);

        setGradeItems([
          {
            id: `GRADE-${Date.now()}`,
            mixGrade: cleanG,
            quantityM3: roundedVol,
            unitRate: resolveGradeCatalogRate(cleanG),
          },
        ]);
        setRemarks(`Work Scope: ${label} (${formatRoundM3(roundedVol)} m³ total). Valid for 15 days.`);
      }
    }
  };

  const loadSiteAndQuotes = (explicitSiteName?: string) => {
    const siteKey = explicitSiteName ? extractCleanSiteName(explicitSiteName) : getActiveSiteKey();
    setCurrentSiteKey(siteKey);

    if (!siteKey) {
      setQuotations([]);
      setMeasurementItems([]);
      return;
    }

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
        if (activeRaw) {
          try {
            const parsed = JSON.parse(activeRaw);
            if (extractCleanSiteName(parsed.name || parsed.siteName || parsed.id) === siteKey) {
              foundSite = parsed;
            }
          } catch {}
        }
      }

      if (foundSite) {
        setSiteDetails({
          clientName: foundSite.clientName || foundSite.client || siteKey,
          clientAddress: foundSite.location || foundSite.address || 'Ainapur Site',
          clientGstin: foundSite.gstin || '29UNREGISTERED',
          clientPhone: foundSite.phone || foundSite.phoneNumber || phoneMap[siteKey] || '',
          projectSite: foundSite.siteName || foundSite.name || siteKey
        });
      } else {
        setSiteDetails({
          clientName: siteKey,
          clientAddress: 'Ainapur Site',
          clientGstin: '29UNREGISTERED',
          clientPhone: phoneMap[siteKey] || '',
          projectSite: siteKey
        });
      }

      const loadedMeasurements = loadStudioWorksForSite(siteKey);
      setMeasurementItems(loadedMeasurements);

      const savedQuotes = localStorage.getItem(`concrete360_site_quotations_${siteKey}`);
      if (savedQuotes) {
        const parsed = JSON.parse(savedQuotes);
        if (Array.isArray(parsed)) {
          // Strict site filter: only show quotations belonging to the active site
          const siteSpecificQuotes = parsed.filter(
            (q: RMCQuotation) =>
              (!q.projectSite && !q.clientName) ||
              extractCleanSiteName(q.projectSite) === siteKey ||
              extractCleanSiteName(q.clientName) === siteKey
          );
          setQuotations(siteSpecificQuotes);
        } else {
          setQuotations([]);
        }
      } else {
        setQuotations([]);
      }
    } catch {
      setQuotations([]);
    }
  };

  useEffect(() => {
    loadSiteAndQuotes();

    const handleSiteSwitch = (e?: any) => {
      const nextSite = e?.detail !== undefined ? String(e.detail) : undefined;
      loadSiteAndQuotes(nextSite);
    };
    const handleSync = () => loadSiteAndQuotes();

    window.addEventListener('concrete360_site_switched', handleSiteSwitch);
    window.addEventListener('concrete360_measurement_updated', handleSync);
    window.addEventListener('concrete360_cloud_synced', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSiteSwitch);
      window.removeEventListener('concrete360_measurement_updated', handleSync);
      window.removeEventListener('concrete360_cloud_synced', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleOpenCreateModal = () => {
    const siteKey = getActiveSiteKey();
    loadSiteAndQuotes(siteKey);
    setSelectedWorkId('ALL');
    setApplyGst(false);
    setTermsList(getDefaultTerms(false));
    setNewConditionTitle('');
    setNewConditionText('');
    const parsedM = loadStudioWorksForSite(siteKey);

    if (parsedM.length > 0) {
      applyMeasurementToForm(parsedM, 'ALL', siteKey);
    } else {
      setWastagePercent(0);
      setGradeItems([
        { id: `GRADE-${Date.now()}`, mixGrade: 'M20', quantityM3: 0, unitRate: resolveGradeCatalogRate('M20') },
      ]);
      setRemarks(`Scope: ${siteKey}. Valid for 15 days.`);
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

  const handleGstToggle = (checked: boolean) => {
    setApplyGst(checked);
    setTermsList(prev =>
      prev.map(term =>
        term.id === 'term-taxes'
          ? {
              ...term,
              text: checked
                ? 'The above rates are inclusive of GST 18%.'
                : 'The above rates are excluding GST 18% (GST extra as applicable @ 18%).',
            }
          : term
      )
    );
  };

  // Handlers for multiple concrete grades
  const handleAddGradeRow = () => {
    const usedGrades = new Set(gradeItems.map(g => g.mixGrade));
    const nextGrade = Object.keys(STANDARD_RMC_RATES).find(g => !usedGrades.has(g)) || 'M25';
    setGradeItems(prev => [
      ...prev,
      {
        id: `GRADE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mixGrade: nextGrade,
        quantityM3: 5,
        unitRate: resolveGradeCatalogRate(nextGrade),
      },
    ]);
  };

  const handleRemoveGradeRow = (id: string) => {
    if (gradeItems.length <= 1) return;
    setGradeItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateGradeRow = (id: string, field: 'mixGrade' | 'quantityM3' | 'unitRate', rawVal: string) => {
    setGradeItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (field === 'mixGrade') {
          return {
            ...item,
            mixGrade: rawVal,
            unitRate: resolveGradeCatalogRate(rawVal),
          };
        }
        return {
          ...item,
          [field]: rawVal === '' ? '' : Number(rawVal),
        };
      })
    );
  };

  // Handlers for adding & deleting specific terms/conditions
  const handleAddCondition = () => {
    const cleanText = newConditionText.trim();
    if (!cleanText) return;

    const cleanTitle = newConditionTitle.trim();
    const newItem: TermConditionItem = {
      id: `term-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...(cleanTitle ? { title: cleanTitle } : {}),
      text: cleanText,
    };

    setTermsList(prev => [...prev, newItem]);
    setNewConditionTitle('');
    setNewConditionText('');
  };

  const handleDeleteCondition = (id: string) => {
    setTermsList(prev => prev.filter(t => t.id !== id));
  };

  const handleResetDefaultTerms = () => {
    setTermsList(getDefaultTerms(applyGst));
  };

  const totalQtyNum = gradeItems.reduce((sum, g) => sum + (Number(g.quantityM3) || 0), 0);
  const concreteSubtotalNum = gradeItems.reduce(
    (sum, g) => sum + (Number(g.quantityM3) || 0) * (Number(g.unitRate) || 0),
    0
  );
  const wastagePctNum = Number(wastagePercent) || 0;
  const pumpTotal = includePump ? (Number(pumpRentPerShift) || 0) * (Number(pumpShifts) || 1) : 0;
  const subtotal = concreteSubtotalNum + pumpTotal;
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

    const normalizedGrades = gradeItems.map(g => ({
      mixGrade: g.mixGrade,
      quantityM3: Number(g.quantityM3) || 0,
      unitRate: Number(g.unitRate) || 0,
    }));

    const combinedGradeLabel = Array.from(new Set(normalizedGrades.map(g => g.mixGrade))).join(' + ');
    const primaryGrade = normalizedGrades[0] || { mixGrade: 'M20', quantityM3: 0, unitRate: 4200 };

    // Include any pending condition typed in the input even if user didn't click "+ Add" first
    const finalTermsList = [...termsList];
    if (newConditionText.trim()) {
      finalTermsList.push({
        id: `term-custom-${Date.now()}`,
        ...(newConditionTitle.trim() ? { title: newConditionTitle.trim() } : {}),
        text: newConditionText.trim(),
      });
    }

    const newQuote: RMCQuotation = {
      id: `QT-${Date.now()}`,
      quoteNo: `QT-2026-${Math.floor(100 + Math.random() * 900)}`,
      date: quoteDate,
      validUntil,
      clientName: siteDetails.clientName || currentSiteKey,
      clientAddress: siteDetails.clientAddress || 'Ainapur Site',
      clientGstin: siteDetails.clientGstin || '29UNREGISTERED',
      clientPhone: siteDetails.clientPhone,
      projectSite: siteDetails.projectSite || currentSiteKey,
      workElementId: selectedWorkId,
      workElementLabel: selectedItemObj ? resolveWorkLabel(selectedItemObj, idx) : 'All Site Structural Works',
      mixGrade: combinedGradeLabel,
      gradeItems: normalizedGrades,
      netVolumeM3: selectedNetTotal,
      wastagePercent: wastagePctNum,
      wastageVolumeM3: selectedWastageVol,
      estimatedQtyM3: totalQtyNum,
      unitRate: primaryGrade.unitRate,
      includePump,
      pumpRentPerShift: Number(pumpRentPerShift) || 0,
      pumpShifts: Number(pumpShifts) || 1,
      applyGst,
      grandTotal,
      status: 'SENT',
      remarks,
      termsList: finalTermsList,
      measurementLines:
        collectedMeasurementLines.length > 0
          ? collectedMeasurementLines
          : [{ element: 'Structural Works', dimensionText: siteDetails.projectSite || currentSiteKey, quantityM3: totalQtyNum }],
    };

    const updated = [newQuote, ...quotations];
    setQuotations(updated);
    localStorage.setItem(`concrete360_site_quotations_${currentSiteKey}`, JSON.stringify(updated));
    setIsModalOpen(false);
    setToastMsg(`Quotation ${newQuote.quoteNo} created for ${currentSiteKey}!`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleConvertToInvoice = async (q: RMCQuotation) => {
    const invKey = `concrete360_site_invoices_${currentSiteKey}`;
    const existingRaw = localStorage.getItem(invKey);
    const existingInvoices = existingRaw ? JSON.parse(existingRaw) : [];

    const firstItem = q.gradeItems && q.gradeItems.length > 0
      ? q.gradeItems[0]
      : { mixGrade: q.mixGrade, quantityM3: q.estimatedQtyM3, unitRate: q.unitRate };

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
      mixGrade: firstItem.mixGrade,
      vehicleNo: 'KA28AC3087',
      volumeM3: q.estimatedQtyM3,
      unitRate: firstItem.unitRate,
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
          customer_gst: newInvoice.applyGst ? newInvoice.clientGstin : '',
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
    if (supabase) {
      void (supabase as any).from('quotations').delete().eq('id', id);
    }
  };

  const handlePrintQuotation = async (q: RMCQuotation) => {
    let compProfile: Record<string, any> = {
      name: 'BILGI BUILDCON RMC',
      unitSubtitle: 'Unit of M/S MOHAMMED JAFAR BASHEER AHMED BILGI',
      plantMake: 'CONMAT Batching Plant (0.75 m³)',
      gstin: '29ABWFM2721J1ZA',
      address: 'SY NO 118/13 AINAPUR GRAM BURNAPUR ROAD, VIJAYAPURA-586104',
      division: 'Commercial Ready-Mix Concrete Batching & Supply Division',
      phonePrimary: '+91 9931175133',
      phoneSecondary: '+91 9591055133',
      bankName: 'KOTAK MAHINDRA BANK',
      accountName: 'M/s MOHAMMED JAFAR BASHEER AHMED BILGI',
      accountNo: '9449817122',
      ifscSwift: 'KKBK0008234',
      branch: 'KOTAK MAHINDRA BANK LTD GROUND FLOOR, JALNAGAR, VIJAYAPURA-586101'
    };

    try {
      const savedProf = localStorage.getItem('concrete360_company_profile');
      const savedPhones = localStorage.getItem('concrete360_company_phones');
      const parsedP = savedProf ? JSON.parse(savedProf) : {};
      const parsedPhones = savedPhones ? JSON.parse(savedPhones) : {};

      compProfile = {
        ...compProfile,
        ...parsedP,
        unitSubtitle: parsedP.unitSubtitle || 'Unit of M/S MOHAMMED JAFAR BASHEER AHMED BILGI',
        phonePrimary:
          parsedP.phonePrimary ||
          parsedP.phone_primary ||
          parsedPhones.phonePrimary ||
          '+91 9931175133',
        phoneSecondary:
          parsedP.phoneSecondary ||
          parsedP.phone_secondary ||
          parsedPhones.phoneSecondary ||
          '+91 9591055133',
        bankName: parsedP.bankName || parsedP.bank_name || compProfile.bankName,
        accountName: parsedP.accountName || parsedP.account_name || compProfile.accountName,
        accountNo: parsedP.accountNo || parsedP.account_no || compProfile.accountNo,
        ifscSwift: parsedP.ifscSwift || parsedP.ifsc_swift || compProfile.ifscSwift,
        branch: parsedP.branch || compProfile.branch
      };

      if (!savedProf && supabase) {
        const { data } = await (supabase as any)
          .from('company_profile')
          .select('*')
          .eq('id', 'primary_company')
          .maybeSingle();

        if (data) {
          compProfile = {
            ...compProfile,
            name: data.name || compProfile.name,
            gstin: data.gstin || compProfile.gstin,
            address: data.address || compProfile.address,
            division: data.division || compProfile.division,
            phonePrimary: data.phone_primary || compProfile.phonePrimary,
            phoneSecondary: data.phone_secondary || compProfile.phoneSecondary,
            bankName: data.bank_name || compProfile.bankName,
            accountName: data.account_name || compProfile.accountName,
            accountNo: data.account_no || compProfile.accountNo,
            ifscSwift: data.ifsc_swift || compProfile.ifscSwift,
            branch: data.branch || compProfile.branch
          };
          localStorage.setItem('concrete360_company_profile', JSON.stringify(compProfile));
        }
      }
    } catch {}

    const win = window.open('', '_blank');
    if (!win) return;

    const companyContactNumbers = [compProfile.phonePrimary, compProfile.phoneSecondary]
      .map(n => String(n || '').trim())
      .filter(Boolean)
      .join(' / ');

    const printableGrades =
      q.gradeItems && q.gradeItems.length > 0
        ? q.gradeItems
        : [{ mixGrade: q.mixGrade, quantityM3: q.estimatedQtyM3, unitRate: q.unitRate }];

    const concreteSub = printableGrades.reduce(
      (sum, item) => sum + (Number(item.quantityM3) || 0) * (Number(item.unitRate) || 0),
      0
    );
    const pumpSub = q.includePump ? q.pumpRentPerShift * q.pumpShifts : 0;
    const sub = concreteSub + pumpSub;
    const isGstActive = Boolean(q.applyGst);
    const gst = isGstActive ? sub * 0.18 : 0;

    // Build header GSTIN & Contact line based on whether GST is applied
    const headerGstinAndContact = [
      isGstActive ? `Company GSTIN: <strong>${compProfile.gstin}</strong>` : '',
      companyContactNumbers ? `Contact: <strong>${companyContactNumbers}</strong>` : ''
    ].filter(Boolean).join('  |  ');

    const liveWorks = loadStudioWorksForSite(currentSiteKey);
    const targetWorks = q.workElementId && q.workElementId !== 'ALL'
      ? liveWorks.filter(w => w.id === q.workElementId)
      : liveWorks;

    let lines: MeasurementPrintLine[] = targetWorks.flatMap((w, idx) => extractCompactMeasurementLines(w, idx));
    if (lines.length === 0 && q.measurementLines && q.measurementLines.length > 0) {
      lines = q.measurementLines;
    }

    const totalNetQty = Number(lines.reduce((sum, l) => sum + l.quantityM3, 0).toFixed(2));
    const liveWastageSummary = summarizeEntriesWastage(targetWorks, currentSiteKey);

    const wastagePct =
      (Number(q.wastagePercent) || 0) > 0
        ? Number(q.wastagePercent)
        : liveWastageSummary.wastagePct;

    const wastageVol =
      (Number(q.wastageVolumeM3) || 0) > 0
        ? Number(q.wastageVolumeM3)
        : wastagePct > 0
          ? Number((totalNetQty * (wastagePct / 100)).toFixed(2))
          : liveWastageSummary.wastageVol;

    const totalWithWastage = Number((totalNetQty + wastageVol).toFixed(2));

    const cleanPrintRemarks = (q.remarks || '').replace(/\s*\(?(\+?[\d.]+\s*%?\s*)?wastage\)?/gi, '').trim();

    const gradeRowsHtml = printableGrades
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>Ready-Mix Concrete (${item.mixGrade} Grade)</strong><br/>
              <span style="color:#64748b;font-size:9px;">
                Supply & Transit Mixer Delivery as per IS 456 / IS 4926
              </span>
            </td>
            <td><strong>${formatRoundM3(item.quantityM3)} m³</strong></td>
            <td>₹${Number(item.unitRate).toLocaleString('en-IN')} / m³</td>
            <td class="right">₹${Math.round(Number(item.quantityM3) * Number(item.unitRate)).toLocaleString('en-IN')}</td>
          </tr>
        `
      )
      .join('');

    const pumpRowHtml = q.includePump
      ? `
          <tr>
            <td>${printableGrades.length + 1}</td>
            <td><strong>Static Concrete Pump Rental</strong><br/><span style="color:#64748b;font-size:9px;">Boom / Line Pump deployment at site</span></td>
            <td>${q.pumpShifts} Shift(s)</td>
            <td>₹${q.pumpRentPerShift.toLocaleString('en-IN')} / shift</td>
            <td class="right">₹${Math.round(pumpSub).toLocaleString('en-IN')}</td>
          </tr>
        `
      : '';

    const bottomMeasurementTableHtml = lines.length > 0 ? `
      <div style="margin-top:20px; page-break-inside:avoid;">
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
              <td colspan="3" class="right" style="font-weight:bold; color:#0f172a;">
                Calculated Total Quantity:
              </td>
              <td class="right" style="font-weight:bold; color:#0f172a;">${totalWithWastage > 0 ? totalWithWastage.toFixed(2) : q.estimatedQtyM3} m³</td>
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

    const activeTermsToPrint = q.termsList !== undefined ? q.termsList : getDefaultTerms(isGstActive);

    const generalTermsHtml =
      activeTermsToPrint.length > 0
        ? `
          <div class="terms-section">
            <div class="terms-title">3. GENERAL TERMS & CONDITIONS</div>
            <ul class="terms-list">
              ${activeTermsToPrint
                .map(t =>
                  t.title
                    ? `<li><strong>${t.title}:</strong> ${t.text}</li>`
                    : `<li>${t.text}</li>`
                )
                .join('')}
            </ul>
          </div>
        `
        : '';

    win.document.write(`
      <html>
        <head>
          <title>RMC Commercial Quotation - ${q.quoteNo}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; }
            .header .unit-subtitle { font-size: 10.5px; font-weight: 500; color: #1e293b; margin: 2px 0 3px 0; }
            .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; font-weight: bold; font-size: 10px; border-radius: 4px; }
            .grid { display: flex; justify-content: space-between; border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; margin-bottom: 14px; }
            table.commercial { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            table.commercial th { background: #0f172a; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
            table.commercial td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; vertical-align: top; }
            .right { text-align: right; }
            .summary-section { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
            .bank-box { width: 55%; border: 1px solid #cbd5e1; padding: 8px 10px; background: #f8fafc; font-size: 9.5px; line-height: 1.45; }
            .totals { width: 42%; border: 1px solid #cbd5e1; }
            .totals div { display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #cbd5e1; }
            .totals div:last-child { border-bottom: none; background: #f1f5f9; font-weight: bold; font-size: 12px; }
            .terms-section { margin-top: 18px; page-break-inside: avoid; }
            .terms-title { font-size: 12px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #94a3b8; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 0.3px; }
            .terms-list { margin: 0; padding-left: 16px; color: #1e293b; font-size: 10px; line-height: 1.5; }
            .terms-list li { margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${compProfile.name}</h1>
              <div class="unit-subtitle">${compProfile.unitSubtitle}</div>
              <p style="margin:2px 0 0 0;color:#475569;font-size:9px;">${compProfile.division} • ${compProfile.plantMake}<br/>
              Corporate Office: ${compProfile.address}${headerGstinAndContact ? `<br/>${headerGstinAndContact}` : ''}</p>
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
              ${isGstActive ? `GSTIN / Tax ID: ${q.clientGstin || '29UNREGISTERED'}<br/>` : ''}
              ${q.clientPhone ? `Phone: <strong>${q.clientPhone}</strong>` : ''}
            </div>
            <div>
              <strong>SITE / CONCRETE SCOPE:</strong><br/>
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
              ${gradeRowsHtml}
              ${pumpRowHtml}
            </tbody>
          </table>

          <div class="summary-section">
            <div class="bank-box">
              <strong>COMPANY REMITTANCE BANK ACCOUNT:</strong><br/>
              Bank Name: <strong>${compProfile.bankName}</strong><br/>
              Account Name: <strong>${compProfile.accountName}</strong><br/>
              Account Number: <strong>${compProfile.accountNo}</strong><br/>
              IFSC / Swift: <strong>${compProfile.ifscSwift}</strong> | Branch: ${compProfile.branch}
            </div>
            <div class="totals">
              <div><span>Estimated Subtotal:</span><span>₹${Math.round(sub).toLocaleString('en-IN')}</span></div>
              ${isGstActive ? `<div><span>GST (18%):</span><span>₹${Math.round(gst).toLocaleString('en-IN')}</span></div>` : ''}
              <div><span>ESTIMATED GRAND TOTAL:</span><span>₹${q.grandTotal.toLocaleString('en-IN')}</span></div>
            </div>
          </div>

          ${bottomMeasurementTableHtml}

          ${generalTermsHtml}

          <p style="margin-top:14px;font-size:10px;"><strong>Scope & Remarks:</strong> ${cleanPrintRemarks}</p>
          <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:10px;">
            <div style="border-top:1px dashed #64748b;width:180px;text-align:center;padding-top:4px;">Client Acceptance Sign & Stamp</div>
            <div style="border-top:1px dashed #64748b;width:180px;text-align:center;padding-top:4px;">For ${compProfile.name}</div>
          </div>

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
                    <td className="py-4 px-5">
                      {q.gradeItems && q.gradeItems.length > 1
                        ? `${q.gradeItems.length} Grades`
                        : `₹${q.unitRate.toLocaleString('en-IN')}`}
                    </td>
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
                          onClick={() => void handlePrintQuotation(q)}
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

                {collectedMeasurementLines.length > 0 ? (
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
                ) : (
                  <div className="bg-[#0b1322] border border-[#17253e] rounded-xl p-2.5 text-[10px] text-slate-400 flex justify-between items-center">
                    <span>No measurement entries recorded for {currentSiteKey} yet.</span>
                    <span className="text-cyan-300 font-bold">0.00 m³</span>
                  </div>
                )}

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
                  <div className="text-[10px] text-right text-slate-300">
                    <span>Net: <strong>{selectedNetTotal.toFixed(2)}</strong> + Wastage: <strong className="text-amber-400">{selectedWastageVol.toFixed(2)}</strong></span>
                    <span className="block text-emerald-400 font-bold">
                      Gross: {selectedGrossTotal.toFixed(2)} m³ → {formatRoundM3(roundToHalfM3(selectedGrossTotal))} m³
                    </span>
                  </div>
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

              {/* MULTIPLE CONCRETE GRADES SECTION */}
              <div className="bg-[#070d1a] border border-[#1b273d] p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold uppercase text-[10px]">
                    Concrete Grades & Rates ({gradeItems.length} Grade{gradeItems.length > 1 ? 's' : ''})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddGradeRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-[10px] cursor-pointer transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Grade</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {gradeItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-end bg-[#0b1322] border border-[#17253e] p-2.5 rounded-xl">
                      <div className="col-span-4">
                        <label className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Grade</label>
                        <select
                          value={item.mixGrade}
                          onChange={(e) => handleUpdateGradeRow(item.id, 'mixGrade', e.target.value)}
                          className="w-full px-2.5 py-2 bg-[#070d1a] border border-[#1b273d] rounded-lg text-cyan-400 font-bold outline-none cursor-pointer text-xs"
                        >
                          {Object.keys(STANDARD_RMC_RATES).map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Qty (m³)</label>
                        <input
                          type="number"
                          step="0.5"
                          required
                          value={item.quantityM3}
                          onChange={(e) => handleUpdateGradeRow(item.id, 'quantityM3', e.target.value)}
                          className="w-full px-2.5 py-2 bg-[#070d1a] border border-[#1b273d] rounded-lg text-cyan-300 font-bold outline-none text-xs"
                        />
                      </div>

                      <div className={gradeItems.length > 1 ? 'col-span-4' : 'col-span-5'}>
                        <label className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Rate (₹/m³)</label>
                        <input
                          type="number"
                          required
                          value={item.unitRate}
                          onChange={(e) => handleUpdateGradeRow(item.id, 'unitRate', e.target.value)}
                          className="w-full px-2.5 py-2 bg-[#070d1a] border border-[#1b273d] rounded-lg text-white font-bold outline-none text-xs"
                        />
                      </div>

                      {gradeItems.length > 1 && (
                        <div className="col-span-1 flex justify-end pb-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveGradeRow(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition"
                            title="Remove Grade"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {gradeItems.length > 1 && (
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-[#142033]">
                    <span>Total Concrete Volume: <strong className="text-cyan-300">{formatRoundM3(totalQtyNum)} m³</strong></span>
                    <span>Concrete Subtotal: <strong className="text-white">₹{Math.round(concreteSubtotalNum).toLocaleString('en-IN')}</strong></span>
                  </div>
                )}
              </div>

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
                  onChange={(e) => handleGstToggle(e.target.checked)}
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

              {/* GENERAL TERMS & CONDITIONS MANAGER (ADD / DELETE SPECIFIC CONDITIONS) */}
              <div className="bg-[#070d1a] border border-[#1b273d] p-3.5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold uppercase text-[10px]">
                    General Terms & Conditions ({termsList.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetDefaultTerms}
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-bold"
                    title="Restore all default terms"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                {/* Active Conditions List with Delete Button per Item */}
                {termsList.length > 0 ? (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 font-sans">
                    {termsList.map((term) => (
                      <div
                        key={term.id}
                        className="flex items-start justify-between gap-2 bg-[#0b1322] border border-[#17253e] p-2.5 rounded-xl text-[11px] text-slate-300"
                      >
                        <div className="leading-snug">
                          {term.title && <strong className="text-white">{term.title}: </strong>}
                          <span>{term.text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCondition(term.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 shrink-0 cursor-pointer transition"
                          title="Delete this condition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 font-sans">
                    No conditions selected. Add a new condition below or click Reset Defaults.
                  </p>
                )}

                {/* Add New Condition Form Row */}
                <div className="pt-2 border-t border-[#142033] space-y-2">
                  <span className="text-[9px] font-bold uppercase text-amber-400 block">
                    + Add New Condition
                  </span>
                  <div className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={newConditionTitle}
                      onChange={(e) => setNewConditionTitle(e.target.value)}
                      placeholder="Heading (e.g. Unloading)"
                      className="col-span-4 px-2.5 py-2 bg-[#0b1322] border border-[#1b273d] rounded-lg text-white outline-none font-sans text-[11px]"
                    />
                    <input
                      type="text"
                      value={newConditionText}
                      onChange={(e) => setNewConditionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCondition();
                        }
                      }}
                      placeholder="Write condition details..."
                      className="col-span-6 px-2.5 py-2 bg-[#0b1322] border border-[#1b273d] rounded-lg text-slate-200 outline-none font-sans text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="col-span-2 px-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] cursor-pointer transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
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
