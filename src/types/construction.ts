export interface ConstructionSite {
  id: string;
  name: string; // e.g. "MULWAD", "FATIMA COMPLEX"
  code: string; // e.g. "site-1789399407383"
  clientName: string;
  location: string;
  assignedUnits: number;
  status: 'active' | 'completed' | 'on_hold';
  totalBudgetINR: number;
  totalSpentINR: number;
  totalBilledINR: number;
  holdingValueINR: number;
  lowStockAlertsCount: number;
  registeredProductsCount: number;
  transfersCount: number;
}

export interface InventoryMaterialProduct {
  id: string;
  siteId: string;
  name: string; // e.g. "OPC 53 Cement", "10mm Aggregate", "M-Sand", "Ready-Mix M30 Grade", "Steel TMT Fe550"
  category: 'Cement & Binder' | 'Aggregates & Sand' | 'Ready-Mix Concrete' | 'Chemical Admixtures' | 'Reinforcement Steel' | 'Formwork & Tools';
  currentStock: number;
  unit: 'Bags' | 'Metric Tons (MT)' | 'm³' | 'Liters' | 'Kg';
  reorderLevel: number;
  unitPriceINR: number;
  totalValueINR: number;
  storageLocation: string; // e.g. "Silo 1", "Main Yard Embankment", "Chemical Bay"
  status: 'In Stock' | 'Low Stock' | 'Critical';
  lastUpdated: string;
}

export interface MaterialTransactionVoucher {
  id: string;
  voucherNumber: string; // e.g. "TRX-2026-8801"
  siteId: string;
  type: 'Stock In' | 'Stock Out' | 'Inter-Site Transfer' | 'Consumption / Pouring';
  date: string;
  time: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPriceINR: number;
  totalAmountINR: number;
  supplierOrParty: string; // e.g. "UltraTech Depot", "Batch Plant 01", "Fatima Complex Site"
  vehicleNumber?: string;
  gatePassNumber?: string;
  authorizedBy: string;
  remarks: string;
}

export interface SiteAttendanceEmployee {
  id: string;
  siteId: string;
  empCode: string;
  name: string;
  role: 'Site Supervisor' | 'Batch Operator' | 'Mixer Driver' | 'Pump Operator' | 'Quality Lab Tech' | 'Foreman';
  dailyWageINR: number;
  monthlySalaryINR: number;
  daysPresentThisMonth: number;
  overtimeHours: number;
  earnedSalaryINR: number;
  status: 'Present Today' | 'On Leave' | 'Field Duty';
  phone: string;
}
