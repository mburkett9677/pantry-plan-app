import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createHouseholdAction, joinHouseholdAction } from "@/app/actions";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(session.member.role === "KID" ? "/lunch" : "/plan");
  }

  return (
    <main className="app-shell hero-home">
      <div className="stack" style={{ gap: "0.55rem" }}>
        <p className="eyebrow">Family kitchen OS</p>
        <h1 className="brand">
          Pantry<span>Plan</span>
        </h1>
        <p className="lede" style={{ maxWidth: "28rem" }}>
          Paste recipes, plan the week, and walk the store aisle by aisle — with
          lunch requests from every device at home.
        </p>
      </div>

      <div className="stack">
        <form action={createHouseholdAction} className="panel stack">
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.35rem" }}>
            Start a household
          </h2>
          <div className="field">
            <label htmlFor="householdName">Household name</label>
            <input id="householdName" name="householdName" placeholder="The Burketts" required />
          </div>
          <div className="field">
            <label htmlFor="adminName">Your name</label>
            <input id="adminName" name="adminName" placeholder="Matt" required />
          </div>
          <div className="field">
            <label htmlFor="pin">Optional PIN</label>
            <input id="pin" name="pin" type="password" inputMode="numeric" placeholder="••••" />
          </div>
          <button className="btn btn-primary" type="submit">
            Create household
          </button>
        </form>

        <form action={joinHouseholdAction} className="panel stack">
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.35rem" }}>
            Join with invite code
          </h2>
          <div className="field">
            <label htmlFor="inviteCode">Invite code</label>
            <input id="inviteCode" name="inviteCode" placeholder="AB12CD34" required />
          </div>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" placeholder="Alex" required />
          </div>
          <div className="field">
            <label htmlFor="role">I am a</label>
            <select id="role" name="role" defaultValue="KID">
              <option value="KID">Kid</option>
              <option value="PARENT">Parent</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="joinPin">Optional PIN</label>
            <input id="joinPin" name="pin" type="password" inputMode="numeric" placeholder="••••" />
          </div>
          <button className="btn btn-secondary" type="submit">
            Join household
          </button>
        </form>
      </div>
    </main>
  );
}
