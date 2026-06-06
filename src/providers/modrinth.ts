import type { ProjectSummary, RevenueSummary, Summary, SummaryProvider } from "../types.js";
import type {
  ModrinthClientOptions,
  ModrinthEnv,
  ModrinthPayoutHistory,
  ModrinthProject,
  ModrinthUser,
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
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(options: ModrinthClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://api.modrinth.com/v2";
    this.userAgent = options.userAgent;
  }

  async buildSummary(input: { projectIds: string[]; token: string; now?: Date }): Promise<Summary> {
    const now = input.now ?? new Date();
    const projects = await this.fetchProjects(input.projectIds, input.token);
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
      projects = await this.request<ModrinthProject[]>(path, { token: "" });
    } catch (error) {
      if (
        token.length === 0 ||
        !(error instanceof ModrinthApiError) ||
        (error.status !== 401 && error.status !== 404)
      ) {
        throw error;
      }
      projects = await this.request<ModrinthProject[]>(path, { token });
    }

    return projects.map(mapProject);
  }

  private async fetchRevenue(token: string): Promise<RevenueSummary> {
    if (token.length === 0) {
      return emptyRevenue("Add a Modrinth PAT with PAYOUTS_READ to show revenue");
    }

    try {
      const user = await this.request<ModrinthUser>("/user", { token });
      const history = await this.request<ModrinthPayoutHistory>(
        `/user/${encodeURIComponent(user.username)}/payouts`,
        { token },
      );

      return {
        balanceUsd:
          user.payout_data?.balance === undefined || user.payout_data.balance === null
            ? null
            : String(user.payout_data.balance),
        lastMonthUsd: history.last_month ?? null,
        allTimeUsd: history.all_time ?? null,
        unavailableReason: null,
      };
    } catch (error) {
      if (error instanceof ModrinthApiError && error.status === 401) {
        return emptyRevenue("PAT needs USER_READ and PAYOUTS_READ scopes");
      }
      if (error instanceof ModrinthApiError && error.status === 404) {
        return emptyRevenue("Payout data is not available for this account");
      }
      throw error;
    }
  }

  private async request<T>(path: string, options: { token?: string }): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.userAgent,
    };
    if (options.token) {
      headers.Authorization = options.token;
    }

    const response = await fetch(`${this.baseUrl}${path}`, { headers });
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

function emptyRevenue(reason: string): RevenueSummary {
  return {
    balanceUsd: null,
    lastMonthUsd: null,
    allTimeUsd: null,
    unavailableReason: reason,
  };
}

function modrinthErrorMessage(status: number): string {
  if (status === 401) {
    return "Modrinth rejected the PAT. Either it has expired, is invalid, or is missing required scopes (USER_READ and PAYOUTS_READ)";
  }
  if (status === 404) {
    return "One or more Modrinth projects could not be found.";
  }
  if (status === 429) {
    return "Modrinth rate limit reached. Try again later.";
  }
  return "Unknown error. Is Modrinth down?";
}
