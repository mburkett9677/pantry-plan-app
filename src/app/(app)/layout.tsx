import { requireSession } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const kidMode = session.member.role === "KID";

  return (
    <div className="app-shell">
      <header className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <p className="eyebrow">{session.household.name}</p>
          <Link href={kidMode ? "/lunch" : "/plan"} className="brand" style={{ fontSize: "1.7rem" }}>
            Pantry<span>Plan</span>
          </Link>
        </div>
        <div className="chip" style={{ background: `${session.member.color}22`, color: session.member.color }}>
          {session.member.name}
        </div>
      </header>
      {children}
      <BottomNav kidMode={kidMode} />
    </div>
  );
}
