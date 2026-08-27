export type TransactionRow = {
  id: number;
  paymentDate: string;
  month: string;
  invoice: string;
  gradeId: number | null;
  productId: number | null;
  agentId: number | null;
  branchDestinationId: number | null;
  branchId: number | null;
  isNewTxn: boolean;
  isFullPayment: boolean;
  academicYear: string;
  revenue: number;
  npsn: string | null;
  isBulkBuying: boolean;
};

export type SummaryPoint = {
  name: string;
  revenue: number;
  transactions: number;
};

export type RevenueSourcePoint = SummaryPoint & {
  nonBulkRevenue: number;
  bulkRevenue: number;
  nonBulkTransactions: number;
  bulkTransactions: number;
};

export type BranchRevenuePerformancePoint = {
  name: string;
  revenue: number;
  target: number;
};

export type MonthlyPoint = SummaryPoint & {
  period: string;
};

export type MonthlyComparisonPoint = {
  month: string;
  currentRevenue: number;
  currentCumulativeRevenue: number;
  currentTransactions: number;
  previousRevenue: number | null;
  previousCumulativeRevenue: number | null;
  previousTransactions: number | null;
  lastTwoYearsRevenue: number | null;
  lastTwoYearsCumulativeRevenue: number | null;
  targetRevenue: number | null;
  targetCumulativeRevenue: number | null;
};

export type DashboardFilters = {
  academicYear?: string;
  regionId?: number;
  branchId?: number;
  month?: string;
  fromDate?: string;
  toDate?: string;
};

export type FilterOption = {
  id: string;
  label: string;
};

export type BranchFilterOption = FilterOption & {
  regionId: string;
};

export type RecentTransaction = {
  id: number;
  paymentDate: string;
  invoice: string;
  product: string;
  branch: string;
  revenue: number;
  flags: string[];
};

export type AgentPerformance = {
  agent: string;
  branch: string;
  schools: number;
  revenueNonBulkBuying: number;
  revenueNewTxnNonBulkBuying: number;
  newTxnNonBulkBuying: number;
  transactionsNonBulkBuying: number;
};

export type DashboardData = {
  filters: {
    academicYears: FilterOption[];
    regions: FilterOption[];
    branches: BranchFilterOption[];
    months: FilterOption[];
  };
  kpis: {
    totalRevenue: number;
    totalTransactions: number;
    uniqueInvoices: number;
    activeBranches: number;
    activeAgents: number;
    knownSchools: number;
    averageOrderValue: number;
    nonBulkRevenue: number;
    nonBulkNewTransactions: number;
    targetAnnualRevenue: number;
    achievement: number | null;
    varianceToTarget: number;
    growthVsLy: number | null;
    growthVsL2y: number | null;
  };
  monthlyRevenue: MonthlyPoint[];
  monthlyRevenueComparison: {
    currentAcademicYear: string | null;
    previousAcademicYear: string | null;
    rows: MonthlyComparisonPoint[];
  };
  regionalRevenue: SummaryPoint[];
  regionalRevenueSource: RevenueSourcePoint[];
  branchRevenue: SummaryPoint[];
  branchRevenuePerformance: BranchRevenuePerformancePoint[];
  productRevenue: SummaryPoint[];
  productRevenueRetail: SummaryPoint[];
  paymentCategoryRevenue: SummaryPoint[];
  levelRevenue: SummaryPoint[];
  dataQuality: SummaryPoint[];
  recentTransactions: RecentTransaction[];
  agentPerformance: AgentPerformance[];
};
