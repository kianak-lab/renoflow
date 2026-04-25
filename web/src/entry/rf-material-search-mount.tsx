import { createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import MaterialSearch from "../components/MaterialSearch";

let lastRoot: Root | null = null;

export function rfUnmountMaterialSearch() {
  if (lastRoot) {
    try {
      lastRoot.unmount();
    } catch {
      /* ignore */
    }
    lastRoot = null;
  }
}

export function rfMountMaterialSearch() {
  const el = document.getElementById("material-search-react-root");
  if (!el) return;
  if (lastRoot) {
    try {
      lastRoot.unmount();
    } catch {
      /* ignore */
    }
    lastRoot = null;
  }
  const root = createRoot(el);
  lastRoot = root;
  root.render(
    createElement(StrictMode, null, createElement(MaterialSearch)),
  );
}

if (typeof window !== "undefined") {
  (window as unknown as { rfUnmountMaterialSearch: () => void }).rfUnmountMaterialSearch =
    rfUnmountMaterialSearch;
  (window as unknown as { rfMountMaterialSearch: () => void }).rfMountMaterialSearch =
    rfMountMaterialSearch;
}
