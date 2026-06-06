import { describe, expect, it } from "vitest";
import { parseProjectIds } from "./projectIds.js";

describe("parseProjectIds", () => {
  it("accepts comma-separated project identifiers", () => {
    expect(parseProjectIds("sodium, lithium, sodium")).toEqual(["sodium", "lithium"]);
  });

  it("accepts JSON arrays", () => {
    expect(parseProjectIds('["fabric-api","iris"]')).toEqual(["fabric-api", "iris"]);
  });

  it("ignores empty input", () => {
    expect(parseProjectIds("")).toEqual([]);
  });
});
