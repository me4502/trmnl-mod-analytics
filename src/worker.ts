import indexHtml from "./index.html";
import { parseProjectIds } from "./projectIds.js";
import { createSummaryProvider, type ProviderEnv } from "./providers/index.js";
import type { SummaryProvider } from "./types.js";

export type Env = ProviderEnv;

const PROJECT_IDS_PARAM = "project_ids";

const SUMMARY_ROUTE_MATCHER = /^\/api\/([^/]+)\/summary$/;

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);

      if (url.pathname === "/") {
        return htmlResponse(indexHtml);
      }

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

        return handleSummary(request, url, provider);
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
  try {
    const summary = await provider.buildSummary({
      projectIds,
      token,
    });

    return jsonResponse({
      ...summary,
      providerName: provider.label,
    });
  } catch (error) {
    const upstreamError = provider.getUpstreamErrorMessage(error);
    if (upstreamError) {
      return jsonResponse({
        ok: false,
        providerName: provider.label,
        error: upstreamError,
        generatedAt: new Date().toISOString(),
      });
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
    );
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function htmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
  };
}
