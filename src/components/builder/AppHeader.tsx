import { LayoutList, Settings2 } from "lucide-react";
import type { BuilderView } from "../../types/wheel";

type Props = {
  view: BuilderView;
  onViewChange: (view: BuilderView) => void;
};

export function AppHeader({ view, onViewChange }: Props) {
  return (
    <header className="app-header">
      <nav className="view-tabs" aria-label="Builder sections">
        <button
          className={view === "actions" ? "view-tab is-active" : "view-tab"}
          onClick={() => onViewChange("actions")}
        >
          <LayoutList size={16} />
          Actions
        </button>
        <button
          className={view === "settings" ? "view-tab is-active" : "view-tab"}
          onClick={() => onViewChange("settings")}
        >
          <Settings2 size={16} />
          Settings
        </button>
      </nav>
    </header>
  );
}
