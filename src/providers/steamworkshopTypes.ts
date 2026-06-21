export type SteamWorkshopPublishedFile = {
  publishedfileid: string;
  result: number;
  title?: string;
  lifetime_subscriptions?: number;
};

export type SteamWorkshopPublishedFileDetailsResponse = {
  response: {
    result: number;
    publishedfiledetails?: SteamWorkshopPublishedFile[];
  };
};

export type SteamWorkshopPublishedFileIdentifier = {
  raw: string;
};

export type SteamWorkshopClientOptions = {
  apiOrigin?: string;
};
