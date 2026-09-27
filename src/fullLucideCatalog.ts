import { icons } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IconOption } from "./icons";

export const FULL_LUCIDE_ICONS = icons as Record<string, LucideIcon>;

function iconLabel(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
}

export function createFullLucideOptions(
  curatedOptions: IconOption[],
): IconOption[] {
  const curatedNames = new Set(curatedOptions.map((option) => option.name));
  const remainingOptions = Object.entries(FULL_LUCIDE_ICONS)
    .filter(([name]) => !curatedNames.has(name))
    .map(([name, Icon]) => {
      const label = iconLabel(name);
      return {
        name: `lucide:${name}`,
        label,
        keywords: label.toLowerCase().split(" "),
        Icon,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  return [...curatedOptions, ...remainingOptions];
}
