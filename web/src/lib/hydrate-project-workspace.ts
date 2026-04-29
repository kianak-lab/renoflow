import { loadWorkspace, saveWorkspace, type WorkspaceShape } from "@/lib/demolition-workspace";

/** Deep-clone API payload into plain JSON so localStorage always holds serializable `WorkspaceShape`. */
function cloneRoomsForStorage(rooms: unknown): WorkspaceShape["rooms"] {
  try {
    const parsed = JSON.parse(JSON.stringify(Array.isArray(rooms) ? rooms : [])) as unknown;
    return parsed as WorkspaceShape["rooms"];
  } catch {
    return [];
  }
}

/**
 * Loads project workspace data from Supabase via `/api/projects/[id]/workspace`
 * and persists it to localStorage in the shape expected by `final.html` and
 * `/trades/demolition` (`loadWorkspace` / `saveWorkspace`).
 */
export async function hydrateProjectWorkspaceFromApi(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
    credentials: "include",
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    rooms?: unknown;
  };
  if (!res.ok) {
    throw new Error(j.error ?? "Could not load workspace.");
  }
  const rooms = cloneRoomsForStorage(j.rooms);
  const prev = loadWorkspace(projectId);
  const prevPlain =
    prev != null
      ? (JSON.parse(JSON.stringify(prev)) as WorkspaceShape)
      : ({} as WorkspaceShape);
  const next: WorkspaceShape = {
    ...prevPlain,
    rooms,
  };
  saveWorkspace(projectId, next);
  try {
    localStorage.setItem("rf7_active_project", projectId);
  } catch {
    /* quota / private mode */
  }
}
