import { sortProjectsByDownloads } from "../types.js";
import type { ProjectSummary, RevenueSummary, Summary, SummaryProvider } from "../types.js";
import type {
  ThunderstoreClientOptions,
  ThunderstorePackageIdentifier,
  ThunderstorePackageMetrics,
} from "./thunderstoreTypes.js";

class ThunderstoreApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class ThunderstoreProvider {
  private readonly apiOrigin: string;

  constructor(options: ThunderstoreClientOptions = {}) {
    this.apiOrigin = options.apiOrigin ?? "https://thunderstore.io";
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
    const identifiers = projectIds.map(parsePackageIdentifier);

    return Promise.all(
      identifiers.map(async (identifier) => {
        const metrics = await this.fetchPackageMetrics(identifier);
        return mapProject(identifier, metrics);
      }),
    );
  }

  private async fetchPackageMetrics(
    identifier: ThunderstorePackageIdentifier,
  ): Promise<ThunderstorePackageMetrics> {
    return this.request<ThunderstorePackageMetrics>(
      `/api/v1/package-metrics/${encodeURIComponent(identifier.owner)}/${encodeURIComponent(identifier.name)}/`,
    );
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.apiOrigin}${path}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new ThunderstoreApiError(
        `Thunderstore API request failed: ${response.status} ${message}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }
}

export function createThunderstoreSummaryProvider(): SummaryProvider {
  const thunderstore = new ThunderstoreProvider();

  return {
    key: "thunderstore",
    label: "Thunderstore",
    maxProjects: 50,
    buildSummary: (input) => thunderstore.buildSummary(input),
    getUpstreamErrorMessage: (error) =>
      error instanceof ThunderstoreApiError ? thunderstoreErrorMessage(error.status) : null,
  };
}

function parsePackageIdentifier(projectId: string): ThunderstorePackageIdentifier {
  const parts = projectId.split("/").map((part) => part.trim());
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new ThunderstoreApiError("Thunderstore packages must use community/owner/package", 400);
  }

  return {
    raw: projectId,
    community: parts[0],
    owner: parts[1],
    name: parts[2],
  };
}

function mapProject(
  identifier: ThunderstorePackageIdentifier,
  metrics: ThunderstorePackageMetrics,
): ProjectSummary {
  return {
    id: identifier.raw,
    slug: `${identifier.community}/${identifier.owner}/${identifier.name}`,
    title: identifier.name,
    downloads: metrics.downloads,
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

function thunderstoreErrorMessage(status: number): string {
  if (status === 400) {
    return "Thunderstore packages must use community/owner/package, for example lethal-company/ebkr/r2modman.";
  }
  if (status === 404) {
    return "One or more Thunderstore packages could not be found.";
  }
  if (status === 429) {
    return "Thunderstore rate limit reached. Try again later.";
  }
  return "Unknown error. Is Thunderstore down?";
}
