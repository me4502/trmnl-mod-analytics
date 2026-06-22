import { beforeEach, describe, expect, it, vi } from "vitest";

import worker, { type Env } from "./worker.js";

let cache: Cache;

const env: Env = {
  CURSEFORGE_API_KEY: "curseforge-key",
  MODRINTH_USER_AGENT: "test/trmnl-mod-analytics",
};

describe("worker API caching", () => {
  beforeEach(() => {
    cache = createCacheStub();
    vi.stubGlobal("fetch", createModrinthFetchMock());
    vi.stubGlobal("caches", {
      open: vi.fn<CacheStorage["open"]>(async () => cache),
    });
  });

  it("caches successful anonymous summary responses by canonical project IDs", async () => {
    const firstCtx = createExecutionContext();
    const firstResponse = await worker.fetch(
      incomingRequest(
        "https://example.com/api/modrinth/summary?ignored=true&project_ids=worldedit,worldedit",
      ),
      env,
      firstCtx.ctx,
    );
    await Promise.all(firstCtx.waitUntilPromises);

    expect(firstResponse.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");

    const secondResponse = await worker.fetch(
      incomingRequest('https://example.com/api/modrinth/summary?project_ids=["worldedit"]'),
      env,
      createExecutionContext().ctx,
    );

    await expect(secondResponse.json()).resolves.toMatchObject({
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
      createExecutionContext().ctx,
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      revenue: {
        requested: true,
      },
    });
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
});

function incomingRequest(
  input: string,
  init?: RequestInit,
): Request<unknown, IncomingRequestCfProperties<unknown>> {
  return new Request(input, init) as Request<unknown, IncomingRequestCfProperties<unknown>>;
}

function createExecutionContext(): {
  ctx: ExecutionContext;
  waitUntilPromises: Promise<unknown>[];
} {
  const waitUntilPromises: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil(promise) {
        waitUntilPromises.push(promise);
      },
      passThroughOnException() {},
      props: undefined,
    },
    waitUntilPromises,
  };
}

function createCacheStub(): Cache {
  const responses = new Map<string, Response>();
  return {
    add: vi.fn<Cache["add"]>(async () => {}),
    addAll: vi.fn<Cache["addAll"]>(async () => {}),
    delete: vi.fn<Cache["delete"]>(async () => false),
    keys: vi.fn<Cache["keys"]>(async () => []),
    match: vi.fn<Cache["match"]>(async (request) => responses.get(cacheKeyUrl(request))?.clone()),
    matchAll: vi.fn<Cache["matchAll"]>(async () => []),
    put: vi.fn<Cache["put"]>(async (request, response) => {
      responses.set(cacheKeyUrl(request), response.clone());
    }),
  };
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
