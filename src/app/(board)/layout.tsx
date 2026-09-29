import { AppHeader } from "@/components/layout/AppHeader";
import { requireSession } from "@/server/auth/dal";

export default async function BoardLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSession();
  return (
    <>
      <AppHeader email={email} />
      {children}
    </>
  );
}
