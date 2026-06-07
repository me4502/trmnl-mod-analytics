export type ProjectSummary = {
  id: string;
  slug: string;
  title: string;
  downloads: number;
};

export type RevenueSummary = {
  requested: boolean;
  balanceUsd: number | null;
  lastMonthUsd: number | null;
  allTimeUsd: number | null;
  unavailableReason: string | null;
};

export type Summary = {
  ok: true;
  providerName?: string;
  projects: ProjectSummary[];
  totals: {
    downloads: number;
    projects: number;
  };
  revenue: RevenueSummary;
  generatedAt: string;
};

export type SummaryProvider = {
  key: string;
  label: string;
  maxProjects: number;
  buildSummary: (input: { projectIds: string[]; token: string }) => Promise<Summary>;
  getUpstreamErrorMessage: (error: unknown) => string | null;
};
