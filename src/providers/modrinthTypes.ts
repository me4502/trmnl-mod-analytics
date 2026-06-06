export type ModrinthProject = {
  id: string;
  slug: string;
  title: string;
  downloads: number;
};

export type ModrinthPayoutBalance = {
  available: string | number;
  withdrawn_lifetime: string | number;
  withdrawn_ytd: string | number;
  pending: string | number;
  dates: Record<string, string | number>;
  requested_form_type?: string | null;
  form_completion_status?: string | null;
};

export type ModrinthEnv = {
  MODRINTH_USER_AGENT: string;
};

export type ModrinthClientOptions = {
  userAgent: string;
  apiOrigin?: string;
};
