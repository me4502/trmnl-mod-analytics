import { sortProjectsByDownloads } from "../types.js";
import type { ProjectSummary, RevenueSummary, Summary, SummaryProvider } from "../types.js";
import type {
  ModrinthClientOptions,
  ModrinthEnv,
  ModrinthPayoutBalance,
  ModrinthProject,
} from "./modrinthTypes.js";

class ModrinthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class ModrinthProvider {
  private readonly apiOrigin: string;
  private readonly userAgent: string;

  constructor(options: ModrinthClientOptions) {
    this.apiOrigin = options.apiOrigin ?? "https://api.modrinth.com";
    this.userAgent = options.userAgent;
  }

  async buildSummary(input: { projectIds: string[]; token: string; now?: Date }): Promise<Summary> {
    const now = input.now ?? new Date();
    const projects = sortProjectsByDownloads(
      await this.fetchProjects(input.projectIds, input.token),
    );
    const totalDownloads = projects.reduce((total, project) => total + project.downloads, 0);

    const revenue = await this.fetchRevenue(input.token);

    return {
      ok: true,
      projects,
      totals: {
        downloads: totalDownloads,
        projects: projects.length,
      },
      revenue,
      generatedAt: now.toISOString(),
    };
  }

  private async fetchProjects(projectIds: string[], token: string): Promise<ProjectSummary[]> {
    if (projectIds.length === 0) {
      return [];
    }

    const ids = encodeURIComponent(JSON.stringify(projectIds));
    const path = `/projects?ids=${ids}`;
    let projects: ModrinthProject[];
    try {
      projects = await this.requestV2<ModrinthProject[]>(path, { token: "" });
    } catch (error) {
      if (
        token.length === 0 ||
        !(error instanceof ModrinthApiError) ||
        (error.status !== 401 && error.status !== 404)
      ) {
        throw error;
      }
      projects = await this.requestV2<ModrinthProject[]>(path, { token });
    }

    return projects.map(mapProject);
  }

  private async fetchRevenue(token: string): Promise<RevenueSummary> {
    if (token.length === 0) {
      return emptyRevenue(false, "Add a Modrinth PAT with PAYOUTS_READ to show revenue");
    }

    try {
      const balance = await this.requestV3<ModrinthPayoutBalance>("/payout/balance", { token });

      return {
        requested: true,
        balanceUsd: Number(balance.available),
        lastMonthUsd: sumPreviousMonth(balance.dates),
        allTimeUsd: sumValues(balance.dates),
        unavailableReason: null,
      };
    } catch (error) {
      if (error instanceof ModrinthApiError && error.status === 401) {
        return emptyRevenue(true, "PAT needs PAYOUTS_READ scope");
      }
      if (error instanceof ModrinthApiError && error.status === 404) {
        return emptyRevenue(true, "Payout data is not available for this account");
      }
      throw error;
    }
  }

  private async requestV2<T>(path: string, options: { token?: string }): Promise<T> {
    return this.requestVersion<T>("v2", path, options);
  }

  private async requestV3<T>(path: string, options: { token?: string }): Promise<T> {
    return this.requestVersion<T>("v3", path, options);
  }

  private async requestVersion<T>(
    version: "v2" | "v3",
    path: string,
    options: { token?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.userAgent,
    };
    if (options.token) {
      headers.Authorization = options.token;
    }

    const response = await fetch(`${this.apiOrigin}/${version}${path}`, { headers });
    if (!response.ok) {
      const message = await response.text();
      throw new ModrinthApiError(
        `Modrinth API request failed: ${response.status} ${message}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }
}

export function createModrinthSummaryProvider(env: ModrinthEnv): SummaryProvider {
  const modrinth = new ModrinthProvider({
    userAgent: env.MODRINTH_USER_AGENT,
  });

  return {
    key: "modrinth",
    label: "Modrinth",
    maxProjects: 50,
    buildSummary: (input) => modrinth.buildSummary(input),
    getUpstreamErrorMessage: (error) =>
      error instanceof ModrinthApiError ? modrinthErrorMessage(error.status) : null,
  };
}

function mapProject(project: ModrinthProject): ProjectSummary {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    downloads: project.downloads,
  };
}

function emptyRevenue(requested: boolean, reason: string): RevenueSummary {
  return {
    requested,
    balanceUsd: null,
    lastMonthUsd: null,
    allTimeUsd: null,
    unavailableReason: reason,
  };
}

function sumPreviousMonth(dates: Record<string, string | number>): number {
  const now = new Date();
  const previousMonth = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
  const previousMonthYear =
    now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();

  return Object.entries(dates).reduce<number>((total, [date, value]) => {
    const parsedDate = new Date(date);
    if (
      parsedDate.getUTCFullYear() !== previousMonthYear ||
      parsedDate.getUTCMonth() !== previousMonth
    ) {
      return total;
    }
    return total + Number(value);
  }, 0);
}

function sumValues(values: Record<string, string | number>): number {
  return Object.values(values).reduce<number>((total, value) => total + Number(value), 0);
}

function modrinthErrorMessage(status: number): string {
  if (status === 401) {
    return "Modrinth rejected the PAT. Either it has expired, is invalid, or is missing required scopes (PAYOUTS_READ)";
  }
  if (status === 404) {
    return "One or more Modrinth projects could not be found.";
  }
  if (status === 429) {
    return "Modrinth rate limit reached. Try again later.";
  }
  return "Unknown error. Is Modrinth down?";
}
