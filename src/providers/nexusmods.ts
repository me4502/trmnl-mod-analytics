import { sortProjectsByDownloads } from "../types.js";
import type { ProjectSummary, RevenueSummary, Summary, SummaryProvider } from "../types.js";
import type {
  NexusModsClientOptions,
  NexusModsMod,
  NexusModsProjectIdentifier,
} from "./nexusmodsTypes.js";

class NexusModsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class NexusModsProvider {
  private readonly apiOrigin: string;

  constructor(options: NexusModsClientOptions = {}) {
    this.apiOrigin = options.apiOrigin ?? "https://api.nexusmods.com/v1";
  }

  async buildSummary(input: { projectIds: string[]; token: string; now?: Date }): Promise<Summary> {
    const now = input.now ?? new Date();
    const projects = sortProjectsByDownloads(
      await this.fetchProjects(input.projectIds, input.token.trim()),
    );
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

  private async fetchProjects(projectIds: string[], apiKey: string): Promise<ProjectSummary[]> {
    if (apiKey.length === 0) {
      throw new NexusModsApiError("Missing Nexus Mods API key", 0);
    }

    const identifiers = projectIds.map(parseProjectIdentifier);
    return Promise.all(
      identifiers.map(async (identifier) => {
        const mod = await this.fetchMod(identifier, apiKey);
        return mapProject(identifier, mod);
      }),
    );
  }

  private async fetchMod(
    identifier: NexusModsProjectIdentifier,
    apiKey: string,
  ): Promise<NexusModsMod> {
    return this.request<NexusModsMod>(
      `/games/${encodeURIComponent(identifier.gameDomain)}/mods/${identifier.modId}.json`,
      apiKey,
    );
  }

  private async request<T>(path: string, apiKey: string): Promise<T> {
    const response = await fetch(`${this.apiOrigin}${path}`, {
      headers: {
        Accept: "application/json",
        apikey: apiKey,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new NexusModsApiError(
        `Nexus Mods API request failed: ${response.status} ${message}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }
}

export function createNexusModsSummaryProvider(): SummaryProvider {
  const nexusMods = new NexusModsProvider();

  return {
    key: "nexusmods",
    label: "Nexus Mods",
    maxProjects: 50,
    buildSummary: (input) => nexusMods.buildSummary(input),
    getUpstreamErrorMessage: (error) =>
      error instanceof NexusModsApiError ? nexusModsErrorMessage(error.status) : null,
  };
}

function parseProjectIdentifier(projectId: string): NexusModsProjectIdentifier {
  const parts = projectId.split("/").map((part) => part.trim());
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    throw new NexusModsApiError("Nexus Mods projects must use game_domain/mod_id", 400);
  }

  const modId = Number(parts[1]);
  if (!Number.isSafeInteger(modId) || modId <= 0) {
    throw new NexusModsApiError("Nexus Mods mod IDs must be positive numeric IDs", 400);
  }

  return {
    raw: projectId,
    gameDomain: parts[0],
    modId,
  };
}

function mapProject(identifier: NexusModsProjectIdentifier, mod: NexusModsMod): ProjectSummary {
  return {
    id: identifier.raw,
    slug: `${identifier.gameDomain}/${mod.mod_id}`,
    title: mod.name,
    downloads: getTotalDownloads(mod),
  };
}

function getTotalDownloads(mod: NexusModsMod): number {
  const downloads = mod.mod_downloads;
  if (typeof downloads !== "number" || !Number.isFinite(downloads)) {
    throw new NexusModsApiError("Nexus Mods response did not include a download count.", 502);
  }

  return downloads;
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

function nexusModsErrorMessage(status: number): string {
  if (status === 0) {
    return "Add a Nexus Mods API key to show Nexus Mods downloads.";
  }
  if (status === 400) {
    return "Nexus Mods projects must use game_domain/mod_id, for example skyrimspecialedition/2347.";
  }
  if (status === 401 || status === 403) {
    return "Nexus Mods rejected the API key.";
  }
  if (status === 404) {
    return "One or more Nexus Mods projects could not be found.";
  }
  if (status === 429) {
    return "Nexus Mods rate limit reached. Try again later.";
  }
  if (status === 502) {
    return "Nexus Mods did not return download counts for one or more projects.";
  }
  return "Unknown error. Is Nexus Mods down?";
}
