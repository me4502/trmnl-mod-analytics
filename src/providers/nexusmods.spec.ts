import { describe, expect, it, vi } from "vitest";
import { createNexusModsSummaryProvider } from "./nexusmods.js";

describe("createNexusModsSummaryProvider", () => {
  it("requires a Nexus Mods API key", async () => {
    const provider = createNexusModsSummaryProvider();

    let caught: unknown;
    try {
      await provider.buildSummary({ projectIds: ["skyrimspecialedition/2347"], token: "" });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "Add a Nexus Mods API key to show Nexus Mods downloads.",
    );
  });

  it("requires game domain and numeric mod ID identifiers", async () => {
    const provider = createNexusModsSummaryProvider();

    let caught: unknown;
    try {
      await provider.buildSummary({
        projectIds: ["skyrimspecialedition/not-a-number"],
        token: "nexus-key",
      });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "Nexus Mods projects must use game_domain/mod_id, for example skyrimspecialedition/2347.",
    );
  });

  it("maps Nexus Mods mods to normalized summaries", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) =>
      Response.json(
        url === "https://api.nexusmods.com/v1/games/skyrimspecialedition/mods/2347.json"
          ? {
              mod_id: 2347,
              name: "SkyUI",
              mod_downloads: 123456,
            }
          : {
              mod_id: 2400,
              name: "Stardew Valley Expanded",
              mod_downloads: 789,
            },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createNexusModsSummaryProvider();
    const summary = await provider.buildSummary({
      projectIds: ["skyrimspecialedition/2347", "stardewvalley/2400"],
      token: "nexus-key",
    });

    expect(summary.projects).toEqual([
      {
        id: "skyrimspecialedition/2347",
        slug: "skyrimspecialedition/2347",
        title: "SkyUI",
        downloads: 123456,
      },
      {
        id: "stardewvalley/2400",
        slug: "stardewvalley/2400",
        title: "Stardew Valley Expanded",
        downloads: 789,
      },
    ]);
    expect(summary.totals.downloads).toBe(124245);
    expect(summary.revenue.requested).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexusmods.com/v1/games/skyrimspecialedition/mods/2347.json",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "nexus-key",
        }),
      }),
    );
  });

  it("reports missing projects", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ error: "Not found" }, { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createNexusModsSummaryProvider();
    let caught: unknown;
    try {
      await provider.buildSummary({
        projectIds: ["skyrimspecialedition/2347"],
        token: "nexus-key",
      });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "One or more Nexus Mods projects could not be found.",
    );
  });
});
