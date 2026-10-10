import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  DollarSign, 
  FileCheck2, 
  Truck, 
  Package, 
  FlaskConical, 
  Menu, 
  X,
  Layers,
  FileBarChart,
  Building,
  FileText,
  Wrench,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { SiteMeasurementSession } from '../../types/rmc';
import { SiteMeasurementStudio } from '../measurement/SiteMeasurementStudio';
import { OngoingSiteTransfer } from '../pages/OngoingSiteTransfer';
import { BillingRMC } from '../pages/BillingRMC';
import { MaterialCategory } from '../pages/MaterialCategory';
import { MaterialHaulageTripsModule } from '../pages/MaterialHaulageTripsModule';
import { Dashboard } from '../pages/Dashboard';
import { UserManagement } from '../pages/UserManagement';
import { MixDesignModule } from '../pages/MixDesignModule';
import { SiteMaterialReportModule } from '../pages/SiteMaterialReportModule';
import { TransitMixerPage } from '../pages/TransitMixerPage';
import { ConcretePumpsPage } from '../pages/ConcretePumpsPage';
import { CompanyDetailsModule } from '../pages/CompanyDetailsModule';
import { TotalBillPage } from '../pages/TotalBillPage';
import { AtSiteTestsPage } from '../pages/AtSiteTestsPage';
import { canViewPage, isAdminUser, SessionUser } from '../../utils/accessControl';

interface Props {
  measurementSession: SiteMeasurementSession;
  onUpdateMeasurementSession: (session: SiteMeasurementSession) => void;
  user: SessionUser;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

// Helper to normalize site name (e.g., "WW (G + 3 Floors)" -> "WW")
export const normalizeSiteKey = (raw: string): string => {
  if (!raw) return 'MBBILGI';
  let clean = raw.trim();
  // Strip trailing scopes in parentheses if any
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean || 'MBBILGI';
};

export const Sidebar: React.FC<Props> = ({
  measurementSession,
  onUpdateMeasurementSession,
  user,
  onLogout,
  theme,
  onToggleTheme
}) => {
  const getActiveSiteKey = () => {
    try {
      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        try {
          const parsed = JSON.parse(activeRaw);
          return normalizeSiteKey(parsed.name || parsed.siteName || parsed.id);
        } catch {
          return normalizeSiteKey(activeRaw);
        }
      }
      const selected = sessionStorage.getItem('concrete360_selected_site');
      if (selected) return normalizeSiteKey(selected);
    } catch {}
    return 'MBBILGI';
  };

  const [currentSite, setCurrentSite] = useState<string>(getActiveSiteKey());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  // Retrieve Active Authenticated User Details for Footer
  const [currentUser, setCurrentUser] = useState<SessionUser>(() => {
    try {
      const savedUser = sessionStorage.getItem('concrete360_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return {
          ...parsed,
          username: parsed.username || 'adminbilgi',
          role: parsed.role || 'ADMIN',
          pageAccess: Array.isArray(parsed.pageAccess) ? parsed.pageAccess : null
        };
      }
    } catch {}
    return user;
  });

  // Sync site switches and user updates across all modules
  useEffect(() => {
    const handleSiteSwitch = (e?: any) => {
      const siteName = e?.detail ? normalizeSiteKey(e.detail) : getActiveSiteKey();
      setCurrentSite(siteName);
    };

    const handleUserSync = () => {
      try {
        const savedUser = sessionStorage.getItem('concrete360_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          setCurrentUser({
            ...parsed,
            username: parsed.username || 'adminbilgi',
            role: parsed.role || 'ADMIN',
            pageAccess: Array.isArray(parsed.pageAccess) ? parsed.pageAccess : null
          });
        }
      } catch {}
    };

    window.addEventListener('concrete360_site_switched', handleSiteSwitch);
    window.addEventListener('storage', handleSiteSwitch);
    window.addEventListener('storage', handleUserSync);
    window.addEventListener('concrete360_user_updated', handleUserSync);
    window.addEventListener('focus', handleSiteSwitch);

    return () => {
      window.removeEventListener('concrete360_site_switched', handleSiteSwitch);
      window.removeEventListener('storage', handleSiteSwitch);
      window.removeEventListener('storage', handleUserSync);
      window.removeEventListener('concrete360_user_updated', handleUserSync);
      window.removeEventListener('focus', handleSiteSwitch);
    };
  }, []);

  const sidebarNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'SITE OPERATIONS' },
    { id: 'ongoing_site', label: 'Ongoing Site', icon: Building2, section: 'SITE OPERATIONS', badge: 'Sites' },
    { id: 'billing', label: 'Billing', icon: DollarSign, section: 'SITE OPERATIONS' },
    { id: 'total_bill', label: 'Total Bill of Site', icon: FileText, section: 'SITE OPERATIONS' },
    { id: 'site_tests', label: 'At-Site Tests', icon: FlaskConical, section: 'SITE OPERATIONS' },
    { id: 'trips', label: 'Trips', icon: Truck, section: 'SITE OPERATIONS', badge: 'Trips' },
    { id: 'material_category', label: 'Category of Material', icon: Package, section: 'ENGINEERING' },
    { id: 'transit_mixer', label: 'Transit Mixer', icon: Truck, section: 'ENGINEERING' },
    { id: 'concrete_pumps', label: 'Concrete Pumps', icon: Wrench, section: 'ENGINEERING' },
    { id: 'mix_design', label: 'Mix Design', icon: Layers, section: 'ENGINEERING' },
    { id: 'site_report', label: 'Report / Material Used', icon: FileBarChart, section: 'ENGINEERING' },
    { id: 'measurements', label: 'Site Inventory Measurements', icon: FileCheck2, section: 'ENGINEERING' },
    { id: 'company_details', label: 'Company Details', icon: Building, section: 'CONFIGURATION' },
    { id: 'user_management', label: 'User Management', icon: Users, section: 'CONFIGURATION', adminOnly: true },
  ];

  const visibleNavItems = sidebarNavItems.filter(item =>
    (!item.adminOnly || isAdminUser(currentUser)) && canViewPage(currentUser, item.id)
  );
  const activePage = visibleNavItems.some(item => item.id === activeTab)
    ? activeTab
    : (visibleNavItems[0]?.id || '');
  const sidebarGroups = ['SITE OPERATIONS', 'ENGINEERING', 'CONFIGURATION']
    .map(section => ({
      section,
      items: visibleNavItems.filter(item => item.section === section)
    }))
    .filter(group => group.items.length > 0);

  useEffect(() => {
    if (activePage && activePage !== activeTab) setActiveTab(activePage);
  }, [activePage, activeTab]);

  const handleNavigate = (targetId: string) => {
    let normalizedTarget = targetId;
    switch (targetId) {
      case 'site-inventory-measurements':
      case 'site-measurements':
      case 'site_measurements':
      case 'site-measurement-studio':
        normalizedTarget = 'measurements';
        break;
      case 'ongoing-site':
      case 'ongoing':
        normalizedTarget = 'ongoing_site';
        break;
      case 'total-bill':
        normalizedTarget = 'total_bill';
        break;
      case 'transit-mixer':
        normalizedTarget = 'transit_mixer';
        break;
      case 'concrete-pumps':
        normalizedTarget = 'concrete_pumps';
        break;
      case 'mix-design':
        normalizedTarget = 'mix_design';
        break;
      case 'reports':
      case 'site-report':
        normalizedTarget = 'site_report';
        break;
      case 'site-tests':
      case 'at-site-tests':
      case 'tests':
        normalizedTarget = 'site_tests';
        break;
      case 'material-category':
        normalizedTarget = 'material_category';
        break;
      case 'user-management':
        normalizedTarget = 'user_management';
        break;
      case 'company-details':
        normalizedTarget = 'company_details';
        break;
    }
    if (!canViewPage(currentUser, normalizedTarget)) return;
    if (normalizedTarget === 'user_management' && !isAdminUser(currentUser)) return;
    setActiveTab(normalizedTarget);
    setIsSidebarOpenMobile(false);
  };

  return (
    <div className="workspace-shell min-h-screen bg-[#060a12] text-white flex flex-row font-sans">
      {isSidebarOpenMobile && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsSidebarOpenMobile(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
        />
      )}
      {/* SIDEBAR NAVIGATION */}
      <aside className={`
        app-sidebar fixed inset-y-0 left-0 z-50 w-64 bg-[#080e1a] border-r border-[#152033] flex flex-col justify-between transition-transform duration-200 ease-in-out
        md:translate-x-0 ${isSidebarOpenMobile ? 'translate-x-0' : '-translate-x-full md:static'}
      `}>
        {/* Brand Header */}
        <div className="p-4 border-b border-[#142033]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30 border border-blue-400/40">
                <Truck className="w-6 h-6 text-white stroke-[2.2]" />
              </div>
              <div>
                <span className="text-xs font-black tracking-wider uppercase text-white block">
                  CONCRETE 360
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  SITE: {currentSite}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpenMobile(false)}
              className="md:hidden p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 app-sidebar-nav">
          {sidebarGroups.map(group => (
            <section key={group.section} className="space-y-1">
              <h2 className="px-2.5 pt-1 pb-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                {group.section}
              </h2>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    title={item.label}
                    className={`app-nav-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-[#10192b]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="app-nav-badge shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#142033] bg-[#070c17]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#0d1627] border border-[#17253e]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs shrink-0 uppercase">
                {currentUser.username.slice(0, 2) || 'AB'}
              </div>
              <div className="truncate">
                <span className="text-xs font-mono font-bold text-white block truncate">{currentUser.username}</span>
                <span className="text-[10px] font-mono text-blue-400 block truncate uppercase">{currentUser.role}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="workspace-header px-4 sm:px-6 py-3 flex items-center justify-between gap-3 border-b border-[#131d2e] bg-[#090f1a] sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpenMobile(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg bg-[#121c2d]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide truncate">
              {visibleNavItems.find(i => i.id === activePage)?.label || 'No pages assigned'}
            </h1>
          </div>
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            <span className="hidden lg:inline-flex text-[10px] font-mono font-bold text-cyan-400 bg-[#0e1728] border border-[#1b273d] px-2.5 py-1 rounded-xl max-w-40 truncate">
              Active: {currentSite}
            </span>
            <span className="hidden sm:inline text-[10px] sm:text-xs text-slate-400 font-mono">
              Role: <strong className="text-white uppercase">{currentUser.role}</strong>
            </span>
            <button
              onClick={onToggleTheme}
              className="app-header-action inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#1b273d] bg-[#0e1728] text-slate-300 hover:text-white transition"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={onLogout}
              className="app-header-action inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-[#1b273d] bg-[#0e1728] text-slate-300 hover:text-red-400 transition text-[10px] sm:text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        {/* Passing key={currentSite} forces a full re-mount with newly loaded site data */}
        <main key={`${currentSite}_${activePage}`} className="workspace-content flex-1 p-6 max-w-7xl w-full mx-auto min-w-0">
          {!activePage && (
            <div className="rounded-2xl border border-[#1b273d] bg-[#0b1322] p-6 text-sm text-slate-400">
              No pages have been assigned to this account. Ask an administrator to grant access.
            </div>
          )}
          {activePage === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
          {activePage === 'ongoing_site' && <OngoingSiteTransfer />}
          {activePage === 'billing' && <BillingRMC />}
          {activePage === 'total_bill' && <TotalBillPage />}
          {activePage === 'site_tests' && <AtSiteTestsPage />}
          {activePage === 'company_details' && <CompanyDetailsModule />}
          {activePage === 'transit_mixer' && <TransitMixerPage />}
          {activePage === 'concrete_pumps' && <ConcretePumpsPage />}
          {activePage === 'mix_design' && <MixDesignModule />}
          {activePage === 'site_report' && <SiteMaterialReportModule />}
          {activePage === 'material_category' && <MaterialCategory />}
          {activePage === 'trips' && <MaterialHaulageTripsModule />}
          {activePage === 'user_management' && <UserManagement />}
          
          {activePage === 'measurements' && (
            <SiteMeasurementStudio
              session={measurementSession}
              onUpdateSession={onUpdateMeasurementSession}
              onConvertToOrder={() => {}}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Sidebar;
