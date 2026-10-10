export const PAGE_ACCESS_OPTIONS = [
  {
    section: 'Site Operations',
    pages: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'ongoing_site', label: 'Ongoing Site' },
      { id: 'billing', label: 'Billing' },
      { id: 'total_bill', label: 'Total Bill of Site' },
      { id: 'site_tests', label: 'At-Site Tests' },
      { id: 'trips', label: 'Trips' }
    ]
  },
  {
    section: 'Engineering',
    pages: [
      { id: 'material_category', label: 'Category of Material' },
      { id: 'transit_mixer', label: 'Transit Mixer' },
      { id: 'concrete_pumps', label: 'Concrete Pumps' },
      { id: 'mix_design', label: 'Mix Design' },
      { id: 'site_report', label: 'Report / Material Used' },
      { id: 'measurements', label: 'Site Inventory Measurements' }
    ]
  },
  {
    section: 'Configuration',
    pages: [
      { id: 'company_details', label: 'Company Details' }
    ]
  }
] as const;

export type AppPageId = typeof PAGE_ACCESS_OPTIONS[number]['pages'][number]['id'];

export interface SessionUser {
  username: string;
  role: string;
  name?: string;
  pageAccess?: string[] | null;
}

export const isAdminUser = (user?: Partial<SessionUser> | null): boolean => {
  const role = String(user?.role || '').toUpperCase();
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
};

export const getSessionUser = (): SessionUser | null => {
  try {
    const savedUser = sessionStorage.getItem('concrete360_user');
    return savedUser ? JSON.parse(savedUser) as SessionUser : null;
  } catch {
    return null;
  }
};

export const canViewPage = (user: SessionUser | null | undefined, pageId: string): boolean => {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  // Existing accounts without a saved page list retain their previous access.
  if (!Array.isArray(user.pageAccess)) return pageId !== 'user_management';
  return user.pageAccess.includes(pageId);
};

export const canCreateRecords = (user: SessionUser | null | undefined): boolean => {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'EMPLOYEE';
};
