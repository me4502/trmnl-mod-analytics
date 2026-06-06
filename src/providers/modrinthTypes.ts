export type ModrinthProject = {
  id: string;
  slug: string;
  title: string;
  downloads: number;
};

export type ModrinthUser = {
  id: string;
  username: string;
  payout_data?: {
    balance?: string | number | null;
  } | null;
};

export type ModrinthPayoutHistory = {
  all_time?: string | null;
  last_month?: string | null;
};

export type ModrinthEnv = {
  MODRINTH_USER_AGENT: string;
};

export type ModrinthClientOptions = {
  userAgent: string;
  baseUrl?: string;
};
