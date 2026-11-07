import { AppHeader } from "@/components/app-header";
import { getUserName } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userName = await getUserName();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader userName={userName} />
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
