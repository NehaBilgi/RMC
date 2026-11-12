import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SiteMeasurementSession, StructuralMeasurementItem } from '../../types/rmc';
import { supabase } from '../../lib/supabase';
import { cloudStorage } from '../../services/cloudStorage';
import { 
  Plus, 
  Trash2, 
  Truck, 
  Box, 
  Building, 
  Footprints, 
  Check, 
  Edit2, 
  Search, 
  X, 
  Layers, 
  Building2, 
  SlidersHorizontal, 
  Calendar, 
  Lock 
} from 'lucide-react';

export type StructuralType = 'SLAB' | 'COLUMN' | 'BEAM' | 'RCC_WALL' | 'STAIRS' | 'FOOTING' | 'ROAD_WORK';
export type UnitSystem = 'METRIC' | 'IMPERIAL';

export interface StructuralDimensionsSnapshot {
  slab?: { length: number; width: number; thickness: number };
  column?: { count: number; height: number; dim1: number; dim2: number };
  beam?: { count: number; length: number; width: number; depth: number };
  wall?: { count: number; length: number; height: number; thickness: number };
  stairs?: { flights: number; width: number; steps: number; tread: number; riser: number; waist: number };
  footing?: { count: number; length: number; width: number; depth: number };
  road?: { lengthKm: number; lengthMeters: number; width: number; thickness: number };
}

export interface ConcreteItem {
  id: string;
  siteKey: string;
  mixGrade?: string;
  date?: string;
  categories: StructuralType[];
  label: string;
  breakdownText: string;
  volumeM3: number;
  volumeCft: number;
  unitSystem: UnitSystem;
  dimensionsSnapshot?: StructuralDimensionsSnapshot;
  slabRows?: { length: number | ''; width: number | ''; thickness: number | '' }[];
  columnRows?: { count: number | ''; height: number | ''; dim1: number | ''; dim2: number | '' }[];
  beamRows?: { count: number | ''; length: number | ''; width: number | ''; depth: number | '' }[];
  wallRows?: { count: number | ''; length: number | ''; height: number | ''; thickness: number | '' }[];
  stairsRows?: { flights: number | ''; width: number | ''; steps: number | ''; tread: number | ''; riser: number | ''; waist: number | '' }[];
  footingRows?: { count: number | ''; length: number | ''; width: number | ''; depth: number | '' }[];
  roadRows?: { lengthKm: number | ''; width: number | ''; thickness: number | '' }[];
}

const CATEGORY_DEFINITIONS: { id: StructuralType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'SLAB', label: 'Slab / Deck', icon: Layers },
  { id: 'COLUMN', label: 'Column', icon: Box },
  { id: 'BEAM', label: 'Beam', icon: Building },
  { id: 'RCC_WALL', label: 'RCC Wall', icon: Building },
  { id: 'STAIRS', label: 'Stairs', icon: Footprints },
  { id: 'FOOTING', label: 'Footing', icon: Box },
  { id: 'ROAD_WORK', label: 'Road Work (km)', icon: Truck }
];

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

const inferCategoriesFromItem = (it: any): StructuralType[] => {
  if (Array.isArray(it.categories) && it.categories.length > 0) {
    return it.categories;
  }

  const inferred: StructuralType[] = [];
  if (Array.isArray(it.slabRows) && it.slabRows.some((r: any) => Number(r.length) > 0 || Number(r.width) > 0)) inferred.push('SLAB');
  if (Array.isArray(it.columnRows) && it.columnRows.some((r: any) => Number(r.count) > 0 || Number(r.height) > 0)) inferred.push('COLUMN');
  if (Array.isArray(it.beamRows) && it.beamRows.some((r: any) => Number(r.count) > 0 || Number(r.length) > 0)) inferred.push('BEAM');
  if (Array.isArray(it.wallRows) && it.wallRows.some((r: any) => Number(r.count) > 0 || Number(r.length) > 0)) inferred.push('RCC_WALL');
  if (Array.isArray(it.stairsRows) && it.stairsRows.some((r: any) => Number(r.flights) > 0 || Number(r.steps) > 0)) inferred.push('STAIRS');
  if (Array.isArray(it.footingRows) && it.footingRows.some((r: any) => Number(r.count) > 0 || Number(r.length) > 0)) inferred.push('FOOTING');
  if (Array.isArray(it.roadRows) && it.roadRows.some((r: any) => Number(r.lengthKm) > 0 || Number(r.width) > 0)) inferred.push('ROAD_WORK');

  if (inferred.length > 0) return inferred;

  const bd = String(it.breakdownText || it.remarks || '').toUpperCase();
  if (bd.includes('SLAB')) inferred.push('SLAB');
  if (bd.includes('COLUMN')) inferred.push('COLUMN');
  if (bd.includes('BEAM')) inferred.push('BEAM');
  if (bd.includes('WALL')) inferred.push('RCC_WALL');
  if (bd.includes('STAIR')) inferred.push('STAIRS');
  if (bd.includes('FOOTING')) inferred.push('FOOTING');
  if (bd.includes('ROAD')) inferred.push('ROAD_WORK');

  return inferred.length > 0 ? inferred : ['SLAB'];
};

const readStoredMeasurements = (siteKey: string): ConcreteItem[] => {
  try {
    const cleanKey = extractCleanSiteName(siteKey);
    const saved = localStorage.getItem(`concrete360_advanced_measurements_${cleanKey}`);
    // Also read backup store so cloud syncs never erase dimensions or categories
    const backupRaw = localStorage.getItem(`concrete360_dimensions_backup_${cleanKey}`);
    const backupMap: Record<string, Partial<ConcreteItem>> = backupRaw ? JSON.parse(backupRaw) : {};

    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((rawIt: any) => {
          const id = String(rawIt.id || `RCC-${Math.floor(1000 + Math.random() * 9000)}`);
          const backup = backupMap[id] || {};
          const it = {
            ...backup,
            ...rawIt,
            categories:
              Array.isArray(rawIt.categories) && rawIt.categories.length > 0
                ? rawIt.categories
                : Array.isArray(backup.categories) && backup.categories.length > 0
                  ? backup.categories
                  : inferCategoriesFromItem(rawIt),
            slabRows: Array.isArray(rawIt.slabRows) && rawIt.slabRows.length > 0 ? rawIt.slabRows : backup.slabRows,
            columnRows: Array.isArray(rawIt.columnRows) && rawIt.columnRows.length > 0 ? rawIt.columnRows : backup.columnRows,
            beamRows: Array.isArray(rawIt.beamRows) && rawIt.beamRows.length > 0 ? rawIt.beamRows : backup.beamRows,
            wallRows: Array.isArray(rawIt.wallRows) && rawIt.wallRows.length > 0 ? rawIt.wallRows : backup.wallRows,
            stairsRows: Array.isArray(rawIt.stairsRows) && rawIt.stairsRows.length > 0 ? rawIt.stairsRows : backup.stairsRows,
            footingRows: Array.isArray(rawIt.footingRows) && rawIt.footingRows.length > 0 ? rawIt.footingRows : backup.footingRows,
            roadRows: Array.isArray(rawIt.roadRows) && rawIt.roadRows.length > 0 ? rawIt.roadRows : backup.roadRows,
            dimensionsSnapshot:
              rawIt.dimensionsSnapshot && Object.keys(rawIt.dimensionsSnapshot).length > 0
                ? rawIt.dimensionsSnapshot
                : backup.dimensionsSnapshot || {}
          };

          return {
            id,
            siteKey: cleanKey,
            mixGrade: String(it.mixGrade || 'M25'),
            date: String(it.date || new Date().toISOString().split('T')[0]),
            categories: inferCategoriesFromItem(it),
            label: String(it.label || it.name || 'Structural Work'),
            breakdownText: String(it.breakdownText || ''),
            volumeM3: Number(it.volumeM3) || 0,
            volumeCft: Number(it.volumeCft) || (Number(it.volumeM3) || 0) * 35.3146667,
            unitSystem: (it.unitSystem || backup.unitSystem) === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC',
            dimensionsSnapshot: it.dimensionsSnapshot || {},
            slabRows: it.slabRows,
            columnRows: it.columnRows,
            beamRows: it.beamRows,
            wallRows: it.wallRows,
            stairsRows: it.stairsRows,
            footingRows: it.footingRows,
            roadRows: it.roadRows
          };
        });
      }
    }
  } catch {}
  return [];
};

const saveDimensionsBackup = (siteKey: string, list: ConcreteItem[]) => {
  try {
    const cleanKey = extractCleanSiteName(siteKey);
    const existingRaw = localStorage.getItem(`concrete360_dimensions_backup_${cleanKey}`);
    const existingMap: Record<string, Partial<ConcreteItem>> = existingRaw ? JSON.parse(existingRaw) : {};
    list.forEach((item) => {
      existingMap[item.id] = {
        categories: item.categories,
        unitSystem: item.unitSystem,
        dimensionsSnapshot: item.dimensionsSnapshot,
        slabRows: item.slabRows,
        columnRows: item.columnRows,
        beamRows: item.beamRows,
        wallRows: item.wallRows,
        stairsRows: item.stairsRows,
        footingRows: item.footingRows,
        roadRows: item.roadRows
      };
    });
    localStorage.setItem(`concrete360_dimensions_backup_${cleanKey}`, JSON.stringify(existingMap));
  } catch {}
};

interface Props {
  session: SiteMeasurementSession;
  onUpdateSession: (session: SiteMeasurementSession) => void;
  onConvertToOrder?: (session: SiteMeasurementSession) => void;
}

export const SiteMeasurementStudio: React.FC<Props> = ({
  session,
  onUpdateSession
}) => {
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
  const canCreate = userRole === 'ADMIN' || userRole === 'EMPLOYEE';
  const canEditOrDelete = userRole === 'ADMIN' || userRole === 'EMPLOYEE';

  const getActiveSiteKey = () => {
    try {
      const selected = sessionStorage.getItem('concrete360_selected_site') || localStorage.getItem('concrete360_selected_site');
      if (selected) return extractCleanSiteName(selected);

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
    } catch {}
    return 'MBBILGI';
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(() => getActiveSiteKey());
  const [registeredSites, setRegisteredSites] = useState<any[]>([]);
  const [items, setItems] = useState<ConcreteItem[]>(() => readStoredMeasurements(getActiveSiteKey()));

  const loadRegisteredSites = () => {
    try {
      const saved = localStorage.getItem('concrete360_sites') || localStorage.getItem('concrete360_ongoing_sites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRegisteredSites(parsed);
      }
    } catch {}
  };

  const loadSiteMeasurements = (siteKey: string) => {
    const cleanKey = extractCleanSiteName(siteKey);
    const loaded = readStoredMeasurements(cleanKey);
    setItems(loaded);
  };

  const getSavedWastage = (siteKey: string): number => {
    try {
      const saved = localStorage.getItem(`concrete360_wastage_percent_${siteKey}`);
      if (saved !== null && saved !== '') {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) return Math.max(0, parsed);
      }
      const sessionRaw = localStorage.getItem('concrete360_measurement');
      if (sessionRaw) {
        const parsedS = JSON.parse(sessionRaw);
        if (parsedS.safetyWastagePercent !== undefined && parsedS.safetyWastagePercent !== null) {
          const parsed = parseFloat(parsedS.safetyWastagePercent);
          if (!isNaN(parsed)) return Math.max(0, parsed);
        }
      }
      if (session?.safetyWastagePercent !== undefined && session?.safetyWastagePercent !== null) {
        return session.safetyWastagePercent;
      }
    } catch {}
    return 5;
  };

  const [wastagePercent, setWastagePercent] = useState<number | ''>(() => getSavedWastage(getActiveSiteKey()));
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConcreteItem | null>(null);

  useEffect(() => {
    loadRegisteredSites();
    const siteKey = getActiveSiteKey();
    setCurrentSiteKey(siteKey);
    loadSiteMeasurements(siteKey);
    setWastagePercent(getSavedWastage(siteKey));

    const handleSiteSwitch = () => {
      if (isModalOpen) return;
      const newKey = getActiveSiteKey();
      setCurrentSiteKey(newKey);
      loadRegisteredSites();
      loadSiteMeasurements(newKey);
      setWastagePercent(getSavedWastage(newKey));
    };

    window.addEventListener('concrete360_site_switched', handleSiteSwitch);
    window.addEventListener('storage', handleSiteSwitch);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSiteSwitch);
      window.removeEventListener('storage', handleSiteSwitch);
    };
  }, [isModalOpen]);

  const [modalTargetSiteKey, setModalTargetSiteKey] = useState<string>(currentSiteKey);
  const [modalMixGrade, setModalMixGrade] = useState<string>('M25');
  const [modalWorkDate, setModalWorkDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [mixerCapacityM3, setMixerCapacityM3] = useState<number>(session?.transitTruckCapacityM3 || 7.0);
  const [unitMode, setUnitMode] = useState<UnitSystem>('METRIC');

  const [selectedCategories, setSelectedCategories] = useState<StructuralType[]>(['SLAB']);
  const [label, setLabel] = useState('');

  const [slabs, setSlabs] = useState<{ length: number | ''; width: number | ''; thickness: number | '' }[]>([{ length: '', width: '', thickness: '' }]);
  const [columns, setColumns] = useState<{ count: number | ''; height: number | ''; dim1: number | ''; dim2: number | '' }[]>([{ count: '', height: '', dim1: '', dim2: '' }]);
  const [beams, setBeams] = useState<{ count: number | ''; length: number | ''; width: number | ''; depth: number | '' }[]>([{ count: '', length: '', width: '', depth: '' }]);
  const [walls, setWalls] = useState<{ count: number | ''; length: number | ''; height: number | ''; thickness: number | '' }[]>([{ count: '', length: '', height: '', thickness: '' }]);
  const [stairsList, setStairsList] = useState<{ flights: number | ''; width: number | ''; steps: number | ''; tread: number | ''; riser: number | ''; waist: number | '' }[]>([{ flights: '', width: '', steps: '', tread: '', riser: '', waist: '' }]);
  const [footings, setFootings] = useState<{ count: number | ''; length: number | ''; width: number | ''; depth: number | '' }[]>([{ count: '', length: '', width: '', depth: '' }]);
  const [roads, setRoads] = useState<{ lengthKm: number | ''; width: number | ''; thickness: number | '' }[]>([{ lengthKm: '', width: '', thickness: '' }]);

  const isSlabEmpty = slabs.every((s) => s.length === '' && s.width === '' && s.thickness === '');

  const handleToggleCategory = (catId: StructuralType) => {
    if (selectedCategories.includes(catId)) {
      if (selectedCategories.length === 1) return;
      setSelectedCategories(selectedCategories.filter((id) => id !== catId));
    } else {
      // If adding a new entry and default SLAB has zero dimensions entered yet, replace SLAB cleanly
      if (!editingItem && selectedCategories.length === 1 && selectedCategories[0] === 'SLAB' && catId !== 'SLAB' && isSlabEmpty) {
        setSelectedCategories([catId]);
      } else {
        setSelectedCategories([...selectedCategories, catId]);
      }
    }
  };

  const subVolumesM3 = useMemo(() => {
    const isMetric = unitMode === 'METRIC';
    const vols: Record<StructuralType, number> = {
      SLAB: 0,
      COLUMN: 0,
      BEAM: 0,
      RCC_WALL: 0,
      STAIRS: 0,
      FOOTING: 0,
      ROAD_WORK: 0
    };

    if (isMetric) {
      slabs.forEach(s => {
        const l = Number(s.length) || 0;
        const w = Number(s.width) || 0;
        const t = Number(s.thickness) || 0;
        vols.SLAB += l * w * (t / 1000);
      });

      columns.forEach(c => {
        const cnt = Number(c.count) || 0;
        const h = Number(c.height) || 0;
        const d1 = Number(c.dim1) || 0;
        const d2 = Number(c.dim2) || 0;
        vols.COLUMN += cnt * (d1 / 1000) * (d2 / 1000) * h;
      });

      beams.forEach(b => {
        const cnt = Number(b.count) || 0;
        const l = Number(b.length) || 0;
        const w = Number(b.width) || 0;
        const d = Number(b.depth) || 0;
        vols.BEAM += cnt * l * (w / 1000) * (d / 1000);
      });

      walls.forEach(w => {
        const cnt = Number(w.count) || 0;
        const l = Number(w.length) || 0;
        const h = Number(w.height) || 0;
        const t = Number(w.thickness) || 0;
        vols.RCC_WALL += cnt * l * h * (t / 1000);
      });

      stairsList.forEach(st => {
        const f = Number(st.flights) || 0;
        const w = Number(st.width) || 0;
        const steps = Number(st.steps) || 0;
        const tr = Number(st.tread) / 1000 || 0;
        const r = Number(st.riser) / 1000 || 0;
        const wt = Number(st.waist) / 1000 || 0;
        const stepsVol = 0.5 * tr * r * w * steps;
        const waistVol = Math.sqrt(tr * tr + r * r) * steps * w * wt;
        vols.STAIRS += f * (stepsVol + waistVol);
      });

      footings.forEach(ft => {
        const cnt = Number(ft.count) || 0;
        const l = Number(ft.length) || 0;
        const w = Number(ft.width) || 0;
        const d = Number(ft.depth) || 0;
        vols.FOOTING += cnt * l * w * (d / 1000);
      });

      roads.forEach(r => {
        const lKm = Number(r.lengthKm) || 0;
        const w = Number(r.width) || 0;
        const t = Number(r.thickness) || 0;
        vols.ROAD_WORK += (lKm * 1000) * w * (t / 1000);
      });
    } else {
      slabs.forEach(s => {
        const l = Number(s.length) || 0;
        const w = Number(s.width) || 0;
        const t = Number(s.thickness) || 0;
        vols.SLAB += ((l * w * (t / 12)) / 35.3146667);
      });
      columns.forEach(c => {
        const cnt = Number(c.count) || 0;
        const h = Number(c.height) || 0;
        const d1 = Number(c.dim1) || 0;
        const d2 = Number(c.dim2) || 0;
        vols.COLUMN += ((cnt * (d1 / 12) * (d2 / 12) * h) / 35.3146667);
      });
      beams.forEach(b => {
        const cnt = Number(b.count) || 0;
        const l = Number(b.length) || 0;
        const w = Number(b.width) || 0;
        const d = Number(b.depth) || 0;
        vols.BEAM += ((cnt * l * (w / 12) * (d / 12)) / 35.3146667);
      });
      walls.forEach(w => {
        const cnt = Number(w.count) || 0;
        const l = Number(w.length) || 0;
        const h = Number(w.height) || 0;
        const t = Number(w.thickness) || 0;
        vols.RCC_WALL += ((cnt * l * h * (t / 12)) / 35.3146667);
      });
      stairsList.forEach(st => {
        const f = Number(st.flights) || 0;
        const w = Number(st.width) || 0;
        const steps = Number(st.steps) || 0;
        const tr = Number(st.tread) / 12 || 0;
        const r = Number(st.riser) / 12 || 0;
        const wt = Number(st.waist) / 12 || 0;
        const stepsVol = 0.5 * tr * r * w * steps;
        const waistVol = Math.sqrt(tr * tr + r * r) * steps * w * wt;
        vols.STAIRS += ((f * (stepsVol + waistVol)) / 35.3146667);
      });
      footings.forEach(ft => {
        const cnt = Number(ft.count) || 0;
        const l = Number(ft.length) || 0;
        const w = Number(ft.width) || 0;
        const d = Number(ft.depth) || 0;
        vols.FOOTING += ((cnt * l * w * (d / 12)) / 35.3146667);
      });
      roads.forEach(r => {
        const lKm = Number(r.lengthKm) || 0;
        const w = Number(r.width) || 0;
        const t = Number(r.thickness) || 0;
        vols.ROAD_WORK += (((lKm * 5280) * w * (t / 12)) / 35.3146667);
      });
    }

    return vols;
  }, [unitMode, slabs, columns, beams, walls, stairsList, footings, roads]);

  const grandTotalComputed = useMemo(() => {
    let totalM3 = 0;
    selectedCategories.forEach((cat) => {
      totalM3 += subVolumesM3[cat] || 0;
    });
    const totalCft = totalM3 * 35.3146667;
    return { totalM3, totalCft };
  }, [selectedCategories, subVolumesM3]);

  const resetAllFields = () => {
    setSlabs([{ length: '', width: '', thickness: '' }]);
    setColumns([{ count: '', height: '', dim1: '', dim2: '' }]);
    setBeams([{ count: '', length: '', width: '', depth: '' }]);
    setWalls([{ count: '', length: '', height: '', thickness: '' }]);
    setStairsList([{ flights: '', width: '', steps: '', tread: '', riser: '', waist: '' }]);
    setFootings([{ count: '', length: '', width: '', depth: '' }]);
    setRoads([{ lengthKm: '', width: '', thickness: '' }]);
    setLabel('');
    setModalWorkDate(new Date().toISOString().split('T')[0]);
  };

  const handleOpenAddModal = () => {
    if (!canCreate) {
      alert('Permission Denied: Read-Only accounts cannot add structural measurements.');
      return;
    }
    const activeKey = getActiveSiteKey();
    setCurrentSiteKey(activeKey);
    setEditingItem(null);
    setModalTargetSiteKey(activeKey);
    setModalMixGrade('M25');
    setSelectedCategories(['SLAB']);
    resetAllFields();
    setUnitMode('METRIC');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ConcreteItem) => {
    const activeKey = getActiveSiteKey();
    const freshList = readStoredMeasurements(activeKey);
    const freshItem = freshList.find(x => x.id === item.id) || item;

    const mode: UnitSystem = freshItem.unitSystem === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC';
    const resolvedCategories = inferCategoriesFromItem(freshItem);

    setEditingItem(freshItem);
    setModalTargetSiteKey(extractCleanSiteName(freshItem.siteKey || activeKey));
    setModalMixGrade(freshItem.mixGrade || 'M25');
    setModalWorkDate(freshItem.date || new Date().toISOString().split('T')[0]);
    setSelectedCategories([...resolvedCategories]);
    setLabel(freshItem.label || '');
    setUnitMode(mode);

    // 1. SLAB
    if (Array.isArray(freshItem.slabRows) && freshItem.slabRows.length > 0) {
      setSlabs(freshItem.slabRows.map(r => ({
        length: r.length ?? '',
        width: r.width ?? '',
        thickness: r.thickness ?? ''
      })));
    } else if (freshItem.dimensionsSnapshot?.slab) {
      const s = freshItem.dimensionsSnapshot.slab;
      setSlabs([{
        length: s.length || '',
        width: s.width || '',
        thickness: s.thickness || ''
      }]);
    } else {
      setSlabs([{ length: '', width: '', thickness: '' }]);
    }

    // 2. COLUMN
    if (Array.isArray(freshItem.columnRows) && freshItem.columnRows.length > 0) {
      setColumns(freshItem.columnRows.map(r => ({
        count: r.count ?? '',
        height: r.height ?? '',
        dim1: r.dim1 ?? '',
        dim2: r.dim2 ?? ''
      })));
    } else if (freshItem.dimensionsSnapshot?.column) {
      const c = freshItem.dimensionsSnapshot.column;
      setColumns([{
        count: c.count || '',
        height: c.height || '',
        dim1: c.dim1 || '',
        dim2: c.dim2 || ''
      }]);
    } else {
      setColumns([{ count: '', height: '', dim1: '', dim2: '' }]);
    }

    // 3. BEAM
    if (Array.isArray(freshItem.beamRows) && freshItem.beamRows.length > 0) {
      setBeams(freshItem.beamRows.map(r => ({
        count: r.count ?? '',
        length: r.length ?? '',
        width: r.width ?? '',
        depth: r.depth ?? ''
      })));
    } else if (freshItem.dimensionsSnapshot?.beam) {
      const b = freshItem.dimensionsSnapshot.beam;
      setBeams([{
        count: b.count || '',
        length: b.length || '',
        width: b.width || '',
        depth: b.depth || ''
      }]);
    } else {
      setBeams([{ count: '', length: '', width: '', depth: '' }]);
    }

    // 4. WALL
    if (Array.isArray(freshItem.wallRows) && freshItem.wallRows.length > 0) {
      setWalls(freshItem.wallRows.map(r => ({
        count: r.count ?? '',
        length: r.length ?? '',
        height: r.height ?? '',
        thickness: r.thickness ?? ''
      })));
    } else if (freshItem.dimensionsSnapshot?.wall) {
      const w = freshItem.dimensionsSnapshot.wall;
      setWalls([{
        count: w.count || '',
        length: w.length || '',
        height: w.height || '',
        thickness: w.thickness || ''
      }]);
    } else {
      setWalls([{ count: '', length: '', height: '', thickness: '' }]);
    }

    // 5. STAIRS
    if (Array.isArray(freshItem.stairsRows) && freshItem.stairsRows.length > 0) {
      setStairsList(freshItem.stairsRows.map(r => ({
        flights: r.flights ?? '',
        width: r.width ?? '',
        steps: r.steps ?? '',
        tread: r.tread ?? '',
        riser: r.riser ?? '',
        waist: r.waist ?? ''
      })));
    } else if (freshItem.dimensionsSnapshot?.stairs) {
      const st = freshItem.dimensionsSnapshot.stairs;
      setStairsList([{
        flights: st.flights || '',
        width: st.width || '',
        steps: st.steps || '',
        tread: st.tread || '',
        riser: st.riser || '',
        waist: st.waist || ''
      }]);
    } else {
      setStairsList([{ flights: '', width: '', steps: '', tread: '', riser: '', waist: '' }]);
    }

    // 6. FOOTING
    if (Array.isArray(freshItem.footingRows) && freshItem.footingRows.length > 0) {
      setFootings(freshItem.footingRows.map(r => ({
        count: r.count ?? '',
        length: r.length ?? '',
        width: r.width ?? '',
        depth: r.depth ?? ''
      })));
    } else if (freshItem.dimensionsSnapshot?.footing) {
      const ft = freshItem.dimensionsSnapshot.footing;
      setFootings([{
        count: ft.count || '',
        length: ft.length || '',
        width: ft.width || '',
        depth: ft.depth || ''
      }]);
    } else {
      setFootings([{ count: '', length: '', width: '', depth: '' }]);
    }

    // 7. ROAD
    if (Array.isArray(freshItem.roadRows) && freshItem.roadRows.length > 0) {
      setRoads(freshItem.roadRows.map(r => ({
        lengthKm: r.lengthKm ?? '',
        width: r.width ?? '',
        thickness: r.thickness ?? ''
      })));
    } else if (freshItem.dimensionsSnapshot?.road) {
      const rd = freshItem.dimensionsSnapshot.road;
      setRoads([{
        lengthKm: rd.lengthKm || '',
        width: rd.width || '',
        thickness: rd.thickness || ''
      }]);
    } else {
      setRoads([{ lengthKm: '', width: '', thickness: '' }]);
    }

    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;

    if (editingItem && !canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can modify records.');
      return;
    }

    const activeKey = getActiveSiteKey();
    const cleanTargetKey = extractCleanSiteName(modalTargetSiteKey || activeKey);

    const parts = selectedCategories.map((cat) => {
      const labelName = CATEGORY_DEFINITIONS.find((c) => c.id === cat)?.label.split('/')[0].trim();
      return `${labelName} (${subVolumesM3[cat].toFixed(2)}m³)`;
    });

    const breakdownText = parts.join(' + ');

    const snapshot: StructuralDimensionsSnapshot = {};
    if (selectedCategories.includes('SLAB') && slabs.length > 0) {
      snapshot.slab = {
        length: Number(slabs[0].length) || 0,
        width: Number(slabs[0].width) || 0,
        thickness: Number(slabs[0].thickness) || 0
      };
    }
    if (selectedCategories.includes('COLUMN') && columns.length > 0) {
      snapshot.column = {
        count: Number(columns[0].count) || 0,
        height: Number(columns[0].height) || 0,
        dim1: Number(columns[0].dim1) || 0,
        dim2: Number(columns[0].dim2) || 0
      };
    }
    if (selectedCategories.includes('BEAM') && beams.length > 0) {
      snapshot.beam = {
        count: Number(beams[0].count) || 0,
        length: Number(beams[0].length) || 0,
        width: Number(beams[0].width) || 0,
        depth: Number(beams[0].depth) || 0
      };
    }
    if (selectedCategories.includes('RCC_WALL') && walls.length > 0) {
      snapshot.wall = {
        count: Number(walls[0].count) || 0,
        length: Number(walls[0].length) || 0,
        height: Number(walls[0].height) || 0,
        thickness: Number(walls[0].thickness) || 0
      };
    }
    if (selectedCategories.includes('STAIRS') && stairsList.length > 0) {
      snapshot.stairs = {
        flights: Number(stairsList[0].flights) || 0,
        width: Number(stairsList[0].width) || 0,
        steps: Number(stairsList[0].steps) || 0,
        tread: Number(stairsList[0].tread) || 0,
        riser: Number(stairsList[0].riser) || 0,
        waist: Number(stairsList[0].waist) || 0
      };
    }
    if (selectedCategories.includes('FOOTING') && footings.length > 0) {
      snapshot.footing = {
        count: Number(footings[0].count) || 0,
        length: Number(footings[0].length) || 0,
        width: Number(footings[0].width) || 0,
        depth: Number(footings[0].depth) || 0
      };
    }
    if (selectedCategories.includes('ROAD_WORK') && roads.length > 0) {
      snapshot.road = {
        lengthKm: Number(roads[0].lengthKm) || 0,
        lengthMeters: (Number(roads[0].lengthKm) || 0) * 1000,
        width: Number(roads[0].width) || 0,
        thickness: Number(roads[0].thickness) || 0
      };
    }

    const savedRowsPayload = {
      slabRows: selectedCategories.includes('SLAB') ? slabs.map(r => ({ ...r })) : [],
      columnRows: selectedCategories.includes('COLUMN') ? columns.map(r => ({ ...r })) : [],
      beamRows: selectedCategories.includes('BEAM') ? beams.map(r => ({ ...r })) : [],
      wallRows: selectedCategories.includes('RCC_WALL') ? walls.map(r => ({ ...r })) : [],
      stairsRows: selectedCategories.includes('STAIRS') ? stairsList.map(r => ({ ...r })) : [],
      footingRows: selectedCategories.includes('FOOTING') ? footings.map(r => ({ ...r })) : [],
      roadRows: selectedCategories.includes('ROAD_WORK') ? roads.map(r => ({ ...r })) : []
    };

    const itemToSave: ConcreteItem = {
      id: editingItem ? editingItem.id : `RCC-${Math.floor(1000 + Math.random() * 9000)}`,
      siteKey: cleanTargetKey,
      mixGrade: modalMixGrade,
      date: modalWorkDate,
      categories: [...selectedCategories],
      label: label.trim() || 'Structural Work',
      breakdownText,
      volumeM3: Number(grandTotalComputed.totalM3.toFixed(3)),
      volumeCft: Number(grandTotalComputed.totalCft.toFixed(2)),
      unitSystem: unitMode,
      dimensionsSnapshot: snapshot,
      ...savedRowsPayload
    };

    const targetStorageKey = `concrete360_advanced_measurements_${cleanTargetKey}`;
    const existingTargetList = readStoredMeasurements(cleanTargetKey);

    let updatedTargetList: ConcreteItem[];
    if (editingItem && existingTargetList.some(it => it.id === editingItem.id)) {
      updatedTargetList = existingTargetList.map(it => (it.id === editingItem.id ? itemToSave : it));
    } else {
      updatedTargetList = [itemToSave, ...existingTargetList];
    }

    try {
      localStorage.setItem(targetStorageKey, JSON.stringify(updatedTargetList));
      saveDimensionsBackup(cleanTargetKey, updatedTargetList);
      if (updatedTargetList.length > 0 && updatedTargetList[0].mixGrade) {
        localStorage.setItem(`concrete360_active_mix_grade_${cleanTargetKey}`, updatedTargetList[0].mixGrade);
      }
    } catch {}

    if (cleanTargetKey !== activeKey) {
      if (editingItem) {
        const remainingCurrent = readStoredMeasurements(activeKey).filter(it => it.id !== editingItem.id);
        setItems(remainingCurrent);
        try {
          localStorage.setItem(`concrete360_advanced_measurements_${activeKey}`, JSON.stringify(remainingCurrent));
        } catch {}
      }
    } else {
      setCurrentSiteKey(cleanTargetKey);
      setItems(updatedTargetList);
    }

    window.dispatchEvent(new CustomEvent('concrete360_measurement_updated', { detail: updatedTargetList }));
    setIsModalOpen(false);
    setEditingItem(null);

    if (supabase) {
      try {
        await (supabase as any).from('site_measurements').upsert({
          id: itemToSave.id,
          site_name: cleanTargetKey,
          element_name: itemToSave.label,
          mix_grade: itemToSave.mixGrade,
          length_m: Number(slabs[0]?.length || beams[0]?.length || footings[0]?.length || 0),
          width_m: Number(slabs[0]?.width || beams[0]?.width || footings[0]?.width || 0),
          depth_m: Number(slabs[0]?.thickness || beams[0]?.depth || footings[0]?.depth || 0),
          quantity: Number(columns[0]?.count || beams[0]?.count || footings[0]?.count || 1),
          volume_m3: itemToSave.volumeM3,
          remarks: itemToSave.breakdownText,
          date: itemToSave.date,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        await cloudStorage.pushAllLocalToCloud();
        // Re-assert dimensions backup after cloud push so local dimensions stay intact
        saveDimensionsBackup(cleanTargetKey, updatedTargetList);
      } catch {}
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can delete structural works.');
      return;
    }
    if (window.confirm('Delete this structural work record?')) {
      const activeKey = getActiveSiteKey();
      const nextItems = readStoredMeasurements(activeKey).filter((it) => it.id !== id);
      setItems(nextItems);
      try {
        localStorage.setItem(`concrete360_advanced_measurements_${activeKey}`, JSON.stringify(nextItems));
        const backupRaw = localStorage.getItem(`concrete360_dimensions_backup_${activeKey}`);
        if (backupRaw) {
          const backupMap = JSON.parse(backupRaw);
          delete backupMap[id];
          localStorage.setItem(`concrete360_dimensions_backup_${activeKey}`, JSON.stringify(backupMap));
        }
        window.dispatchEvent(new CustomEvent('concrete360_measurement_updated', { detail: nextItems }));
      } catch {}
      if (supabase) {
        try {
          await (supabase as any).from('site_measurements').delete().eq('id', id);
        } catch {}
      }
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.id || '').toLowerCase().includes(q) ||
        (it.label || '').toLowerCase().includes(q) ||
        (it.breakdownText || '').toLowerCase().includes(q) ||
        (it.categories || []).some((c) => c.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const totalWetM3 = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.volumeM3) || 0), 0);
  }, [items]);

  const parsedWastage = useMemo(() => {
    return wastagePercent === '' ? 0 : Number(wastagePercent);
  }, [wastagePercent]);

  const totalWithWastage = useMemo(() => {
    return totalWetM3 * (1 + parsedWastage / 100);
  }, [totalWetM3, parsedWastage]);

  const totalRmcVehicles = useMemo(() => {
    if (mixerCapacityM3 <= 0 || totalWithWastage <= 0) return 0;
    return Math.ceil(totalWithWastage / mixerCapacityM3);
  }, [totalWithWastage, mixerCapacityM3]);

  const onUpdateSessionRef = useRef(onUpdateSession);
  useEffect(() => {
    onUpdateSessionRef.current = onUpdateSession;
  }, [onUpdateSession]);

  useEffect(() => {
    if (typeof onUpdateSessionRef.current !== 'function') return;
    const structures: StructuralMeasurementItem[] = items.map((it) => {
      const category = (it.categories && it.categories[0]) || 'SLAB';
      const type: StructuralMeasurementItem['type'] = category === 'COLUMN'
        ? 'rectangular_column'
        : category === 'FOOTING'
          ? 'footing'
          : category === 'BEAM'
            ? 'beam'
            : category === 'RCC_WALL'
              ? 'retaining_wall'
              : category === 'STAIRS'
                ? 'staircase'
                : 'slab';
      return {
        id: it.id,
        name: it.label || 'Structural Work',
        type,
        lengthM: 5,
        widthM: 5,
        depthM: 0.2,
        quantity: 1,
        rebarDeductionPercent: 0,
        calculatedNetVolumeM3: Number(it.volumeM3) || 0
      };
    });

    const netM3 = Number(totalWetM3.toFixed(1));
    const grossM3 = Number(totalWithWastage.toFixed(1));

    if (
      session?.totalNetM3 === netM3 &&
      session?.totalGrossM3 === grossM3 &&
      session?.requiredTruckLoads === totalRmcVehicles &&
      session?.transitTruckCapacityM3 === mixerCapacityM3 &&
      session?.safetyWastagePercent === parsedWastage
    ) {
      return;
    }

    onUpdateSessionRef.current({
      ...session,
      structures,
      totalNetM3: netM3,
      totalGrossM3: grossM3,
      requiredTruckLoads: totalRmcVehicles,
      transitTruckCapacityM3: mixerCapacityM3,
      safetyWastagePercent: parsedWastage
    });
  }, [items, totalWetM3, totalWithWastage, totalRmcVehicles, mixerCapacityM3, parsedWastage, session]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Top Banner & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight uppercase">
            Concrete Master & Structural Calculator ({currentSiteKey})
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Calculate concrete for slabs, columns, beams, walls, footings, stairs, and road works. Data is strictly isolated per site.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {canCreate && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Add Structural Work</span>
            </button>
          )}
        </div>
      </div>

      {/* RMC Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="bg-[#0B1120] border border-[#17233D] p-4 rounded-2xl shadow-xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Concrete Work
          </span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {totalWetM3.toFixed(2)} <span className="text-xs text-slate-400 font-sans">m³</span>
          </div>
          <span className="text-[11px] text-cyan-400 mt-0.5 block">
            ≈ {(totalWetM3 * 35.3146667).toFixed(1)} CFT (cu.ft)
          </span>
        </div>

        <div className="bg-[#0B1120] border border-[#17233D] p-4 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Order (+{wastagePercent === '' ? 0 : wastagePercent}% Wastage)
            </span>
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={wastagePercent}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setWastagePercent('');
                  try {
                    localStorage.setItem(`concrete360_wastage_percent_${currentSiteKey}`, '');
                  } catch {}
                } else {
                  const num = parseFloat(val);
                  const cleanVal = isNaN(num) ? 0 : Math.max(0, num);
                  setWastagePercent(cleanVal);
                  try {
                    localStorage.setItem(`concrete360_wastage_percent_${currentSiteKey}`, String(cleanVal));

                    const measurementRaw = localStorage.getItem('concrete360_measurement');
                    const parsed = measurementRaw ? JSON.parse(measurementRaw) : {};
                    localStorage.setItem(
                      'concrete360_measurement',
                      JSON.stringify({ ...parsed, safetyWastagePercent: cleanVal })
                    );
                  } catch {}
                }
              }}
              className="w-14 text-right bg-[#10192E] border border-[#1E2E4E] rounded px-1.5 py-0.5 text-xs text-cyan-300 font-bold outline-none focus:border-cyan-500"
              title="Pumping & Line Wastage %"
            />
          </div>
          <div className="text-2xl font-extrabold text-cyan-300 mt-1">
            {totalWithWastage.toFixed(2)} <span className="text-xs text-cyan-500 font-sans">m³</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            ≈ {(totalWithWastage * 35.3146667).toFixed(1)} CFT
          </span>
        </div>

        <div className="bg-[#0B1120] border border-emerald-500/30 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              RMC Vehicles Required
            </span>
            <select
              value={mixerCapacityM3}
              onChange={(e) => setMixerCapacityM3(Number(e.target.value))}
              className="px-1.5 py-0.5 bg-[#10192E] border border-[#1E2E4E] rounded text-[10px] text-emerald-400 outline-none cursor-pointer"
            >
              <option value={6}>6 m³</option>
              <option value={7}>7 m³</option>
              <option value={8}>8 m³</option>
              <option value={9}>9 m³</option>
            </select>
          </div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1 flex items-center gap-2">
            <Truck className="w-5 h-5 shrink-0" />
            <span>{totalRmcVehicles} Trucks</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            @ {mixerCapacityM3} m³ per transit mixer
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by structural work name, breakdown or ID..."
          className="w-full bg-[#0B1322] border border-[#162238] rounded-full pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors font-mono"
        />
      </div>

      {/* Table Container */}
      <div className="bg-[#0B1322] border border-[#162238] rounded-3xl overflow-hidden shadow-2xl w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#162238] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#080D1A] font-mono">
                <th className="py-4 px-6 w-[12%]">ID & MIX</th>
                <th className="py-4 px-6 w-[15%]">DATE</th>
                <th className="py-4 px-6 w-[20%]">CATEGORIES INCLUDED</th>
                <th className="py-4 px-6 w-[25%]">DESCRIPTION & BREAKDOWN</th>
                <th className="py-4 px-6 text-center w-[14%]">TOTAL VOLUME (M³ / CFT)</th>
                <th className="py-4 px-6 text-right w-[14%]">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121B2D] text-slate-200 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No structural concrete works logged for site <strong>{currentSiteKey}</strong>. Click "+ Add Structural Work" to add.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const displayCategories = inferCategoriesFromItem(item);
                  return (
                    <tr key={item.id} className="hover:bg-[#0E1626] transition-colors">
                      <td className="py-4 px-6 truncate">
                        <span className="font-bold text-slate-300 block">{item.id}</span>
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold border border-cyan-500/20 mt-1 inline-block">
                          {item.mixGrade || 'M25'}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-300">
                        {formatDateDDMMYYYY(item.date || '') || '-'}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {displayCategories.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#111C33] border border-[#1C2C4E] text-blue-300 font-sans truncate max-w-full"
                            >
                              {String(c).replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-4 px-6 font-sans">
                        <div className="font-bold text-white text-sm truncate" title={item.label}>{item.label || 'Structural Work'}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate" title={item.breakdownText}>{item.breakdownText}</div>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <div className="font-bold text-cyan-400 text-sm truncate">
                          {(Number(item.volumeM3) || 0).toFixed(2)} <span className="text-xs text-cyan-500 font-sans">m³</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {((Number(item.volumeCft) || (Number(item.volumeM3) || 0) * 35.3146667)).toFixed(1)} CFT
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {canEditOrDelete ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="text-slate-400 hover:text-white cursor-pointer transition-colors p-1"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="text-slate-400 hover:text-rose-400 cursor-pointer transition-colors p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span title="Edit/Delete restricted for this account">
                              <Lock className="w-3.5 h-3.5 text-slate-600 inline ml-1" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Multi-Category Concrete Calculator */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0B1322] border border-[#1A2640] rounded-3xl w-full max-w-3xl shadow-2xl p-6 space-y-5 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1A2640] pb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {editingItem ? 'Edit Structural Work' : 'Add Structural Concrete Work'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Calculate concrete work in m³ with multi-category & multi-row entry support.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer bg-[#121c2d]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-5 text-xs font-mono">
              {/* Site Assignment, Mix Grade & Date Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-[#070B16] border border-[#17243F] space-y-1.5">
                  <label className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Assign to Site:</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="ongoingSitesList"
                      placeholder="Select or type site name..."
                      value={modalTargetSiteKey}
                      onChange={(e) => setModalTargetSiteKey(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F172B] border border-[#1E2E4E] rounded-xl text-cyan-300 font-bold outline-none text-xs font-sans uppercase"
                    />
                    <datalist id="ongoingSitesList">
                      <option value={currentSiteKey} />
                      {registeredSites.map(s => {
                        const sName = extractCleanSiteName(s.name || s.siteName || s.id);
                        return <option key={s.id || sName} value={sName} />;
                      })}
                    </datalist>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#070B16] border border-[#17243F] space-y-1.5">
                  <label className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mix Design Grade:</span>
                  </label>
                  <select
                    value={modalMixGrade}
                    onChange={(e) => setModalMixGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0F172B] border border-[#1E2E4E] rounded-xl text-amber-300 font-bold outline-none cursor-pointer text-xs"
                  >
                    <option value="M15">M15 Grade Design</option>
                    <option value="M20">M20 Grade Design</option>
                    <option value="M25">M25 Grade Design</option>
                    <option value="M30">M30 Grade Design</option>
                    <option value="M35">M35 Grade Design</option>
                    <option value="M40">M40 Grade Design</option>
                    <option value="M45">M45 Grade Design</option>
                    <option value="M50">M50 Grade Design</option>
                  </select>
                </div>

                <div className="p-3 rounded-2xl bg-[#070B16] border border-[#17243F] space-y-1.5">
                  <label className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Entry Date:</span>
                  </label>
                  <input
                    type="date"
                    value={modalWorkDate}
                    onChange={(e) => setModalWorkDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0F172B] border border-[#1E2E4E] rounded-xl text-white font-bold outline-none text-xs cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#070B16] border border-[#17243F]">
                <span className="text-slate-300 font-bold uppercase tracking-wider">Input Dimensions Unit:</span>
                <div className="flex items-center gap-1 bg-[#0F172B] p-1 rounded-xl border border-[#1E2E4E]">
                  <button
                    type="button"
                    onClick={() => setUnitMode('METRIC')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${unitMode === 'METRIC' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Metric (m & mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitMode('IMPERIAL')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${unitMode === 'IMPERIAL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Imperial (ft & in)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-slate-300 font-bold uppercase tracking-wider">
                  Select Categories to Include (Multiple Allowed):
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORY_DEFINITIONS.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`flex items-center gap-2 py-3 px-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
                          isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500' : 'bg-[#070B16] hover:bg-[#141F38] text-slate-400 hover:text-white border border-[#17243F]'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3] text-white shrink-0" /> : <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">Work Label / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Foundation & Ground Floor Columns"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-4 py-3 bg-[#070B16] border border-[#17243F] rounded-2xl text-white outline-none focus:border-blue-500 text-sm font-sans font-bold"
                />
              </div>

              {/* DYNAMIC CATEGORY PANELS WITH EXPLICIT UNITS */}
              <div className="space-y-4 pt-1">
                {/* 1. SLAB / DECK */}
                {selectedCategories.includes('SLAB') && (
                  <div className="p-4 bg-[#070B16] rounded-2xl border border-[#17243F] space-y-3 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-[#141E33]">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <Layers className="w-4 h-4" />
                        <span>Slab / Deck Dimensions</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-cyan-300 text-xs">{subVolumesM3.SLAB.toFixed(2)} m³</span>
                        <button 
                          type="button" 
                          onClick={() => setSlabs([...slabs, { length: '', width: '', thickness: '' }])} 
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-cyan-400 border border-blue-500/30 rounded-lg text-xs flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" /> <span>Add Row</span>
                        </button>
                      </div>
                    </div>
                    {slabs.map((slab, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#0B1322] p-3 rounded-xl border border-[#17243F]">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Length ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={slab.length} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setSlabs(slabs.map((row, i) => (i === idx ? { ...row, length: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Width ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={slab.width} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setSlabs(slabs.map((row, i) => (i === idx ? { ...row, width: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Thickness ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={slab.thickness} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setSlabs(slabs.map((row, i) => (i === idx ? { ...row, thickness: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end pt-5">
                          {slabs.length > 1 && (
                            <button type="button" onClick={() => setSlabs(slabs.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. COLUMN */}
                {selectedCategories.includes('COLUMN') && (
                  <div className="p-4 bg-[#070B16] rounded-2xl border border-[#17243F] space-y-3 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-[#141E33]">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <Box className="w-4 h-4" />
                        <span>Column Dimensions</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-cyan-300 text-xs">{subVolumesM3.COLUMN.toFixed(2)} m³</span>
                        <button 
                          type="button" 
                          onClick={() => setColumns([...columns, { count: '', height: '', dim1: '', dim2: '' }])} 
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-cyan-400 border border-blue-500/30 rounded-lg text-xs flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" /> <span>Add Row</span>
                        </button>
                      </div>
                    </div>
                    {columns.map((col, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#0B1322] p-3 rounded-xl border border-[#17243F]">
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">Count (Nos)</label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={col.count} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setColumns(columns.map((row, i) => (i === idx ? { ...row, count: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Height ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={col.height} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setColumns(columns.map((row, i) => (i === idx ? { ...row, height: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Width / D1 ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={col.dim1} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setColumns(columns.map((row, i) => (i === idx ? { ...row, dim1: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Depth / D2 ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={col.dim2} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setColumns(columns.map((row, i) => (i === idx ? { ...row, dim2: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end pt-5">
                          {columns.length > 1 && (
                            <button type="button" onClick={() => setColumns(columns.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. BEAM */}
                {selectedCategories.includes('BEAM') && (
                  <div className="p-4 bg-[#070B16] rounded-2xl border border-[#17243F] space-y-3 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-[#141E33]">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <Building className="w-4 h-4" />
                        <span>Beam Dimensions</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-cyan-300 text-xs">{subVolumesM3.BEAM.toFixed(2)} m³</span>
                        <button 
                          type="button" 
                          onClick={() => setBeams([...beams, { count: '', length: '', width: '', depth: '' }])} 
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-cyan-400 border border-blue-500/30 rounded-lg text-xs flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" /> <span>Add Row</span>
                        </button>
                      </div>
                    </div>
                    {beams.map((beam, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#0B1322] p-3 rounded-xl border border-[#17243F]">
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">Count (Nos)</label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={beam.count} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setBeams(beams.map((row, i) => (i === idx ? { ...row, count: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Length ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={beam.length} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setBeams(beams.map((row, i) => (i === idx ? { ...row, length: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Width ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={beam.width} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setBeams(beams.map((row, i) => (i === idx ? { ...row, width: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Depth ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={beam.depth} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setBeams(beams.map((row, i) => (i === idx ? { ...row, depth: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end pt-5">
                          {beams.length > 1 && (
                            <button type="button" onClick={() => setBeams(beams.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. RCC / SHEAR WALL */}
                {selectedCategories.includes('RCC_WALL') && (
                  <div className="p-4 bg-[#070B16] rounded-2xl border border-[#17243F] space-y-3 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-[#141E33]">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <Building className="w-4 h-4" />
                        <span>RCC / Shear Wall Dimensions</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-cyan-300 text-xs">{subVolumesM3.RCC_WALL.toFixed(2)} m³</span>
                        <button 
                          type="button" 
                          onClick={() => setWalls([...walls, { count: '', length: '', height: '', thickness: '' }])} 
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-cyan-400 border border-blue-500/30 rounded-lg text-xs flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" /> <span>Add Row</span>
                        </button>
                      </div>
                    </div>
                    {walls.map((wall, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#0B1322] p-3 rounded-xl border border-[#17243F]">
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">Count (Nos)</label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={wall.count} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setWalls(walls.map((row, i) => (i === idx ? { ...row, count: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Length ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={wall.length} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setWalls(walls.map((row, i) => (i === idx ? { ...row, length: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Height ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={wall.height} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setWalls(walls.map((row, i) => (i === idx ? { ...row, height: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Thickness ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={wall.thickness} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setWalls(walls.map((row, i) => (i === idx ? { ...row, thickness: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end pt-5">
                          {walls.length > 1 && (
                            <button type="button" onClick={() => setWalls(walls.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 5. STAIRCASE */}
                {selectedCategories.includes('STAIRS') && (
                  <div className="p-4 bg-[#070B16] rounded-2xl border border-[#17243F] space-y-3 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-[#141E33]">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <Footprints className="w-4 h-4" />
                        <span>Staircase Steps & Waist Slab</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-cyan-300 text-xs">{subVolumesM3.STAIRS.toFixed(2)} m³</span>
                        <button 
                          type="button" 
                          onClick={() => setStairsList([...stairsList, { flights: '', width: '', steps: '', tread: '', riser: '', waist: '' }])} 
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-cyan-400 border border-blue-500/30 rounded-lg text-xs flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" /> <span>Add Row</span>
                        </button>
                      </div>
                    </div>
                    {stairsList.map((st, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center bg-[#0B1322] p-3 rounded-xl border border-[#17243F]">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">Flights (Nos)</label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={st.flights} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setStairsList(stairsList.map((row, i) => (i === idx ? { ...row, flights: val } : row)));
                            }} 
                            className="w-full px-2 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Width ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={st.width} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setStairsList(stairsList.map((row, i) => (i === idx ? { ...row, width: val } : row)));
                            }} 
                            className="w-full px-2 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">Steps (Nos)</label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={st.steps} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setStairsList(stairsList.map((row, i) => (i === idx ? { ...row, steps: val } : row)));
                            }} 
                            className="w-full px-2 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Tread ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={st.tread} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setStairsList(stairsList.map((row, i) => (i === idx ? { ...row, tread: val } : row)));
                            }} 
                            className="w-full px-2 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Riser ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={st.riser} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setStairsList(stairsList.map((row, i) => (i === idx ? { ...row, riser: val } : row)));
                            }} 
                            className="w-full px-2 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Waist ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={st.waist} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setStairsList(stairsList.map((row, i) => (i === idx ? { ...row, waist: val } : row)));
                            }} 
                            className="w-full px-2 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end pt-5">
                          {stairsList.length > 1 && (
                            <button type="button" onClick={() => setStairsList(stairsList.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. FOOTING */}
                {selectedCategories.includes('FOOTING') && (
                  <div className="p-4 bg-[#070B16] rounded-2xl border border-[#17243F] space-y-3 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-[#141E33]">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <Box className="w-4 h-4" />
                        <span>Footing / Foundation Dimensions</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-cyan-300 text-xs">{subVolumesM3.FOOTING.toFixed(2)} m³</span>
                        <button 
                          type="button" 
                          onClick={() => setFootings([...footings, { count: '', length: '', width: '', depth: '' }])} 
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-cyan-400 border border-blue-500/30 rounded-lg text-xs flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" /> <span>Add Row</span>
                        </button>
                      </div>
                    </div>
                    {footings.map((ft, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#0B1322] p-3 rounded-xl border border-[#17243F]">
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">Count (Nos)</label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={ft.count} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setFootings(footings.map((row, i) => (i === idx ? { ...row, count: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Length ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={ft.length} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setFootings(footings.map((row, i) => (i === idx ? { ...row, length: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Width ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={ft.width} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setFootings(footings.map((row, i) => (i === idx ? { ...row, width: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Depth ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={ft.depth} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setFootings(footings.map((row, i) => (i === idx ? { ...row, depth: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end pt-5">
                          {footings.length > 1 && (
                            <button type="button" onClick={() => setFootings(footings.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 7. ROAD WORK */}
                {selectedCategories.includes('ROAD_WORK') && (
                  <div className="p-4 bg-[#070B16] rounded-2xl border border-blue-500/40 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-[#141E33]">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <Truck className="w-4 h-4" />
                        <span>Road Pavement / DLC / PQC Pavement</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-cyan-300 text-xs">{subVolumesM3.ROAD_WORK.toFixed(2)} m³</span>
                        <button 
                          type="button" 
                          onClick={() => setRoads([...roads, { lengthKm: '', width: '', thickness: '' }])} 
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-cyan-400 border border-blue-500/30 rounded-lg text-xs flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" /> <span>Add Row</span>
                        </button>
                      </div>
                    </div>
                    {roads.map((rd, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#0B1322] p-3 rounded-xl border border-[#17243F]">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] text-cyan-300 mb-1 font-bold">
                            Length ({unitMode === 'METRIC' ? 'km' : 'Miles'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={rd.lengthKm} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setRoads(roads.map((row, i) => (i === idx ? { ...row, lengthKm: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-blue-500/50 rounded-xl text-cyan-300 font-bold font-mono text-xs outline-none focus:border-cyan-400" 
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                            Width ({unitMode === 'METRIC' ? 'm' : 'ft'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={rd.width} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setRoads(roads.map((row, i) => (i === idx ? { ...row, width: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-cyan-400 mb-1 font-bold">
                            Thickness ({unitMode === 'METRIC' ? 'mm' : 'in'})
                          </label>
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="0" 
                            value={rd.thickness} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setRoads(roads.map((row, i) => (i === idx ? { ...row, thickness: val } : row)));
                            }} 
                            className="w-full px-3 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-500" 
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end pt-5">
                          {roads.length > 1 && (
                            <button type="button" onClick={() => setRoads(roads.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Calculated Volume Preview */}
              <div className="p-4 bg-[#070B16] rounded-2xl border border-cyan-500/40 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Total Calculated Volume (All Categories)
                </span>
                <span className="text-2xl font-black text-cyan-400 font-mono mt-0.5 block">
                  {grandTotalComputed.totalM3.toFixed(2)} m³
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({grandTotalComputed.totalCft.toFixed(1)} CFT)
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1A2640]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 bg-[#070B16] hover:bg-[#16223D] text-slate-300 font-bold rounded-2xl cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 cursor-pointer text-xs transition"
                >
                  {editingItem ? 'Update Work' : 'Add Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteMeasurementStudio;
