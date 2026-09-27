import { useEffect, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import {
  LUCIDE_ICON_OPTIONS,
  PHOSPHOR_ICON_OPTIONS,
  getSegmentIcon,
  iconProviderForName,
  loadFullLucideOptions,
  type IconOption,
  type IconProvider,
} from "../../icons";

const ICON_PAGE_SIZE = 128;

function iconLabel(iconName: string) {
  const name = iconName.includes(":") ? iconName.split(":", 2)[1] : iconName;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
}

type Props = {
  icon: string;
  open: boolean;
  query: string;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSelect: (icon: string) => void;
};

export function IconPicker({
  icon,
  open,
  query,
  onOpenChange,
  onQueryChange,
  onSelect,
}: Props) {
  const [provider, setProvider] = useState<IconProvider>(() =>
    iconProviderForName(icon),
  );
  const [lucideOptions, setLucideOptions] = useState<IconOption[]>(
    LUCIDE_ICON_OPTIONS,
  );
  const [loadingLucide, setLoadingLucide] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(ICON_PAGE_SIZE);
  const selected = [...lucideOptions, ...PHOSPHOR_ICON_OPTIONS].find(
    (option) => option.name === icon,
  );
  const SelectedIcon = selected?.Icon || getSegmentIcon(icon);
  const selectedLabel = selected?.label || iconLabel(icon);
  const normalized = query.trim().toLowerCase();
  const providerOptions =
    provider === "lucide" ? lucideOptions : PHOSPHOR_ICON_OPTIONS;
  const options = normalized
    ? providerOptions.filter((option) =>
        [option.label, option.name, ...option.keywords].some((value) =>
          value.toLowerCase().includes(normalized),
        ),
      )
    : providerOptions;
  const visibleOptions = options.slice(0, visibleLimit);

  useEffect(() => {
    if (open) setProvider(iconProviderForName(icon));
  }, [icon, open]);

  useEffect(() => {
    if (
      !open ||
      provider !== "lucide" ||
      lucideOptions.length > LUCIDE_ICON_OPTIONS.length
    ) {
      return;
    }
    let active = true;
    setLoadingLucide(true);
    void loadFullLucideOptions()
      .then((fullOptions) => {
        if (active) setLucideOptions(fullOptions);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingLucide(false);
      });
    return () => {
      active = false;
    };
  }, [lucideOptions.length, open, provider]);

  useEffect(() => {
    setVisibleLimit(ICON_PAGE_SIZE);
  }, [normalized, provider]);

  const chooseProvider = (nextProvider: IconProvider) => {
    setProvider(nextProvider);
    onQueryChange("");
  };

  return (
    <div className="field icon-field">
      <span>Icon</span>
      <button
        type="button"
        className="icon-picker-trigger"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="chosen-icon">
          <SelectedIcon size={17} />
        </span>
        <span>{selectedLabel}</span>
        <ChevronDown size={15} />
      </button>
      <small className="field-help-slot" aria-hidden="true">
        &nbsp;
      </small>
      {open && (
        <div
          className="icon-picker-popover"
          role="dialog"
          aria-label="Choose an icon"
        >
          <div
            className="icon-provider-tabs"
            role="tablist"
            aria-label="Icon set"
          >
            <button
              type="button"
              className={provider === "lucide" ? "is-selected" : ""}
              role="tab"
              aria-selected={provider === "lucide"}
              onClick={() => chooseProvider("lucide")}
            >
              Lucide
            </button>
            <button
              type="button"
              className={provider === "phosphor" ? "is-selected" : ""}
              role="tab"
              aria-selected={provider === "phosphor"}
              onClick={() => chooseProvider("phosphor")}
            >
              Phosphor
            </button>
          </div>
          <div className="icon-picker-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              placeholder={`Search ${provider === "lucide" ? "Lucide" : "Phosphor"} icons…`}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <button
              type="button"
              aria-label="Close icon picker"
              onClick={() => onOpenChange(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="icon-grid">
            {visibleOptions.map((option) => (
              <button
                type="button"
                className={icon === option.name ? "is-selected" : ""}
                key={option.name}
                title={option.label}
                aria-label={option.label}
                onClick={() => onSelect(option.name)}
              >
                <option.Icon size={19} />
              </button>
            ))}
          </div>
          {options.length === 0 && (
            <p className="empty-icons">No icons match “{query}”.</p>
          )}
          {loadingLucide && (
            <p className="icon-picker-status">Loading the full Lucide set…</p>
          )}
          {visibleOptions.length < options.length && (
            <div className="icon-picker-footer">
              <span>
                {visibleOptions.length.toLocaleString()} of{" "}
                {options.length.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() =>
                  setVisibleLimit((limit) => limit + ICON_PAGE_SIZE)
                }
              >
                Show more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
