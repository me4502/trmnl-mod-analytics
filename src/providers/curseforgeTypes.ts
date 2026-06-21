export type CurseForgeMod = {
  id: number;
  name: string;
  slug?: string | null;
  downloadCount: number;
};

export type CurseForgeModsResponse = {
  data: CurseForgeMod[];
};

export type CurseForgeEnv = {
  CURSEFORGE_API_KEY?: string;
};

export type CurseForgeClientOptions = {
  apiBaseUrl?: string;
  apiKey?: string;
};
