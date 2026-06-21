import type { SummaryProvider } from "../types.js";
import { createCurseForgeSummaryProvider } from "./curseforge.js";
import type { CurseForgeEnv } from "./curseforgeTypes.js";
import { createModrinthSummaryProvider } from "./modrinth.js";
import type { ModrinthEnv } from "./modrinthTypes.js";
import { createThunderstoreSummaryProvider } from "./thunderstore.js";

export type ProviderEnv = CurseForgeEnv & ModrinthEnv;

export function createSummaryProvider(
  providerKey: string,
  env: ProviderEnv,
): SummaryProvider | null {
  if (providerKey === "modrinth") {
    return createModrinthSummaryProvider(env);
  } else if (providerKey === "curseforge") {
    return createCurseForgeSummaryProvider(env);
  } else if (providerKey === "thunderstore") {
    return createThunderstoreSummaryProvider();
  }

  return null;
}
