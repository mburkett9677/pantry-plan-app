import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDateKey, weekStartFrom } from "@/lib/dates";
import {
  generateShoppingListAction,
  toggleShoppingItemAction,
} from "@/app/actions";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const weekStart = weekStartFrom();

  const [stores, trips] = await Promise.all([
    prisma.store.findMany({
      where: { householdId: session.householdId },
      orderBy: { name: "asc" },
    }),
    prisma.shoppingTrip.findMany({
      where: { householdId: session.householdId },
      include: { store: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const trip =
    (params.trip
      ? trips.find((t) => t.id === params.trip) ||
        (await prisma.shoppingTrip.findFirst({
          where: { id: params.trip, householdId: session.householdId },
          include: { store: true, items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
        }))
      : trips[0]
        ? await prisma.shoppingTrip.findFirst({
            where: { id: trips[0].id },
            include: { store: true, items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
          })
        : null);

  const grouped = new Map<string, NonNullable<typeof trip>["items"]>();
  if (trip) {
    for (const item of trip.items) {
      const key =
        item.aisleNumber != null
          ? `Aisle ${item.aisleNumber}${item.aisleName ? ` · ${item.aisleName}` : ""}`
          : "Uncategorized";
      const list = grouped.get(key) || [];
      list.push(item);
      grouped.set(key, list);
    }
  }

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Groceries</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
          Shopping list
        </h1>
        <p className="lede">
          Built from this week’s planned recipes, sorted by your store’s aisle map.
        </p>
      </div>

      {session.member.role !== "KID" && (
        <form action={generateShoppingListAction} className="panel stack">
          <input type="hidden" name="weekStart" value={toDateKey(weekStart)} />
          <div className="field">
            <label htmlFor="storeId">Store</label>
            <select id="storeId" name="storeId" defaultValue={stores[0]?.id || ""}>
              <option value="">No aisle sorting</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">
            Generate from this week
          </button>
        </form>
      )}

      {!trip ? (
        <div className="panel">
          <p className="lede" style={{ margin: 0 }}>
            No shopping trip yet. Add recipes to the week plan, map a store’s aisles, then generate.
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
              {trip.items.filter((i) => i.checked).length}/{trip.items.length} checked
            </div>
          </div>

          {[...grouped.entries()].map(([aisle, items]) => (
            <section key={aisle} className="panel aisle-group">
              <h3>{aisle}</h3>
              {items.map((item) => (
                <form key={item.id} action={toggleShoppingItemAction} className={`shop-item ${item.checked ? "checked" : ""}`}>
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
                      {item.category}
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
