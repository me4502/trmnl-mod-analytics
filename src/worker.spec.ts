import { beforeEach, describe, expect, it, vi } from "vitest";

import worker, { type Env } from "./worker.js";

const env: Env = {
  CURSEFORGE_API_KEY: "curseforge-key",
  MODRINTH_USER_AGENT: "test/trmnl-mod-analytics",
};

describe("worker API caching", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", createModrinthFetchMock());
  });

  it("marks successful anonymous summary responses as cacheable", async () => {
    const response = await worker.fetch(
      incomingRequest(
        "https://example.com/api/modrinth/summary?ignored=true&project_ids=worldedit,worldedit",
      ),
      env,
    );

    expect(response.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      projects: [{ id: "worldedit" }],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not cache requests with authorization headers", async () => {
    const response = await worker.fetch(
      incomingRequest("https://example.com/api/modrinth/summary?project_ids=worldedit", {
        headers: {
          authorization: "Bearer token",
        },
      }),
      env,
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      revenue: {
        requested: true,
      },
    });
  });
});

function incomingRequest(
  input: string,
  init?: RequestInit,
): Request<unknown, IncomingRequestCfProperties<unknown>> {
  return new Request(input, init) as Request<unknown, IncomingRequestCfProperties<unknown>>;
}

function cacheKeyUrl(request: RequestInfo | URL): string {
  if (typeof request === "string") {
    return request;
  }
  if (request instanceof URL) {
    return request.toString();
  }
  return request.url;
}

function createModrinthFetchMock() {
  return vi.fn<typeof fetch>(async (input) => {
    const url = cacheKeyUrl(input);
    if (url.startsWith("https://api.modrinth.com/v2/projects")) {
      return Response.json([
        {
          id: "worldedit",
          slug: "worldedit",
          title: "WorldEdit",
          downloads: 1000,
        },
      ]);
    }

    if (url === "https://api.modrinth.com/v3/payout/balance") {
      return Response.json({
        available: "12.34",
        dates: {
          "2026-05-01": "1.23",
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}
