import { parseProjectIds } from "./projectIds.js";
import { createSummaryProvider, type ProviderEnv } from "./providers/index.js";
import type { SummaryProvider } from "./types.js";

export type Env = ProviderEnv;

const PROJECT_IDS_PARAM = "project_ids";
// This is data that updates very rarely, every hour for updates should be fine.
const API_CACHE_TTL_SECONDS = 60 * 60;
const API_CACHE_NAME = "trmnl-mod-analytics-summary";

const SUMMARY_ROUTE_MATCHER = /^\/api\/([^/]+)\/summary$/;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(),
          ...nonCacheableApiHeaders(),
        },
      });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);

      const summaryRoute = url.pathname.match(SUMMARY_ROUTE_MATCHER);
      if (summaryRoute) {
        const provider = createSummaryProvider(summaryRoute[1], env);
        if (!provider) {
          return jsonResponse(
            {
              ok: false,
              error: `Unsupported provider: ${summaryRoute[1]}`,
              generatedAt: new Date().toISOString(),
            },
            404,
          );
        }

        return handleSummary(request, url, provider, ctx);
      }
    }

    return jsonResponse(
      {
        ok: false,
        error: "Not found.",
        generatedAt: new Date().toISOString(),
      },
      404,
    );
  },
} satisfies ExportedHandler<Env>;

async function handleSummary(
  request: Request,
  url: URL,
  provider: SummaryProvider,
  ctx: ExecutionContext,
): Promise<Response> {
  let projectIds: string[];
  try {
    projectIds = parseProjectIds(url.searchParams.getAll(PROJECT_IDS_PARAM));
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: `${provider.label} project IDs must be comma-separated or a JSON array of strings.`,
        generatedAt: new Date().toISOString(),
      },
      400,
    );
  }

  if (projectIds.length === 0) {
    return jsonResponse(
      {
        ok: false,
        error: `Add at least one ${provider.label} project slug or ID.`,
        generatedAt: new Date().toISOString(),
      },
      400,
    );
  }
  if (projectIds.length > provider.maxProjects) {
    return jsonResponse(
      {
        ok: false,
        error: `Limit each Recipe instance to ${provider.maxProjects} ${provider.label} projects.`,
        generatedAt: new Date().toISOString(),
      },
      400,
    );
  }

  const token = request.headers.get("authorization")?.trim() ?? "";
  const cacheKey = token.length === 0 ? summaryCacheKey(request, provider, projectIds) : null;

  if (cacheKey) {
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  try {
    const summary = await provider.buildSummary({
      projectIds,
      token,
    });

    const response = jsonResponse(
      {
        ...summary,
        providerName: provider.label,
      },
      200,
      cacheKey ? cacheableApiHeaders() : nonCacheableApiHeaders(),
    );

    if (cacheKey) {
      ctx.waitUntil(putApiCache(cacheKey, response.clone()));
    }

    return response;
  } catch (error) {
    const upstreamError = provider.getUpstreamErrorMessage(error);
    if (upstreamError) {
      return jsonResponse(
        {
          ok: false,
          providerName: provider.label,
          error: upstreamError,
          generatedAt: new Date().toISOString(),
        },
        200,
        nonCacheableApiHeaders(),
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(
      {
        ok: false,
        providerName: provider.label,
        error: message,
        generatedAt: new Date().toISOString(),
      },
      500,
      nonCacheableApiHeaders(),
    );
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = nonCacheableApiHeaders(),
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...headers,
    },
  });
}

function summaryCacheKey(
  request: Request,
  provider: SummaryProvider,
  projectIds: string[],
): Request {
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = `/api/${provider.key}/summary`;
  cacheUrl.search = "";
  cacheUrl.searchParams.set(PROJECT_IDS_PARAM, JSON.stringify(projectIds));

  return new Request(cacheUrl.toString(), { method: "GET" });
}

function cacheableApiHeaders(): Record<string, string> {
  return {
    "cache-control": `public, max-age=${API_CACHE_TTL_SECONDS}, s-maxage=${API_CACHE_TTL_SECONDS}`,
    vary: "authorization",
  };
}

function nonCacheableApiHeaders(): Record<string, string> {
  return {
    "cache-control": "no-store",
    vary: "authorization",
  };
}

async function putApiCache(cacheKey: Request, response: Response): Promise<void> {
  const cache = await caches.open(API_CACHE_NAME);
  await cache.put(cacheKey, response);
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
  };
}
