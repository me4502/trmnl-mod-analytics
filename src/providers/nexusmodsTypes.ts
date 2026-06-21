export type NexusModsMod = {
  mod_id: number;
  name: string;
  mod_downloads: number;
};

export type NexusModsProjectIdentifier = {
  raw: string;
  gameDomain: string;
  modId: number;
};

export type NexusModsClientOptions = {
  apiOrigin?: string;
};
