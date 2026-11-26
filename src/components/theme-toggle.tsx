import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

const order = ["system", "light", "dark"] as const;
type Mode = (typeof order)[number];
const icons = { system: Monitor, light: Sun, dark: Moon };

export function ThemeToggle() {
  const { theme = "system", setTheme } = useTheme();
  const current: Mode = (order as readonly string[]).includes(theme)
    ? (theme as Mode)
    : "system";
  const next = order[(order.indexOf(current) + 1) % order.length];
  const Icon = icons[current];

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${current}. Switch to ${next}`}
    >
      <Icon />
    </Button>
  );
}
