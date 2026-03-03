import { Text } from "ink";
import { resolvePrStatus, prStatusDisplay } from "../lib/types.js";
import type { PrInfo, PrStatus } from "../lib/types.js";

interface Props {
  pr: PrInfo | null;
  loading: boolean;
}

export function StatusBadge({ pr, loading }: Props) {
  if (loading) {
    return <Text dimColor>···</Text>;
  }

  if (!pr) {
    return <Text dimColor>no PR</Text>;
  }

  const status = resolvePrStatus(pr);
  const { icon, label } = prStatusDisplay[status];
  return <Text color={statusColor[status]}>{icon} {label}</Text>;
}

const statusColor: Record<PrStatus, string> = {
  failing:           "red",
  unresolved:        "yellow",
  changes_requested: "red",
  review_needed:     "yellow",
  pending_ci:        "yellow",
  approved:          "green",
  merged:            "magenta",
  closed:            "red",
};
