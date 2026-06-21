import { describe, expect, it, vi } from "vitest";
import { createThunderstoreSummaryProvider } from "./thunderstore.js";

describe("createThunderstoreSummaryProvider", () => {
  it("requires community, owner, and package identifiers", async () => {
    const provider = createThunderstoreSummaryProvider();

    let caught: unknown;
    try {
      await provider.buildSummary({ projectIds: ["ebkr/r2modman"], token: "" });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "Thunderstore packages must use community/owner/package, for example lethal-company/ebkr/r2modman.",
    );
  });

  it("maps Thunderstore packages to normalized summaries", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) =>
      Response.json(
        url === "https://thunderstore.io/api/v1/package-metrics/ebkr/r2modman/"
          ? {
              downloads: 30,
              rating_score: 10,
              latest_version: "1.0.0",
            }
          : {
              downloads: 123456,
              rating_score: 20,
              latest_version: "2.0.0",
            },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createThunderstoreSummaryProvider();
    const summary = await provider.buildSummary({
      projectIds: ["lethal-company/ebkr/r2modman", "lethal-company/notnotnotswipez/MoreCompany"],
      token: "",
    });

    expect(summary.projects).toEqual([
      {
        id: "lethal-company/notnotnotswipez/MoreCompany",
        slug: "lethal-company/notnotnotswipez/MoreCompany",
        title: "MoreCompany",
        downloads: 123456,
      },
      {
        id: "lethal-company/ebkr/r2modman",
        slug: "lethal-company/ebkr/r2modman",
        title: "r2modman",
        downloads: 30,
      },
    ]);
    expect(summary.totals.downloads).toBe(123486);
    expect(summary.revenue.requested).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://thunderstore.io/api/v1/package-metrics/ebkr/r2modman/",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    );
  });

  it("reports missing packages", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ error: "Not found" }, { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createThunderstoreSummaryProvider();
    let caught: unknown;
    try {
      await provider.buildSummary({ projectIds: ["lethal-company/ebkr/r2modman"], token: "" });
    } catch (error) {
      caught = error;
    }

    expect(provider.getUpstreamErrorMessage(caught)).toBe(
      "One or more Thunderstore packages could not be found.",
    );
  });
});
