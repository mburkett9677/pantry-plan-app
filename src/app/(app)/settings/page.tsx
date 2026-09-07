import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addMemberAction,
  logoutAction,
  saveSkylightSettingsAction,
  switchMemberAction,
  testSkylightAction,
} from "@/app/actions";

export default async function SettingsPage() {
  const session = await requireSession();
  const members = await prisma.member.findMany({
    where: { householdId: session.householdId },
    orderBy: { name: "asc" },
  });
  const adult = session.member.role !== "KID";

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Household</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
          Settings
        </h1>
      </div>

      <section className="panel stack">
        <strong>Invite code</strong>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "0.12em",
          }}
        >
          {session.household.inviteCode}
        </div>
        <p className="lede" style={{ margin: 0 }}>
          Kids and partners can join from their phones with this code.
        </p>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
          Switch person on this device
        </h2>
        {members.map((member) => (
          <form key={member.id} action={switchMemberAction} className="row">
            <input type="hidden" name="memberId" value={member.id} />
            <div style={{ flex: 1 }}>
              <strong>{member.name}</strong>
              <div className="lede" style={{ margin: 0, fontSize: "0.85rem" }}>
                {member.role.toLowerCase()}
              </div>
            </div>
            {member.pinHash ? (
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                placeholder="PIN"
                style={{ width: 80, borderRadius: 12, border: "1px solid var(--line)", padding: "0.6rem" }}
              />
            ) : (
              <input type="hidden" name="pin" value="" />
            )}
            <button className="btn btn-secondary" type="submit">
              Use
            </button>
          </form>
        ))}
      </section>

      {adult && (
        <section className="panel stack">
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
            Add family member
          </h2>
          <form action={addMemberAction} className="stack">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue="KID">
                <option value="KID">Kid</option>
                <option value="PARENT">Parent</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pin">Optional PIN</label>
              <input id="pin" name="pin" type="password" inputMode="numeric" />
            </div>
            <button className="btn btn-primary" type="submit">
              Add member
            </button>
          </form>
        </section>
      )}

      {adult && (
        <section className="panel stack">
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
            Skylight Calendar
          </h2>
          <p className="lede" style={{ margin: 0 }}>
            Uses Skylight’s private app API (no official public API). Store credentials only if
            you’re comfortable — sync pushes weekly meals into Skylight Meals.
          </p>
          <form action={saveSkylightSettingsAction} className="stack">
            <div className="field">
              <label htmlFor="skylightEmail">Email</label>
              <input
                id="skylightEmail"
                name="skylightEmail"
                type="email"
                defaultValue={session.household.skylightEmail || ""}
              />
            </div>
            <div className="field">
              <label htmlFor="skylightPassword">Password</label>
              <input
                id="skylightPassword"
                name="skylightPassword"
                type="password"
                defaultValue={session.household.skylightPassword || ""}
              />
            </div>
            <div className="field">
              <label htmlFor="skylightFrameId">Frame / household ID</label>
              <input
                id="skylightFrameId"
                name="skylightFrameId"
                defaultValue={session.household.skylightFrameId || ""}
                placeholder="From Skylight app / community CLI `skylight frames`"
              />
            </div>
            <label className="row">
              <input
                type="checkbox"
                name="skylightEnabled"
                defaultChecked={session.household.skylightEnabled}
              />
              Enable Skylight sync
            </label>
            <button className="btn btn-primary" type="submit">
              Save Skylight settings
            </button>
          </form>
          <form action={testSkylightAction}>
            <button className="btn btn-secondary" type="submit">
              Test connection
            </button>
          </form>
        </section>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link className="btn btn-secondary" href="/lunch">
          Lunch board
        </Link>
        <form action={logoutAction}>
          <button className="btn btn-danger" type="submit">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
