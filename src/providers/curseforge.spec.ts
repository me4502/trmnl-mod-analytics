import { describe, expect, it, vi } from "vitest";
import { createCurseForgeSummaryProvider } from "./curseforge.js";

describe("createCurseForgeSummaryProvider", () => {
  it("requires a CurseForge API key", async () => {
    const provider = createCurseForgeSummaryProvider();

    let caught: unknown;
    try {
      await provider.buildSummary({ projectIds: ["238222"], token: "" });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "Add a valid CurseForge API key to show CurseForge downloads.",
    );
  });

  it("requires numeric project IDs", async () => {
    const provider = createCurseForgeSummaryProvider();

    let caught: unknown;
    try {
      await provider.buildSummary({ projectIds: ["worldedit"], token: "curseforge-key" });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "CurseForge project IDs must be positive numeric mod IDs.",
    );
  });

  it("maps CurseForge mods to normalized summaries", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: [
          {
            id: 306770,
            name: "WorldEdit",
            downloadCount: 789,
          },
          {
            id: 238222,
            name: "Just Enough Items",
            slug: "jei",
            downloadCount: 123456,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createCurseForgeSummaryProvider();
    const summary = await provider.buildSummary({
      projectIds: ["238222", "306770"],
      token: "curseforge-key",
    });

    expect(summary.projects).toEqual([
      {
        id: "238222",
        slug: "jei",
        title: "Just Enough Items",
        downloads: 123456,
      },
      {
        id: "306770",
        slug: "306770",
        title: "WorldEdit",
        downloads: 789,
      },
    ]);
    expect(summary.totals.downloads).toBe(124245);
    expect(summary.revenue.requested).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.curseforge.com/v1/mods",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ modIds: [238222, 306770] }),
        headers: expect.objectContaining({
          "x-api-key": "curseforge-key",
        }),
      }),
    );
  });

  it("reports missing project IDs", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: [
          {
            id: 238222,
            name: "Just Enough Items",
            downloadCount: 123456,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createCurseForgeSummaryProvider();
    let caught: unknown;
    try {
      await provider.buildSummary({
        projectIds: ["238222", "306770"],
        token: "curseforge-key",
      });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "One or more CurseForge projects could not be found.",
    );
  });
});
