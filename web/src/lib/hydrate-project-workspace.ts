import { loadWorkspace, saveWorkspace, type WorkspaceShape } from "@/lib/demolition-workspace";

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
  const rooms = Array.isArray(j.rooms) ? j.rooms : [];
  const prev = loadWorkspace(projectId);
  const next: WorkspaceShape = {
    ...(prev ?? {}),
    rooms: rooms as WorkspaceShape["rooms"],
  };
  saveWorkspace(projectId, next);
  try {
    localStorage.setItem("rf7_active_project", projectId);
  } catch {
    /* quota / private mode */
  }
}
