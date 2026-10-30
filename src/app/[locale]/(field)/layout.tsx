import { ConsoleShell } from "@/components/layout/ConsoleShell";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell role="AGENT">{children}</ConsoleShell>;
}
