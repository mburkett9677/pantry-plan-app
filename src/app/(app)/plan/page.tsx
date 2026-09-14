import Link from "next/link";
import { StatusBanner } from "@/components/StatusBanner";
import { AddMealForm } from "@/components/AddMealForm";
import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SLOTS, slotLabel, toDateKey, weekDays, weekStartFrom } from "@/lib/dates";
import {
  deletePlannedMealAction,
  syncWeekToSkylightAction,
  upsertPlannedMealAction,
} from "@/app/actions";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; skylight?: string; synced?: string; msg?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const sp = params;
  const weekStart = params.week ? new Date(params.week) : weekStartFrom();
  const days = weekDays(weekStart);
  const weekEnd = days[6];

  const [meals, recipes, lunchRequests] = await Promise.all([
    prisma.plannedMeal.findMany({
      where: {
        householdId: session.householdId,
        date: { gte: weekStart, lte: weekEnd },
      },
      include: { requestedBy: true, recipe: true },
      orderBy: [{ date: "asc" }, { slot: "asc" }],
    }),
    prisma.recipe.findMany({
      where: { householdId: session.householdId },
      orderBy: { title: "asc" },
    }),
    prisma.lunchRequest.findMany({
      where: {
        householdId: session.householdId,
        date: { gte: weekStart, lte: weekEnd },
      },
      include: { member: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const prev = new Date(weekStart);
  prev.setDate(prev.getDate() - 7);
  const next = new Date(weekStart);
  next.setDate(next.getDate() + 7);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">This week</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
          </h1>
        </div>
        <div className="row">
          <Link className="btn btn-secondary" href={`/plan?week=${toDateKey(prev)}`}>
            ←
          </Link>
          <Link className="btn btn-secondary" href={`/plan?week=${toDateKey(next)}`}>
            →
          </Link>
        </div>
      </div>

      {(sp.skylight === "ok" || sp.skylight === "partial") && (
        <StatusBanner tone={sp.skylight === "ok" ? "ok" : "info"}>
          Skylight sync finished{sp.synced ? ` — ${sp.synced} meal(s)` : ""}.
          {sp.msg ? ` ${decodeURIComponent(sp.msg)}` : ""}
        </StatusBanner>
      )}
      {sp.skylight === "error" && (
        <StatusBanner tone="error">
          Skylight sync failed{sp.msg ? `: ${decodeURIComponent(sp.msg)}` : "."}
        </StatusBanner>
      )}
      {sp.skylight === "disabled" && (
        <StatusBanner tone="error">
          Enable Skylight and save credentials in Settings first.
        </StatusBanner>
      )}

      {session.household.skylightEnabled && session.member.role !== "KID" && (
        <form action={syncWeekToSkylightAction} className="panel row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>Skylight sync</strong>
            <p className="lede" style={{ margin: 0, fontSize: "0.9rem" }}>
              Push this week’s meals to your Skylight Calendar.
            </p>
          </div>
          <input type="hidden" name="weekStart" value={toDateKey(weekStart)} />
          <button className="btn btn-primary" type="submit">
            Sync
          </button>
        </form>
      )}

      {lunchRequests.length > 0 && (
        <section className="panel stack">
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
            Lunch requests
          </h2>
          {lunchRequests.map((req) => (
            <div key={req.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{req.member.name}</strong>
                <div className="lede" style={{ margin: 0, fontSize: "0.92rem" }}>
                  {format(req.date, "EEE")}: {req.requestText}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {days.map((day) => {
        const key = toDateKey(day);
        const dayMeals = meals.filter((m) => toDateKey(m.date) === key);
        return (
          <section key={key} className="panel day-card">
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.35rem" }}>
              {format(day, "EEEE, MMM d")}
            </h2>
            {SLOTS.map((slot) => {
              const slotMeals = dayMeals.filter((m) => m.slot === slot);
              return (
                <div key={slot} className="slot">
                  <strong>{slotLabel(slot)}</strong>
                  {slotMeals.map((meal) => (
                    <div key={meal.id} className="row" style={{ justifyContent: "space-between" }}>
                      <div>
                        <div>{meal.recipe?.title || meal.title}</div>
                        {meal.recipe ? (
                          <div className="lede" style={{ margin: 0, fontSize: "0.8rem" }}>
                            Recipe linked
                          </div>
                        ) : null}
                        {meal.requestedBy && (
                          <div className="lede" style={{ margin: 0, fontSize: "0.8rem" }}>
                            via {meal.requestedBy.name}
                          </div>
                        )}
                      </div>
                      {session.member.role !== "KID" && (
                        <form action={deletePlannedMealAction}>
                          <input type="hidden" name="id" value={meal.id} />
                          <button className="btn btn-ghost" type="submit">
                            Remove
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                  {session.member.role !== "KID" && (
                    <AddMealForm
                      action={upsertPlannedMealAction}
                      date={key}
                      slot={slot}
                      slotLabel={slotLabel(slot)}
                      recipes={recipes.map((r) => ({ id: r.id, title: r.title }))}
                    />
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
