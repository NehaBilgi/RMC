import React, { useState, useEffect, useMemo } from 'react';
import { 
  FlaskConical, 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  RotateCcw,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { canCreateRecords, getSessionUser, isAdminUser } from '../../utils/accessControl';

export interface ConcreteSiteTest {
  id: string;
  testDate: string;
  siteKey: string;
  mixGrade: string;
  batchVehicleNo: string;
  slumpMm: number;
  concreteTempC: number;
  cube7DayMpa?: number;
  cube28DayMpa?: number;
  testStatus: 'PASSED' | 'PENDING' | 'FAILED';
  testedBy: string;
  remarks?: string;
}

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

const getOngoingSiteDetails = () => {
  try {
    const activeRaw = localStorage.getItem('concrete360_active_site');
    if (activeRaw) {
      try {
        const parsed = JSON.parse(activeRaw);
        return {
          siteName: extractCleanSiteName(parsed.name || parsed.siteName || parsed.id),
          mixGrade: parsed.mixGrade || parsed.grade || parsed.defaultConcreteGrade || 'M25'
        };
      } catch {
        return {
          siteName: extractCleanSiteName(activeRaw),
          mixGrade: 'M25'
        };
      }
    }
    const selected = sessionStorage.getItem('concrete360_selected_site');
    if (selected) {
      return {
        siteName: extractCleanSiteName(selected),
        mixGrade: 'M25'
      };
    }
  } catch {}
  return { siteName: 'MBBILGI', mixGrade: 'M25' };
};

export const AtSiteTestsPage: React.FC = () => {
  const sessionUser = getSessionUser();
  const canCreate = canCreateRecords(sessionUser);
  const canEditOrDelete = isAdminUser(sessionUser);
  const [activeSiteInfo, setActiveSiteInfo] = useState(getOngoingSiteDetails());
  const currentSiteKey = activeSiteInfo.siteName;

  const loadSiteTests = (siteKey: string): ConcreteSiteTest[] => {
    try {
      const saved = localStorage.getItem(`concrete360_site_tests_${siteKey}`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}

    return [
      {
        id: 'TEST-101',
        testDate: new Date().toISOString().split('T')[0],
        siteKey,
        mixGrade: 'M25',
        batchVehicleNo: '7196',
        slumpMm: 120,
        concreteTempC: 28,
        cube7DayMpa: 19.5,
        cube28DayMpa: 28.2,
        testStatus: 'PASSED',
        testedBy: 'QC Engineer',
        remarks: 'Workability & target slump compliant as per IS 1199'
      },
      {
        id: 'TEST-102',
        testDate: new Date().toISOString().split('T')[0],
        siteKey,
        mixGrade: 'M30',
        batchVehicleNo: '8797',
        slumpMm: 135,
        concreteTempC: 29,
        cube7DayMpa: 22.8,
        testStatus: 'PENDING',
        testedBy: 'QC Engineer',
        remarks: '28-day water curing in progress in lab tank'
      }
    ];
  };

  const [tests, setTests] = useState<ConcreteSiteTest[]>(() => loadSiteTests(activeSiteInfo.siteName));
  const [searchQuery, setSearchQuery] = useState('');

  const monthBounds = getCurrentMonthBounds();
  const [fromDate, setFromDate] = useState<string>(monthBounds.start);
  const [toDate, setToDate] = useState<string>(monthBounds.end);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    testDate: new Date().toISOString().split('T')[0],
    siteName: activeSiteInfo.siteName,
    mixGrade: activeSiteInfo.mixGrade,
    batchVehicleNo: '',
    slumpMm: 120,
    concreteTempC: 28,
    cube7DayMpa: '',
    cube28DayMpa: '',
    testedBy: 'QC Engineer',
    remarks: ''
  });

  const availableMixers = useMemo(() => {
    try {
      const raw = localStorage.getItem(`concrete360_transit_mixers_${currentSiteKey}`) || localStorage.getItem('concrete360_transit_mixers');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => String(m.vehicleNo || m.vehicleNumber).trim()).filter(Boolean);
        }
      }
    } catch {}
    return ['7196', '8797', 'KA-01-TM-1234'];
  }, [currentSiteKey]);

  useEffect(() => {
    const handleSync = () => {
      const details = getOngoingSiteDetails();
      setActiveSiteInfo(details);
      setTests(loadSiteTests(details.siteName));
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

  const saveToStorage = (updatedList: ConcreteSiteTest[]) => {
    setTests(updatedList);
    try {
      localStorage.setItem(`concrete360_site_tests_${currentSiteKey}`, JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('concrete360_site_tests_updated', { detail: updatedList }));
    } catch (e) {
      console.error('Failed to update storage', e);
    }
  };

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      if (fromDate && t.testDate < fromDate) return false;
      if (toDate && t.testDate > toDate) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        t.batchVehicleNo.toLowerCase().includes(q) ||
        t.mixGrade.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.remarks && t.remarks.toLowerCase().includes(q))
      );
    });
  }, [tests, fromDate, toDate, searchQuery]);

  const stats = useMemo(() => {
    const total = filteredTests.length;
    const passed = filteredTests.filter((t) => t.testStatus === 'PASSED').length;
    const pending = filteredTests.filter((t) => t.testStatus === 'PENDING').length;
    const avgSlump = total > 0 ? Math.round(filteredTests.reduce((s, t) => s + (Number(t.slumpMm) || 0), 0) / total) : 0;
    return { total, passed, pending, avgSlump };
  }, [filteredTests]);

  const handleOpenAdd = () => {
    if (!canCreate) return;
    const currentSite = getOngoingSiteDetails();
    setEditingTestId(null);
    setFormData({
      testDate: new Date().toISOString().split('T')[0],
      siteName: currentSite.siteName,
      mixGrade: currentSite.mixGrade,
      batchVehicleNo: availableMixers[0] || '7196',
      slumpMm: 120,
      concreteTempC: 28,
      cube7DayMpa: '',
      cube28DayMpa: '',
      testedBy: 'QC Engineer',
      remarks: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ConcreteSiteTest) => {
    if (!canEditOrDelete) return;
    setEditingTestId(item.id);
    setFormData({
      testDate: item.testDate,
      siteName: item.siteKey,
      mixGrade: item.mixGrade,
      batchVehicleNo: item.batchVehicleNo,
      slumpMm: item.slumpMm,
      concreteTempC: item.concreteTempC,
      cube7DayMpa: item.cube7DayMpa !== undefined ? String(item.cube7DayMpa) : '',
      cube28DayMpa: item.cube28DayMpa !== undefined ? String(item.cube28DayMpa) : '',
      testedBy: item.testedBy || 'QC Engineer',
      remarks: item.remarks || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canEditOrDelete) return;
    if (!window.confirm('Delete this quality test record?')) return;
    const updated = tests.filter((t) => String(t.id).trim() !== String(id).trim());
    saveToStorage(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || (editingTestId && !canEditOrDelete)) return;

    let computedStatus: 'PASSED' | 'PENDING' | 'FAILED' = 'PENDING';
    const c28 = formData.cube28DayMpa !== '' ? Number(formData.cube28DayMpa) : null;
    const targetGradeNum = parseInt(formData.mixGrade.replace(/\D/g, ''), 10) || 25;

    if (c28 !== null) {
      computedStatus = c28 >= targetGradeNum ? 'PASSED' : 'FAILED';
    } else {
      computedStatus = 'PENDING';
    }

    const payload: ConcreteSiteTest = {
      id: editingTestId || `TEST-${Math.floor(100 + Math.random() * 900)}`,
      testDate: formData.testDate,
      siteKey: formData.siteName || currentSiteKey,
      mixGrade: formData.mixGrade,
      batchVehicleNo: formData.batchVehicleNo.trim().toUpperCase(),
      slumpMm: Number(formData.slumpMm) || 0,
      concreteTempC: Number(formData.concreteTempC) || 28,
      cube7DayMpa: formData.cube7DayMpa !== '' ? Number(formData.cube7DayMpa) : undefined,
      cube28DayMpa: c28 !== null ? c28 : undefined,
      testStatus: computedStatus,
      testedBy: formData.testedBy.trim() || 'QC Engineer',
      remarks: formData.remarks.trim()
    };

    if (editingTestId) {
      const updated = tests.map((t) => (t.id === editingTestId ? payload : t));
      saveToStorage(updated);
    } else {
      saveToStorage([payload, ...tests]);
    }

    setIsModalOpen(false);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Banner Header */}
      <div className="bg-[#0b1322] border border-[#1b273d] p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl no-print">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                CONCRETE QA & QC TELEMETRY ({currentSiteKey})
              </span>
              <span className="text-xs font-mono text-slate-400">IS 456 / IS 1199 Standard</span>
            </div>
            <h2 className="text-xl font-black text-white mt-1 tracking-tight">
              At-Site Concrete & Slump Testing Laboratory
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintReport}
            className="px-4 py-2.5 bg-[#121d2f] hover:bg-[#1a2847] border border-[#1b273d] text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Print QA Report</span>
          </button>

          {canCreate && (
            <button
              onClick={handleOpenAdd}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Log Concrete Test</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono no-print">
        <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Samples Tested</span>
            <strong className="text-white text-lg">{stats.total} Tests</strong>
          </div>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Quality Passed</span>
            <strong className="text-emerald-400 text-lg">{stats.passed} Batches</strong>
          </div>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">28-Day Curing Pending</span>
            <strong className="text-amber-400 text-lg">{stats.pending} Cubes</strong>
          </div>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Avg Site Slump</span>
            <strong className="text-cyan-300 text-lg">{stats.avgSlump} mm</strong>
          </div>
        </div>
      </div>

      {/* Date & Search Filters */}
      <div className="p-3.5 rounded-2xl bg-[#0b1322] border border-[#1b273d] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-xl no-print">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search TM vehicle, grade, test ID..."
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
          Showing <strong className="text-white">{filteredTests.length}</strong> of {tests.length} records
        </div>
      </div>

      {/* Tests Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-6">Test Date</th>
                <th className="py-4 px-6">Site Name</th>
                <th className="py-4 px-6">Grade</th>
                <th className="py-4 px-6">TM Truck</th>
                <th className="py-4 px-6">Workability (Slump)</th>
                <th className="py-4 px-6">Temp (°C)</th>
                <th className="py-4 px-6">Strength (7d / 28d)</th>
                <th className="py-4 px-6">Result Status</th>
                <th className="py-4 px-6 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500 font-sans">
                    {"No concrete quality tests recorded for this date range. Click '+ Log Concrete Test' to add."}
                  </td>
                </tr>
              ) : (
                filteredTests.map((test) => (
                  <tr key={test.id} className="hover:bg-[#0e1728] transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-300 whitespace-nowrap">
                      {formatDateDDMMYYYY(test.testDate)}
                    </td>

                    <td className="py-4 px-6 font-sans">
                      <strong className="text-emerald-400 block text-sm font-bold uppercase">{test.siteKey}</strong>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{test.id} • Tested by {test.testedBy}</span>
                    </td>

                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                        {test.mixGrade}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-amber-400 font-black text-sm">
                      {test.batchVehicleNo}
                    </td>

                    <td className="py-4 px-6 font-bold text-cyan-300">
                      {test.slumpMm} mm
                    </td>

                    <td className="py-4 px-6 text-slate-300">
                      {test.concreteTempC}°C
                    </td>

                    <td className="py-4 px-6">
                      <span className="text-emerald-400 font-bold block">
                        7d: {test.cube7DayMpa ? `${test.cube7DayMpa} MPa` : '—'}
                      </span>
                      <span className="text-slate-400 text-[10px] block">
                        28d: {test.cube28DayMpa ? `${test.cube28DayMpa} MPa` : 'Pending'}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        test.testStatus === 'PASSED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : test.testStatus === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {test.testStatus}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right no-print">
                      {canEditOrDelete && <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(test)}
                          title="Edit Test Record"
                          className="p-1.5 rounded-lg bg-[#121d2f] hover:bg-blue-600/20 text-blue-400 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(test.id)}
                          title="Delete Test Record"
                          className="p-1.5 rounded-lg bg-[#121d2f] hover:bg-rose-600/20 text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Log / Edit Concrete Test */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0b1322] border border-[#1e2d46] rounded-3xl w-full max-w-xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#1e2d46]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider font-sans">
                    {editingTestId ? 'Edit Concrete Quality Sample' : 'Log At-Site Concrete Test'}
                  </h3>
                  <p className="text-[11px] text-slate-400">IS 456 Sampling & Curing Verification</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-[#121c2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              {/* Site Name & Test Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Ongoing Site *</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={formData.siteName}
                      className="w-full px-3 py-2 bg-[#070d1a]/80 border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none cursor-not-allowed"
                      title="Bound to currently active site"
                    />
                    <Building2 className="w-4 h-4 text-emerald-500/60 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Test Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.testDate}
                    onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Autoselected Mix Grade & Transit Mixer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Mix Grade (Autoselected) *</label>
                  <select
                    value={formData.mixGrade}
                    onChange={(e) => setFormData({ ...formData, mixGrade: e.target.value })}
                    className="w-full px-3 py-2 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-300 font-bold outline-none cursor-pointer"
                  >
                    <option value="M15">M15 Grade</option>
                    <option value="M20">M20 Grade</option>
                    <option value="M25">M25 Grade</option>
                    <option value="M30">M30 Grade</option>
                    <option value="M35">M35 Grade</option>
                    <option value="M40">M40 Grade</option>
                    <option value="M50">M50 Grade</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Transit Mixer No *</label>
                  <input
                    type="text"
                    required
                    list="mixerSuggestions"
                    placeholder="e.g. 7196"
                    value={formData.batchVehicleNo}
                    onChange={(e) => setFormData({ ...formData, batchVehicleNo: e.target.value })}
                    className="w-full px-3 py-2 bg-[#070d1a] border border-[#1b273d] rounded-xl text-amber-400 font-bold uppercase outline-none focus:border-blue-500"
                  />
                  <datalist id="mixerSuggestions">
                    {availableMixers.map((m, idx) => <option key={idx} value={m} />)}
                  </datalist>
                </div>
              </div>

              {/* Slump & Temp */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Slump (mm) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="250"
                    value={formData.slumpMm}
                    onChange={(e) => setFormData({ ...formData, slumpMm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-300 font-bold outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Temp (°C) *</label>
                  <input
                    type="number"
                    required
                    value={formData.concreteTempC}
                    onChange={(e) => setFormData({ ...formData, concreteTempC: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 7-Day & 28-Day Strength */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">7-Day Strength (MPa)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 19.5"
                    value={formData.cube7DayMpa}
                    onChange={(e) => setFormData({ ...formData, cube7DayMpa: e.target.value })}
                    className="w-full px-3 py-2 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">28-Day Strength (MPa)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 28.5"
                    value={formData.cube28DayMpa}
                    onChange={(e) => setFormData({ ...formData, cube28DayMpa: e.target.value })}
                    className="w-full px-3 py-2 bg-[#070d1a] border border-[#1b273d] rounded-xl text-emerald-400 font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Remarks & Observations</label>
                <input
                  type="text"
                  placeholder="e.g. Slump tested at point of discharge from TM, true shear observed"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-slate-300 font-sans text-xs outline-none focus:border-blue-500"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2d46]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-[#070d1a] hover:bg-[#121c2d] text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                {canCreate && (
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
                  >
                    {editingTestId ? 'Update Test' : 'Record Test'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtSiteTestsPage;
