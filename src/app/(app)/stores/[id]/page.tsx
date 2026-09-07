import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdult } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteAisleAction, upsertAisleAction } from "@/app/actions";

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdult();
  const { id } = await params;
  const store = await prisma.store.findFirst({
    where: { id, householdId: session.householdId },
    include: { aisles: { orderBy: { number: "asc" } } },
  });
  if (!store) notFound();

  return (
    <div className="stack">
      <Link className="btn btn-ghost" href="/stores">
        ← Stores
      </Link>
      <div>
        <p className="eyebrow">Aisle map</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
          {store.name}
        </h1>
        <p className="lede">
          Tip: categories should match recipe ingredient categories like produce, dairy, meat,
          seafood, bakery, frozen, pantry, spices, beverages, snacks.
        </p>
      </div>

      <form action={upsertAisleAction} className="panel stack">
        <input type="hidden" name="storeId" value={store.id} />
        <div className="row">
          <div className="field" style={{ flex: "0 0 90px" }}>
            <label htmlFor="number">Aisle #</label>
            <input id="number" name="number" type="number" min={1} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="name">Label</label>
            <input id="name" name="name" placeholder="Dairy" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="categories">Categories (comma-separated)</label>
          <input id="categories" name="categories" placeholder="dairy, eggs, cheese" required />
        </div>
        <button className="btn btn-primary" type="submit">
          Add aisle
        </button>
      </form>

      {store.aisles.map((aisle) => (
        <article key={aisle.id} className="panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
              Aisle {aisle.number} · {aisle.name}
            </strong>
            <form action={deleteAisleAction}>
              <input type="hidden" name="id" value={aisle.id} />
              <input type="hidden" name="storeId" value={store.id} />
              <button className="btn btn-danger" type="submit">
                Delete
              </button>
            </form>
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {aisle.categories.map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
          <form action={upsertAisleAction} className="stack">
            <input type="hidden" name="id" value={aisle.id} />
            <input type="hidden" name="storeId" value={store.id} />
            <input type="hidden" name="number" value={aisle.number} />
            <input type="hidden" name="name" value={aisle.name} />
            <div className="field">
              <label>Update categories</label>
              <input name="categories" defaultValue={aisle.categories.join(", ")} />
            </div>
            <button className="btn btn-secondary" type="submit">
              Save categories
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}
