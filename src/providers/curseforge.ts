import { sortProjectsByDownloads } from "../types.js";
import type { ProjectSummary, RevenueSummary, Summary, SummaryProvider } from "../types.js";
import type {
  CurseForgeClientOptions,
  CurseForgeMod,
  CurseForgeModsResponse,
} from "./curseforgeTypes.js";

class CurseForgeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class CurseForgeProvider {
  private readonly apiBaseUrl: string;

  constructor(options: CurseForgeClientOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.curseforge.com/v1";
  }

  async buildSummary(input: { projectIds: string[]; token: string; now?: Date }): Promise<Summary> {
    const now = input.now ?? new Date();
    const projects = sortProjectsByDownloads(
      await this.fetchProjects(input.projectIds, input.token),
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
      throw new CurseForgeApiError("Missing CurseForge API key", 401);
    }

    const modIds = projectIds.map((projectId) => Number(projectId));
    if (modIds.some((projectId) => !Number.isSafeInteger(projectId) || projectId <= 0)) {
      throw new CurseForgeApiError("CurseForge project IDs must be positive numeric mod IDs", 400);
    }

    const response = await this.request<CurseForgeModsResponse>("/mods", {
      apiKey,
      body: { modIds },
    });

    const projectsById = new Map(response.data.map((project) => [project.id, project]));
    if (modIds.some((projectId) => !projectsById.has(projectId))) {
      throw new CurseForgeApiError("One or more CurseForge projects could not be found", 404);
    }

    return modIds.map((projectId) => {
      const project = projectsById.get(projectId);
      if (!project) {
        throw new CurseForgeApiError("One or more CurseForge projects could not be found", 404);
      }
      return mapProject(project);
    });
  }

  private async request<T>(path: string, options: { apiKey: string; body: unknown }): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": options.apiKey,
      },
      body: JSON.stringify(options.body),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new CurseForgeApiError(
        `CurseForge API request failed: ${response.status} ${message}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }
}

export function createCurseForgeSummaryProvider(): SummaryProvider {
  const curseForge = new CurseForgeProvider();

  return {
    key: "curseforge",
    label: "CurseForge",
    maxProjects: 50,
    buildSummary: (input) => curseForge.buildSummary(input),
    getUpstreamErrorMessage: (error) =>
      error instanceof CurseForgeApiError ? curseForgeErrorMessage(error.status) : null,
  };
}

function mapProject(project: CurseForgeMod): ProjectSummary {
  return {
    id: String(project.id),
    slug: project.slug ?? String(project.id),
    title: project.name,
    downloads: project.downloadCount,
  };
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

function curseForgeErrorMessage(status: number): string {
  if (status === 400) {
    return "CurseForge project IDs must be positive numeric mod IDs.";
  }
  if (status === 401 || status === 403) {
    return "Add a valid CurseForge API key to show CurseForge downloads.";
  }
  if (status === 404) {
    return "One or more CurseForge projects could not be found.";
  }
  if (status === 429) {
    return "CurseForge rate limit reached. Try again later or use a different API key.";
  }
  return "Unknown error. Is CurseForge down?";
}
