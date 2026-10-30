import { ConsoleShell } from "@/components/layout/ConsoleShell";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell role="OWNER">{children}</ConsoleShell>;
}
