import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SiteMeasurementSession, StructuralMeasurementItem } from '../../types/rmc';
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
  Ruler, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  Info,
  Filter,
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
  siteKey?: string;
  mixGrade?: string;
  date?: string;
  categories: StructuralType[];
  label: string;
  breakdownText: string;
  volumeM3: number;
  volumeCft: number;
  unitSystem: UnitSystem;
  dimensionsSnapshot?: StructuralDimensionsSnapshot;
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
  if (!name) return 'DEFAULT';
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

interface Props {
  session: SiteMeasurementSession;
  onUpdateSession: (session: SiteMeasurementSession) => void;
  onConvertToOrder?: (session: SiteMeasurementSession) => void;
}

export const SiteMeasurementStudio: React.FC<Props> = ({
  session,
  onUpdateSession
}) => {
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
  const [registeredSites, setRegisteredSites] = useState<any[]>([]);

  const loadRegisteredSites = () => {
    try {
      const saved = localStorage.getItem('concrete360_sites') || localStorage.getItem('concrete360_ongoing_sites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRegisteredSites(parsed);
      }
    } catch {}
  };

  const [items, setItems] = useState<ConcreteItem[]>([]);

  const loadSiteMeasurements = (siteKey: string) => {
    try {
      const saved = localStorage.getItem(`concrete360_advanced_measurements_${siteKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed.map((it: any) => ({
            id: String(it.id || `RCC-${Math.floor(1000 + Math.random() * 9000)}`),
            siteKey: String(it.siteKey || siteKey),
            mixGrade: String(it.mixGrade || 'M25'),
            date: String(it.date || new Date().toISOString().split('T')[0]),
            categories: Array.isArray(it.categories) && it.categories.length > 0 ? it.categories : ['SLAB'],
            label: String(it.label || it.name || 'Structural Work'),
            breakdownText: String(it.breakdownText || ''),
            volumeM3: Number(it.volumeM3) || 0,
            volumeCft: Number(it.volumeCft) || (Number(it.volumeM3) || 0) * 35.3146667,
            unitSystem: it.unitSystem === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC',
            dimensionsSnapshot: it.dimensionsSnapshot || {}
          })));
          return;
        }
      }
      setItems([]);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    loadRegisteredSites();
    const siteKey = getActiveSiteKey();
    setCurrentSiteKey(siteKey);
    loadSiteMeasurements(siteKey);

    const handleSiteSwitch = () => {
      const newKey = getActiveSiteKey();
      setCurrentSiteKey(newKey);
      loadRegisteredSites();
      loadSiteMeasurements(newKey);
    };

    window.addEventListener('concrete360_site_switched', handleSiteSwitch);
    window.addEventListener('storage', handleSiteSwitch);
    window.addEventListener('focus', handleSiteSwitch);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSiteSwitch);
      window.removeEventListener('storage', handleSiteSwitch);
      window.removeEventListener('focus', handleSiteSwitch);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(`concrete360_advanced_measurements_${currentSiteKey}`, JSON.stringify(items));
      if (items.length > 0 && items[0].mixGrade) {
        localStorage.setItem(`concrete360_active_mix_grade_${currentSiteKey}`, items[0].mixGrade);
      }
      window.dispatchEvent(new CustomEvent('concrete360_measurement_updated', { detail: items }));
    } catch {}
  }, [items, currentSiteKey]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConcreteItem | null>(null);

  const [blueprintFilterId, setBlueprintFilterId] = useState<string>('ALL');
  const [modalTargetSiteKey, setModalTargetSiteKey] = useState<string>(currentSiteKey);
  const [modalMixGrade, setModalMixGrade] = useState<string>('M25');
  const [modalWorkDate, setModalWorkDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState<number>(20);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 380, y: 320 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  const [mixerCapacityM3, setMixerCapacityM3] = useState<number>(session?.transitTruckCapacityM3 || 7.0);
  const [wastagePercent, setWastagePercent] = useState<number>(session?.safetyWastagePercent || 5);
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

  const isoProject = (x: number, y: number, z: number, originX: number, originY: number, s: number) => {
    const cos30 = 0.866;
    const sin30 = 0.5;
    const screenX = originX + (x - y) * cos30 * s;
    const screenY = originY + (x + y) * sin30 * s - z * s;
    return { x: screenX, y: screenY };
  };

  const drawIsometricPrism = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    originX: number,
    originY: number,
    s: number,
    fillTop: string,
    fillLeft: string,
    fillRight: string,
    strokeColor: string
  ) => {
    const p100 = isoProject(x + dx, y, z, originX, originY, s);
    const p110 = isoProject(x + dx, y + dy, z, originX, originY, s);
    const p010 = isoProject(x, y + dy, z, originX, originY, s);

    const p001 = isoProject(x, y, z + dz, originX, originY, s);
    const p101 = isoProject(x + dx, y, z + dz, originX, originY, s);
    const p111 = isoProject(x + dx, y + dy, z + dz, originX, originY, s);
    const p011 = isoProject(x, y + dy, z + dz, originX, originY, s);

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = strokeColor;

    ctx.beginPath();
    ctx.moveTo(p100.x, p100.y);
    ctx.lineTo(p110.x, p110.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p101.x, p101.y);
    ctx.closePath();
    ctx.fillStyle = fillRight;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p010.x, p010.y);
    ctx.lineTo(p110.x, p110.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p011.x, p011.y);
    ctx.closePath();
    ctx.fillStyle = fillLeft;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p001.x, p001.y);
    ctx.lineTo(p101.x, p101.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p011.x, p011.y);
    ctx.closePath();
    ctx.fillStyle = fillTop;
    ctx.fill();
    ctx.stroke();
  };

  useEffect(() => {
    if (!isBlueprintModalOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = '#060a13';
    ctx.fillRect(0, 0, width, height);

    const gridSize = scale * 1.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#121e33';

    if (viewMode === '2d') {
      const startX = pan.x % gridSize;
      const startY = pan.y % gridSize;
      for (let x = startX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = startY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else {
      const gridExtent = 12;
      for (let i = -gridExtent; i <= gridExtent; i += 2) {
        const p1 = isoProject(-gridExtent, i, 0, pan.x, pan.y, scale);
        const p2 = isoProject(gridExtent, i, 0, pan.x, pan.y, scale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const q1 = isoProject(i, -gridExtent, 0, pan.x, pan.y, scale);
        const q2 = isoProject(i, gridExtent, 0, pan.x, pan.y, scale);
        ctx.beginPath();
        ctx.moveTo(q1.x, q1.y);
        ctx.lineTo(q2.x, q2.y);
        ctx.stroke();
      }
    }

    const targetItems = blueprintFilterId === 'ALL' 
      ? items 
      : items.filter(it => it.id === blueprintFilterId);

    targetItems.forEach(it => {
      const snap = it.dimensionsSnapshot;
      if (!snap) return;

      if (it.categories.includes('SLAB') && snap.slab) {
        drawIsometricPrism(
          ctx, 0, 0, 0,
          snap.slab.length || 10,
          snap.slab.width || 8,
          snap.slab.thickness || 0.15,
          pan.x, pan.y, scale,
          'rgba(59, 130, 246, 0.65)',
          'rgba(29, 78, 216, 0.75)',
          'rgba(37, 99, 235, 0.75)',
          '#60a5fa'
        );
      }
    });
  }, [items, scale, pan, viewMode, isBlueprintModalOpen, blueprintFilterId]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleToggleCategory = (catId: StructuralType) => {
    if (selectedCategories.includes(catId)) {
      if (selectedCategories.length === 1) return;
      setSelectedCategories(selectedCategories.filter((id) => id !== catId));
    } else {
      setSelectedCategories([...selectedCategories, catId]);
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
    setEditingItem(null);
    setModalTargetSiteKey(currentSiteKey);
    setModalMixGrade('M25');
    setSelectedCategories(['SLAB']);
    resetAllFields();
    setUnitMode('METRIC');
    setIsModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;

    if (editingItem && !canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can modify records.');
      return;
    }

    const parts = selectedCategories.map((cat) => {
      const labelName = CATEGORY_DEFINITIONS.find((c) => c.id === cat)?.label.split('/')[0].trim();
      return `${labelName} (${subVolumesM3[cat].toFixed(2)}m³)`;
    });

    const breakdownText = parts.join(' + ');

    const isMetric = unitMode === 'METRIC';
    const toM = (val: number | '') => (Number(val) || 0) * (isMetric ? 1 : 0.3048);

    const snapshot: StructuralDimensionsSnapshot = {};
    if (selectedCategories.includes('SLAB') && slabs.length > 0) {
      snapshot.slab = { length: toM(slabs[0].length), width: toM(slabs[0].width), thickness: toM(slabs[0].thickness) };
    }

    const cleanTargetKey = extractCleanSiteName(modalTargetSiteKey);

    if (cleanTargetKey !== currentSiteKey) {
      try {
        const targetStorageKey = `concrete360_advanced_measurements_${cleanTargetKey}`;
        const existingRaw = localStorage.getItem(targetStorageKey);
        const existingParsed = existingRaw ? JSON.parse(existingRaw) : [];
        const newItem: ConcreteItem = {
          id: `RCC-${Math.floor(1000 + Math.random() * 9000)}`,
          siteKey: cleanTargetKey,
          mixGrade: modalMixGrade,
          date: modalWorkDate,
          categories: selectedCategories,
          label: label.trim() || `Structural Work`,
          breakdownText,
          volumeM3: Number(grandTotalComputed.totalM3.toFixed(3)),
          volumeCft: Number(grandTotalComputed.totalCft.toFixed(2)),
          unitSystem: unitMode,
          dimensionsSnapshot: snapshot
        };
        localStorage.setItem(targetStorageKey, JSON.stringify([newItem, ...existingParsed]));
      } catch {}
    } else {
      if (editingItem) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === editingItem.id
              ? {
                  ...it,
                  siteKey: currentSiteKey,
                  mixGrade: modalMixGrade,
                  date: modalWorkDate,
                  categories: selectedCategories,
                  label: label.trim() || `Structural Work`,
                  breakdownText,
                  volumeM3: Number(grandTotalComputed.totalM3.toFixed(3)),
                  volumeCft: Number(grandTotalComputed.totalCft.toFixed(2)),
                  unitSystem: unitMode,
                  dimensionsSnapshot: snapshot
                }
              : it
          )
        );
      } else {
        const newItem: ConcreteItem = {
          id: `RCC-${Math.floor(1000 + Math.random() * 9000)}`,
          siteKey: currentSiteKey,
          mixGrade: modalMixGrade,
          date: modalWorkDate,
          categories: selectedCategories,
          label: label.trim() || `Structural Work`,
          breakdownText,
          volumeM3: Number(grandTotalComputed.totalM3.toFixed(3)),
          volumeCft: Number(grandTotalComputed.totalCft.toFixed(2)),
          unitSystem: unitMode,
          dimensionsSnapshot: snapshot
        };
        setItems((prev) => [newItem, ...prev]);
      }
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can delete structural works.');
      return;
    }
    if (window.confirm('Delete this structural work record?')) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.id || '').toLowerCase().includes(q) ||
        (it.label || '').toLowerCase().includes(q) ||
        (it.breakdownText || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const totalWetM3 = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.volumeM3) || 0), 0);
  }, [items]);

  const totalWithWastage = useMemo(() => {
    return totalWetM3 * (1 + wastagePercent / 100);
  }, [totalWetM3, wastagePercent]);

  const totalRmcVehicles = useMemo(() => {
    if (mixerCapacityM3 <= 0 || totalWithWastage <= 0) return 0;
    return Math.ceil(totalWithWastage / mixerCapacityM3);
  }, [totalWithWastage, mixerCapacityM3]);

  useEffect(() => {
    if (typeof onUpdateSession !== 'function') return;
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

    onUpdateSession({
      ...session,
      structures,
      totalNetM3: Number(totalWetM3.toFixed(1)),
      totalGrossM3: Number(totalWithWastage.toFixed(1)),
      requiredTruckLoads: totalRmcVehicles,
      transitTruckCapacityM3: mixerCapacityM3,
      safetyWastagePercent: wastagePercent
    });
  }, [items, totalWetM3, totalWithWastage, totalRmcVehicles, mixerCapacityM3, wastagePercent]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Top Banner & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight uppercase">
            Concrete Master &amp; Structural Calculator ({currentSiteKey})
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Calculate concrete for slabs, columns, beams, walls, footings, stairs, and road works. Data is strictly isolated per site.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setBlueprintFilterId('ALL');
              setIsBlueprintModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#121d2f] hover:bg-[#1a2942] text-cyan-400 border border-cyan-500/30 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>See Blueprint</span>
          </button>

          {canCreate && (
            <button
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
              Order (+{wastagePercent}% Wastage)
            </span>
            <input
              type="number"
              value={wastagePercent}
              onChange={(e) => setWastagePercent(Math.max(0, Number(e.target.value)))}
              className="w-12 text-right bg-[#10192E] border border-[#1E2E4E] rounded px-1 text-xs text-cyan-300 outline-none"
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
                <th className="py-4 px-6 w-[12%]">ID &amp; MIX</th>
                <th className="py-4 px-6 w-[15%]">DATE</th>
                <th className="py-4 px-6 w-[20%]">CATEGORIES INCLUDED</th>
                <th className="py-4 px-6 w-[25%]">DESCRIPTION &amp; BREAKDOWN</th>
                <th className="py-4 px-6 text-center w-[14%]">TOTAL VOLUME (M³ / CFT)</th>
                <th className="py-4 px-6 text-right w-[14%]">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121B2D] text-slate-200 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No structural concrete works logged for this site. Click &quot;+ Add Structural Work&quot; to add.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
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
                        {(item.categories || []).map((c) => (
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
                        <button
                          onClick={() => {
                            setBlueprintFilterId(item.id);
                            setIsBlueprintModalOpen(true);
                          }}
                          className="text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors p-1"
                          title="View CAD Layout"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canEditOrDelete ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setModalTargetSiteKey(item.siteKey || currentSiteKey);
                                setModalMixGrade(item.mixGrade || 'M25');
                                setModalWorkDate(item.date || new Date().toISOString().split('T')[0]);
                                setSelectedCategories(item.categories || ['SLAB']);
                                setLabel(item.label || '');
                                setUnitMode(item.unitSystem || 'METRIC');
                                setIsModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-white cursor-pointer transition-colors p-1"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL STRUCTURAL BLUEPRINT MODAL */}
      {isBlueprintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0B1322] border border-[#1A2640] rounded-3xl w-full max-w-5xl shadow-2xl p-6 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1A2640] pb-3 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Ruler className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {blueprintFilterId === 'ALL' 
                      ? 'Combined CAD Blueprint' 
                      : (items.find(i => i.id === blueprintFilterId)?.label || 'Isolated Element View')}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Precision engineering CAD preview with structural dimensions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-[#121d2f] border border-[#22334f] px-3 py-1.5 rounded-xl text-xs font-mono">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={blueprintFilterId}
                    onChange={(e) => setBlueprintFilterId(e.target.value)}
                    className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
                  >
                    <option value="ALL">All Added Works</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        {it.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center bg-[#121d2f] rounded-xl border border-[#22334f] p-1 text-xs">
                  <button
                    onClick={() => setViewMode('2d')}
                    className={`px-3 py-1 font-bold rounded-lg transition cursor-pointer ${viewMode === '2d' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    2D Plan
                  </button>
                  <button
                    onClick={() => setViewMode('3d')}
                    className={`px-3 py-1 font-bold rounded-lg transition cursor-pointer ${viewMode === '3d' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    3D Isometric
                  </button>
                </div>

                <div className="flex items-center bg-[#121d2f] rounded-xl border border-[#22334f] p-1 font-mono text-xs">
                  <button onClick={() => setScale(s => Math.max(8, s - 3))} className="p-1.5 text-slate-400 hover:text-white cursor-pointer"><ZoomOut className="w-3.5 h-3.5" /></button>
                  <span className="px-2 text-white">{Math.round(scale)}x</span>
                  <button onClick={() => setScale(s => Math.min(45, s + 3))} className="p-1.5 text-slate-400 hover:text-white cursor-pointer"><ZoomIn className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setScale(20); setPan({ x: 380, y: 320 }); }} className="p-1.5 text-slate-400 hover:text-white border-l border-[#22334f] cursor-pointer" title="Reset View"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>

                <button
                  onClick={() => setIsBlueprintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-[#121c2d] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Canvas Viewport */}
            <div className="relative flex-1 w-full min-h-[480px] bg-[#060a12] border border-[#172439] rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-full block"
              />
              <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none font-mono">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Showing exact measurements. Drag to pan. Scroll or use controls to zoom.</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  Calculate concrete work in m³ with multi-category &amp; multi-row entry support.
                </p>
              </div>
              <button
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
                        const sName = s.name || s.siteName || s.id;
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
                    <option value="M20">M20 Grade Design</option>
                    <option value="M25">M25 Grade Design</option>
                    <option value="M30">M30 Grade Design</option>
                    <option value="M35">M35 Grade Design</option>
                    <option value="M40">M40 Grade Design</option>
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
                    Metric (m &amp; mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitMode('IMPERIAL')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${unitMode === 'IMPERIAL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Imperial (ft &amp; in)
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
                        key={cat.id}
                        type="button"
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
                            onChange={(e) => { const n = [...slabs]; n[idx].length = e.target.value === '' ? '' : Number(e.target.value); setSlabs(n); }} 
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
                            onChange={(e) => { const n = [...slabs]; n[idx].width = e.target.value === '' ? '' : Number(e.target.value); setSlabs(n); }} 
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
                            onChange={(e) => { const n = [...slabs]; n[idx].thickness = e.target.value === '' ? '' : Number(e.target.value); setSlabs(n); }} 
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
                            onChange={(e) => { const n = [...columns]; n[idx].count = e.target.value === '' ? '' : Number(e.target.value); setColumns(n); }} 
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
                            onChange={(e) => { const n = [...columns]; n[idx].height = e.target.value === '' ? '' : Number(e.target.value); setColumns(n); }} 
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
                            onChange={(e) => { const n = [...columns]; n[idx].dim1 = e.target.value === '' ? '' : Number(e.target.value); setColumns(n); }} 
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
                            onChange={(e) => { const n = [...columns]; n[idx].dim2 = e.target.value === '' ? '' : Number(e.target.value); setColumns(n); }} 
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
                            onChange={(e) => { const n = [...beams]; n[idx].count = e.target.value === '' ? '' : Number(e.target.value); setBeams(n); }} 
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
                            onChange={(e) => { const n = [...beams]; n[idx].length = e.target.value === '' ? '' : Number(e.target.value); setBeams(n); }} 
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
                            onChange={(e) => { const n = [...beams]; n[idx].width = e.target.value === '' ? '' : Number(e.target.value); setBeams(n); }} 
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
                            onChange={(e) => { const n = [...beams]; n[idx].depth = e.target.value === '' ? '' : Number(e.target.value); setBeams(n); }} 
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
                            onChange={(e) => { const n = [...walls]; n[idx].count = e.target.value === '' ? '' : Number(e.target.value); setWalls(n); }} 
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
                            onChange={(e) => { const n = [...walls]; n[idx].length = e.target.value === '' ? '' : Number(e.target.value); setWalls(n); }} 
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
                            onChange={(e) => { const n = [...walls]; n[idx].height = e.target.value === '' ? '' : Number(e.target.value); setWalls(n); }} 
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
                            onChange={(e) => { const n = [...walls]; n[idx].thickness = e.target.value === '' ? '' : Number(e.target.value); setWalls(n); }} 
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
                        <span>Staircase Steps &amp; Waist Slab</span>
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
                            onChange={(e) => { const n = [...stairsList]; n[idx].flights = e.target.value === '' ? '' : Number(e.target.value); setStairsList(n); }} 
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
                            onChange={(e) => { const n = [...stairsList]; n[idx].width = e.target.value === '' ? '' : Number(e.target.value); setStairsList(n); }} 
                            className="w-full px-2 py-2 bg-[#0F172B] border border-[#1C2C4E] rounded-xl text-white font-mono text-xs outline-none focus:border-blue-500" 
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-1 font-bold">Steps (Nos)</label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={st.steps} 
                            onChange={(e) => { const n = [...stairsList]; n[idx].steps = e.target.value === '' ? '' : Number(e.target.value); setStairsList(n); }} 
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
                            onChange={(e) => { const n = [...stairsList]; n[idx].tread = e.target.value === '' ? '' : Number(e.target.value); setStairsList(n); }} 
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
                            onChange={(e) => { const n = [...stairsList]; n[idx].riser = e.target.value === '' ? '' : Number(e.target.value); setStairsList(n); }} 
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
                            onChange={(e) => { const n = [...stairsList]; n[idx].waist = e.target.value === '' ? '' : Number(e.target.value); setStairsList(n); }} 
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
                            onChange={(e) => { const n = [...footings]; n[idx].count = e.target.value === '' ? '' : Number(e.target.value); setFootings(n); }} 
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
                            onChange={(e) => { const n = [...footings]; n[idx].length = e.target.value === '' ? '' : Number(e.target.value); setFootings(n); }} 
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
                            onChange={(e) => { const n = [...footings]; n[idx].width = e.target.value === '' ? '' : Number(e.target.value); setFootings(n); }} 
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
                            onChange={(e) => { const n = [...footings]; n[idx].depth = e.target.value === '' ? '' : Number(e.target.value); setFootings(n); }} 
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
                            onChange={(e) => { const n = [...roads]; n[idx].lengthKm = e.target.value === '' ? '' : Number(e.target.value); setRoads(n); }} 
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
                            onChange={(e) => { const n = [...roads]; n[idx].width = e.target.value === '' ? '' : Number(e.target.value); setRoads(n); }} 
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
                            onChange={(e) => { const n = [...roads]; n[idx].thickness = e.target.value === '' ? '' : Number(e.target.value); setRoads(n); }} 
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
