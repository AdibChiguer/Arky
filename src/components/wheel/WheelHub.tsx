import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MouseEvent, PointerEvent } from "react";
import type { WheelHubContent } from "../../types/wheel";

export type WheelHubProfileControls = {
  disabled: boolean;
  previousName: string;
  nextName: string;
  onPrevious: () => void;
  onNext: () => void;
};

function stopHubEvent(event: MouseEvent | PointerEvent) {
  event.stopPropagation();
}

type Props = {
  hub: WheelHubContent;
  live: boolean;
  profileControls?: WheelHubProfileControls;
};

export function WheelHub({ hub, live, profileControls }: Props) {
  return (
    <div className="hub-content" aria-live={live ? "polite" : undefined}>
      <span className="hub-eyebrow">{hub.eyebrow}</span>
      <div className={`hub-label-row${profileControls ? " has-profile-controls" : ""}`}>
        {profileControls && (
          <button
            className={`hub-profile-arrow${profileControls.disabled ? " is-disabled" : ""}`}
            type="button"
            aria-label={`Previous profile: ${profileControls.previousName}`}
            aria-disabled={profileControls.disabled}
            tabIndex={profileControls.disabled ? -1 : 0}
            title={`Previous: ${profileControls.previousName}`}
            onPointerDown={stopHubEvent}
            onPointerUp={stopHubEvent}
            onMouseDown={stopHubEvent}
            onMouseUp={stopHubEvent}
            onClick={(event) => {
              event.stopPropagation();
              if (!profileControls.disabled) profileControls.onPrevious();
            }}
          >
            <ChevronLeft size={15} />
          </button>
        )}
        <strong className="hub-label">{hub.label}</strong>
        {profileControls && (
          <button
            className={`hub-profile-arrow${profileControls.disabled ? " is-disabled" : ""}`}
            type="button"
            aria-label={`Next profile: ${profileControls.nextName}`}
            aria-disabled={profileControls.disabled}
            tabIndex={profileControls.disabled ? -1 : 0}
            title={`Next: ${profileControls.nextName}`}
            onPointerDown={stopHubEvent}
            onPointerUp={stopHubEvent}
            onMouseDown={stopHubEvent}
            onMouseUp={stopHubEvent}
            onClick={(event) => {
              event.stopPropagation();
              if (!profileControls.disabled) profileControls.onNext();
            }}
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>
      <span className={`hub-position${hub.active ? " is-active" : ""}`}>
        {hub.position}
      </span>
    </div>
  );
}
