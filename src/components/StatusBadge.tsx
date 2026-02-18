import { Text } from "ink";
import Spinner from "ink-spinner";

interface Props {
  state: "open" | "merged" | "closed" | null;
  loading: boolean;
}

export function StatusBadge({ state, loading }: Props) {
  if (loading) {
    return (
      <Text dimColor>
        <Spinner type="dots" />
      </Text>
    );
  }

  switch (state) {
    case "open":
      return <Text color="green">● open</Text>;
    case "merged":
      return <Text color="magenta">✓ merged</Text>;
    case "closed":
      return <Text color="red">✕ closed</Text>;
    default:
      return <Text dimColor>no PR</Text>;
  }
}
