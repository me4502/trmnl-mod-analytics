import { describe, expect, it, vi } from "vitest";
import { createSteamWorkshopSummaryProvider } from "./steamworkshop.js";

describe("createSteamWorkshopSummaryProvider", () => {
  it("requires numeric published file IDs", async () => {
    const provider = createSteamWorkshopSummaryProvider();

    let caught: unknown;
    try {
      await provider.buildSummary({ projectIds: ["rimworld/harmony"], token: "" });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "Steam Workshop projects must use numeric published file IDs, for example 2009463077.",
    );
  });

  it("maps Steam Workshop items to normalized summaries", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        response: {
          result: 1,
          publishedfiledetails: [
            {
              publishedfileid: "2009463077",
              result: 1,
              title: "Harmony",
              lifetime_subscriptions: 3958850,
            },
            {
              publishedfileid: "818773962",
              result: 1,
              title: "HugsLib",
              lifetime_subscriptions: 123456,
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createSteamWorkshopSummaryProvider();
    const summary = await provider.buildSummary({
      projectIds: ["818773962", "2009463077"],
      token: "",
    });

    expect(summary.projects).toEqual([
      {
        id: "2009463077",
        slug: "2009463077",
        title: "Harmony",
        downloads: 3958850,
      },
      {
        id: "818773962",
        slug: "818773962",
        title: "HugsLib",
        downloads: 123456,
      },
    ]);
    expect(summary.totals.downloads).toBe(4082306);
    expect(summary.revenue.requested).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
        body: expect.any(URLSearchParams),
      }),
    );

    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect((body as URLSearchParams).get("itemcount")).toBe("2");
    expect((body as URLSearchParams).get("publishedfileids[0]")).toBe("818773962");
    expect((body as URLSearchParams).get("publishedfileids[1]")).toBe("2009463077");
  });

  it("reports missing Workshop items", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        response: {
          result: 1,
          publishedfiledetails: [
            {
              publishedfileid: "2009463077",
              result: 9,
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createSteamWorkshopSummaryProvider();
    let caught: unknown;
    try {
      await provider.buildSummary({ projectIds: ["2009463077"], token: "" });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "One or more Steam Workshop items could not be found.",
    );
  });

  it("reports missing lifetime subscriptions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        Response.json({
          response: {
            result: 1,
            publishedfiledetails: [
              {
                publishedfileid: "2009463077",
                result: 1,
                title: "Harmony",
              },
            ],
          },
        }),
      ),
    );

    const provider = createSteamWorkshopSummaryProvider();
    let caught: unknown;
    try {
      await provider.buildSummary({ projectIds: ["2009463077"], token: "" });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "Steam Workshop did not return lifetime subscriptions for one or more projects.",
    );
  });
});
