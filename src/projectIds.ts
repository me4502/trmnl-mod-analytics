export function parseProjectIds(value: string | string[]): string[] {
  const rawValue = Array.isArray(value) ? value.join(",") : value;
  const trimmed = rawValue.trim();
  const projects: string[] = [];

  if (trimmed.length === 0) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Project IDs JSON must be an array");
    }

    projects.push(
      ...parsed.filter((projectId): projectId is string => typeof projectId === "string"),
    );
  } else {
    projects.push(...trimmed.split(/[\n,]/));
  }

  return [
    ...new Set(
      projects.map((projectId) => projectId.trim()).filter((projectId) => projectId.length > 0),
    ),
  ];
}
