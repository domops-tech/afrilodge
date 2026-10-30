import { ConsoleShell } from "@/components/layout/ConsoleShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell role="ADMIN">{children}</ConsoleShell>;
}
