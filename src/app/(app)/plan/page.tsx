import Link from "next/link";
import { StatusBanner } from "@/components/StatusBanner";
import { MealSlotSection } from "@/components/MealSlotSection";
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
  const canEdit = session.member.role !== "KID";

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

  const recipeOptions = recipes.map((r) => ({ id: r.id, title: r.title }));

  return (
    <div className="stack plan-page">
      <div className="plan-header">
        <div>
          <p className="eyebrow">This week</p>
          <h1 className="plan-title">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
          </h1>
        </div>
        <div className="row plan-week-nav">
          <Link className="btn btn-secondary btn-compact" href={`/plan?week=${toDateKey(prev)}`}>
            ←
          </Link>
          <Link className="btn btn-secondary btn-compact" href={`/plan?week=${toDateKey(next)}`}>
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

      {session.household.skylightEnabled && canEdit && (
        <form action={syncWeekToSkylightAction} className="panel plan-sync">
          <div>
            <strong>Skylight sync</strong>
            <p className="lede plan-sync-copy">
              Replace this week’s meals on Skylight so removals and moves stick.
            </p>
          </div>
          <input type="hidden" name="weekStart" value={toDateKey(weekStart)} />
          <button className="btn btn-primary btn-compact" type="submit">
            Sync
          </button>
        </form>
      )}

      {lunchRequests.length > 0 && (
        <section className="panel stack plan-compact-panel">
          <h2 className="plan-section-title">Lunch requests</h2>
          {lunchRequests.map((req) => (
            <div key={req.id}>
              <strong>{req.member.name}</strong>
              <div className="lede meal-meta">
                {format(req.date, "EEE")}: {req.requestText}
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
            <h2 className="day-title">{format(day, "EEE, MMM d")}</h2>
            {SLOTS.map((slot) => {
              const slotMeals = dayMeals.filter((m) => m.slot === slot);
              return (
                <MealSlotSection
                  key={slot}
                  date={key}
                  slot={slot}
                  slotLabel={slotLabel(slot)}
                  canEdit={canEdit}
                  recipes={recipeOptions}
                  upsertAction={upsertPlannedMealAction}
                  deleteAction={deletePlannedMealAction}
                  meals={slotMeals.map((meal) => ({
                    id: meal.id,
                    title: meal.title,
                    recipeTitle: meal.recipe?.title,
                    hasRecipe: Boolean(meal.recipe),
                    requestedByName: meal.requestedBy?.name,
                  }))}
                />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
