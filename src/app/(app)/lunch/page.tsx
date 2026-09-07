import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDateKey, weekDays, weekStartFrom } from "@/lib/dates";
import { createLunchRequestAction } from "@/app/actions";

export default async function LunchPage() {
  const session = await requireSession();
  const weekStart = weekStartFrom();
  const days = weekDays(weekStart);
  const weekEnd = days[6];

  const requests = await prisma.lunchRequest.findMany({
    where: {
      householdId: session.householdId,
      date: { gte: weekStart, lte: weekEnd },
    },
    include: { member: true },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Kid-friendly</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
          Lunch requests
        </h1>
        <p className="lede">
          Tap a day and tell the kitchen what you want. It lands on the family meal plan.
        </p>
      </div>

      <form action={createLunchRequestAction} className="panel stack">
        <div className="field">
          <label htmlFor="date">Day</label>
          <select id="date" name="date" defaultValue={toDateKey(new Date())}>
            {days.map((day) => (
              <option key={toDateKey(day)} value={toDateKey(day)}>
                {format(day, "EEEE, MMM d")}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="requestText">I want</label>
          <input
            id="requestText"
            name="requestText"
            placeholder="PB&J, leftover pizza, turkey wrap…"
            required
          />
        </div>
        <button className="btn btn-primary" type="submit">
          Send lunch request
        </button>
      </form>

      <section className="panel stack">
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
          This week
        </h2>
        {requests.length === 0 ? (
          <p className="lede" style={{ margin: 0 }}>
            No lunch requests yet.
          </p>
        ) : (
          requests.map((req) => (
            <div key={req.id}>
              <strong>
                {format(req.date, "EEE")} · {req.member.name}
              </strong>
              <div className="lede" style={{ margin: 0 }}>
                {req.requestText}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
