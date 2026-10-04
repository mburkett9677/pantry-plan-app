import Link from "next/link";
import { addDays, format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nearbyWeeks, toDateKey, weekRangeLabel, weekStartFrom } from "@/lib/dates";
import { groupShoppingByCategory } from "@/lib/shopping";
import {
  generateShoppingListAction,
  toggleShoppingItemAction,
} from "@/app/actions";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string; week?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const weekStart = params.week ? weekStartFrom(new Date(params.week)) : weekStartFrom();
  const weekKey = toDateKey(weekStart);
  const weeks = nearbyWeeks(new Date(), { before: 2, after: 6 });
  if (!weeks.some((w) => toDateKey(w) === weekKey)) {
    weeks.push(weekStart);
    weeks.sort((a, b) => a.getTime() - b.getTime());
  }
  const prev = new Date(weekStart);
  prev.setDate(prev.getDate() - 7);
  const next = new Date(weekStart);
  next.setDate(next.getDate() + 7);

  const [stores, trips] = await Promise.all([
    prisma.store.findMany({
      where: { householdId: session.householdId },
      orderBy: { name: "asc" },
    }),
    prisma.shoppingTrip.findMany({
      where: { householdId: session.householdId },
      include: { store: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const tripForWeek = trips.find((t) => toDateKey(t.weekStart) === weekKey);
  const selectedTripId = params.trip || tripForWeek?.id || trips[0]?.id || null;

  const trip = selectedTripId
    ? await prisma.shoppingTrip.findFirst({
        where: { id: selectedTripId, householdId: session.householdId },
        include: {
          store: true,
          items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        },
      })
    : null;

  const grouped = trip ? groupShoppingByCategory(trip.items) : [];

  return (
    <div className="stack">
      <div className="plan-header">
        <div>
          <p className="eyebrow">Groceries</p>
          <h1 className="plan-title">Shopping list</h1>
          <p className="lede" style={{ margin: "0.25rem 0 0" }}>
            Pick the week you’re shopping for, then generate a list grouped by store section.
          </p>
        </div>
        <div className="row plan-week-nav">
          <Link className="btn btn-secondary btn-compact" href={`/shop?week=${toDateKey(prev)}`}>
            ←
          </Link>
          <Link className="btn btn-secondary btn-compact" href={`/shop?week=${toDateKey(next)}`}>
            →
          </Link>
        </div>
      </div>

      {session.member.role !== "KID" && (
        <form action={generateShoppingListAction} className="panel stack">
          <div className="field">
            <label htmlFor="weekStart">Week</label>
            <select id="weekStart" name="weekStart" defaultValue={weekKey}>
              {weeks.map((week) => {
                const key = toDateKey(week);
                const current = key === toDateKey(weekStartFrom());
                const nextWeek = key === toDateKey(addDays(weekStartFrom(), 7));
                const suffix = current ? " (this week)" : nextWeek ? " (next week)" : "";
                return (
                  <option key={key} value={key}>
                    Week of {format(week, "MMM d")}
                    {suffix}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="field">
            <label htmlFor="storeId">Store</label>
            <select id="storeId" name="storeId" defaultValue={stores[0]?.id || ""}>
              <option value="">Categories only</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">
            Generate list for {weekRangeLabel(weekStart)}
          </button>
        </form>
      )}

      {trips.length > 1 ? (
        <div className="row" style={{ flexWrap: "wrap" }}>
          {trips.map((t) => (
            <Link
              key={t.id}
              className={`chip ${trip?.id === t.id ? "" : ""}`}
              href={`/shop?week=${toDateKey(t.weekStart)}&trip=${t.id}`}
              style={trip?.id === t.id ? { background: "var(--accent)", color: "white" } : undefined}
            >
              {format(t.weekStart, "MMM d")}
              {t.store ? ` · ${t.store.name}` : ""}
            </Link>
          ))}
        </div>
      ) : null}

      {!trip ? (
        <div className="panel">
          <p className="lede" style={{ margin: 0 }}>
            No shopping trip yet for this week. Add recipes to the plan, then generate a list.
          </p>
        </div>
      ) : (
        <>
          <div className="panel">
            <strong>
              Week of {format(trip.weekStart, "MMM d")}
              {trip.store ? ` · ${trip.store.name}` : ""}
            </strong>
            <div className="lede" style={{ margin: 0, fontSize: "0.9rem" }}>
              {trip.items.filter((i) => i.checked).length}/{trip.items.length} checked · grouped by
              category
            </div>
          </div>

          {grouped.map((group) => (
            <section key={group.key} className="panel aisle-group">
              <h3>{group.label}</h3>
              {group.items.map((item) => (
                <form
                  key={item.id}
                  action={toggleShoppingItemAction}
                  className={`shop-item ${item.checked ? "checked" : ""}`}
                >
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    aria-label="Toggle"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: "2px solid var(--accent)",
                      background: item.checked ? "var(--accent)" : "transparent",
                      marginTop: 2,
                    }}
                  />
                  <div>
                    <strong>
                      {[item.quantity, item.unit].filter(Boolean).join(" ")} {item.name}
                    </strong>
                    <div className="lede" style={{ margin: 0, fontSize: "0.8rem" }}>
                      {item.aisleNumber != null
                        ? `Aisle ${item.aisleNumber}${item.aisleName ? ` · ${item.aisleName}` : ""}`
                        : group.label}
                      {item.sources?.length ? ` · ${item.sources.join(", ")}` : ""}
                    </div>
                  </div>
                  <span />
                </form>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
