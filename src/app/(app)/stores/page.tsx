import Link from "next/link";
import { requireAdult } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStoreAction } from "@/app/actions";

export default async function StoresPage() {
  const session = await requireAdult();
  const stores = await prisma.store.findMany({
    where: { householdId: session.householdId },
    include: { _count: { select: { aisles: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">In-store map</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
          Stores & aisles
        </h1>
        <p className="lede">
          Walk your store once and tag each aisle with food types (produce, dairy, pantry…).
          Shopping lists will follow that order.
        </p>
      </div>

      <form action={createStoreAction} className="panel stack">
        <div className="field">
          <label htmlFor="name">New store</label>
          <input id="name" name="name" placeholder="Costco / Kroger / Trader Joe’s" required />
        </div>
        <button className="btn btn-primary" type="submit">
          Add store
        </button>
      </form>

      {stores.map((store) => (
        <Link key={store.id} href={`/stores/${store.id}`} className="panel row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
              {store.name}
            </strong>
            <div className="lede" style={{ margin: 0, fontSize: "0.9rem" }}>
              {store._count.aisles} aisles mapped
            </div>
          </div>
          <span className="chip">Edit</span>
        </Link>
      ))}
    </div>
  );
}
