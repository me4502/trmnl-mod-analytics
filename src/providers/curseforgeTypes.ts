export type CurseForgeMod = {
  id: number;
  name: string;
  slug?: string | null;
  downloadCount: number;
};

export type CurseForgeModsResponse = {
  data: CurseForgeMod[];
};

export type CurseForgeClientOptions = {
  apiBaseUrl?: string;
};
