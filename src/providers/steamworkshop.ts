import { sortProjectsByDownloads } from "../types.js";
import type { ProjectSummary, RevenueSummary, Summary, SummaryProvider } from "../types.js";
import type {
  SteamWorkshopClientOptions,
  SteamWorkshopPublishedFile,
  SteamWorkshopPublishedFileDetailsResponse,
  SteamWorkshopPublishedFileIdentifier,
} from "./steamworkshopTypes.js";

class SteamWorkshopApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class SteamWorkshopProvider {
  private readonly apiOrigin: string;

  constructor(options: SteamWorkshopClientOptions = {}) {
    this.apiOrigin = options.apiOrigin ?? "https://api.steampowered.com";
  }

  async buildSummary(input: { projectIds: string[]; now?: Date }): Promise<Summary> {
    const now = input.now ?? new Date();
    const projects = sortProjectsByDownloads(await this.fetchProjects(input.projectIds));
    const totalDownloads = projects.reduce((total, project) => total + project.downloads, 0);

    return {
      ok: true,
      projects,
      totals: {
        downloads: totalDownloads,
        projects: projects.length,
      },
      revenue: emptyRevenue(),
      generatedAt: now.toISOString(),
    };
  }

  private async fetchProjects(projectIds: string[]): Promise<ProjectSummary[]> {
    const identifiers = projectIds.map(parsePublishedFileIdentifier);
    const details = await this.fetchPublishedFileDetails(identifiers);
    const detailsById = new Map(details.map((detail) => [detail.publishedfileid, detail]));

    return identifiers.map((identifier) => {
      const detail = detailsById.get(identifier.raw);
      if (!detail || detail.result !== 1) {
        throw new SteamWorkshopApiError("Steam Workshop published file was not found.", 404);
      }

      return mapProject(identifier, detail);
    });
  }

  private async fetchPublishedFileDetails(
    identifiers: SteamWorkshopPublishedFileIdentifier[],
  ): Promise<SteamWorkshopPublishedFile[]> {
    const body = new URLSearchParams();
    body.set("itemcount", identifiers.length.toString());
    identifiers.forEach((identifier, index) => {
      body.set(`publishedfileids[${index}]`, identifier.raw);
    });

    const response = await fetch(
      `${this.apiOrigin}/ISteamRemoteStorage/GetPublishedFileDetails/v1/`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body,
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new SteamWorkshopApiError(
        `Steam Workshop API request failed: ${response.status} ${message}`,
        response.status,
      );
    }

    const data = (await response.json()) as SteamWorkshopPublishedFileDetailsResponse;
    if (data.response.result !== 1 || !Array.isArray(data.response.publishedfiledetails)) {
      throw new SteamWorkshopApiError("Steam Workshop API returned an invalid response.", 502);
    }

    return data.response.publishedfiledetails;
  }
}

export function createSteamWorkshopSummaryProvider(): SummaryProvider {
  const steamWorkshop = new SteamWorkshopProvider();

  return {
    key: "steamworkshop",
    label: "Steam Workshop",
    maxProjects: 50,
    buildSummary: (input) => steamWorkshop.buildSummary(input),
    getUpstreamErrorMessage: (error) =>
      error instanceof SteamWorkshopApiError ? steamWorkshopErrorMessage(error.status) : null,
  };
}

function parsePublishedFileIdentifier(projectId: string): SteamWorkshopPublishedFileIdentifier {
  const publishedFileId = projectId.trim();
  if (!/^[1-9]\d*$/.test(publishedFileId)) {
    throw new SteamWorkshopApiError("Steam Workshop IDs must be numeric published file IDs", 400);
  }

  return {
    raw: publishedFileId,
  };
}

function mapProject(
  identifier: SteamWorkshopPublishedFileIdentifier,
  detail: SteamWorkshopPublishedFile,
): ProjectSummary {
  return {
    id: identifier.raw,
    slug: detail.publishedfileid,
    title: detail.title ?? detail.publishedfileid,
    downloads: getLifetimeSubscriptions(detail),
  };
}

function getLifetimeSubscriptions(detail: SteamWorkshopPublishedFile): number {
  const subscriptions = detail.lifetime_subscriptions;
  if (typeof subscriptions !== "number" || !Number.isFinite(subscriptions)) {
    throw new SteamWorkshopApiError(
      "Steam Workshop response did not include lifetime subscriptions.",
      502,
    );
  }

  return subscriptions;
}

function emptyRevenue(): RevenueSummary {
  return {
    requested: false,
    balanceUsd: null,
    lastMonthUsd: null,
    allTimeUsd: null,
    unavailableReason: null,
  };
}

function steamWorkshopErrorMessage(status: number): string {
  if (status === 400) {
    return "Steam Workshop projects must use numeric published file IDs, for example 2009463077.";
  }
  if (status === 404) {
    return "One or more Steam Workshop items could not be found.";
  }
  if (status === 429) {
    return "Steam Workshop rate limit reached. Try again later.";
  }
  if (status === 502) {
    return "Steam Workshop did not return lifetime subscriptions for one or more projects.";
  }
  return "Unknown error. Is Steam Workshop down?";
}
