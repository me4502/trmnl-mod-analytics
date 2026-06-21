export type ThunderstorePackageMetrics = {
  downloads: number;
  rating_score: number;
  latest_version: string;
};

export type ThunderstorePackageIdentifier = {
  raw: string;
  community: string;
  owner: string;
  name: string;
};

export type ThunderstoreClientOptions = {
  apiOrigin?: string;
};
