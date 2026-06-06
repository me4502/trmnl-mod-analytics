import type { SummaryProvider } from "../types.js";
import { createModrinthSummaryProvider } from "./modrinth.js";
import type { ModrinthEnv } from "./modrinthTypes.js";

export type ProviderEnv = ModrinthEnv;

export function createSummaryProvider(
  providerKey: string,
  env: ProviderEnv,
): SummaryProvider | null {
  if (providerKey === "modrinth") {
    return createModrinthSummaryProvider(env);
  }

  return null;
}
