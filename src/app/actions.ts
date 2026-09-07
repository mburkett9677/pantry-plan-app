"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  clearSession,
  createSession,
  hashPin,
  makeInviteCode,
  requireAdult,
  requireSession,
  verifyPin,
} from "@/lib/auth";
import { parseRecipeText } from "@/lib/parse-recipe";
import { aggregateIngredients, matchAisle, sortShoppingByAisle } from "@/lib/shopping";
import { parseDateKey, weekStartFrom } from "@/lib/dates";
import { syncMealsToSkylight, testSkylightConnection } from "@/lib/skylight";
import type { MealSlot, MemberRole } from "@prisma/client";

export async function createHouseholdAction(formData: FormData) {
  const householdName = String(formData.get("householdName") || "").trim();
  const adminName = String(formData.get("adminName") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  if (!householdName || !adminName) {
    return;
  }
  const household = await prisma.household.create({
    data: {
      name: householdName,
      inviteCode: makeInviteCode(),
      members: {
        create: {
          name: adminName,
          role: "ADMIN",
          pinHash: pin ? await hashPin(pin) : null,
          color: "#2a6f5e",
        },
      },
    },
    include: { members: true },
  });
  await createSession(household.id, household.members[0].id);
  redirect("/plan");
}

export async function joinHouseholdAction(formData: FormData) {
  const inviteCode = String(formData.get("inviteCode") || "")
    .trim()
    .toUpperCase();
  const name = String(formData.get("name") || "").trim();
  const role = (String(formData.get("role") || "KID") as MemberRole) || "KID";
  const pin = String(formData.get("pin") || "").trim();
  if (!inviteCode || !name) return;

  const household = await prisma.household.findUnique({ where: { inviteCode } });
  if (!household) return;

  const existing = await prisma.member.findUnique({
    where: { householdId_name: { householdId: household.id, name } },
  });

  let member = existing;
  if (member) {
    const ok = await verifyPin(pin, member.pinHash);
    if (!ok) return;
  } else {
    member = await prisma.member.create({
      data: {
        householdId: household.id,
        name,
        role: role === "ADMIN" ? "PARENT" : role,
        pinHash: pin ? await hashPin(pin) : null,
      },
    });
  }

  await createSession(household.id, member.id);
  redirect(member.role === "KID" ? "/lunch" : "/plan");
}

export async function switchMemberAction(formData: FormData) {
  const session = await requireSession();
  const memberId = String(formData.get("memberId") || "");
  const pin = String(formData.get("pin") || "");
  const member = await prisma.member.findFirst({
    where: { id: memberId, householdId: session.householdId },
  });
  if (!member) return;
  const ok = await verifyPin(pin, member.pinHash);
  if (!ok) return;
  await createSession(session.householdId, member.id);
  redirect(member.role === "KID" ? "/lunch" : "/plan");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function addMemberAction(formData: FormData) {
  const session = await requireAdult();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "KID") as MemberRole;
  const pin = String(formData.get("pin") || "").trim();
  if (!name) return;
  await prisma.member.create({
    data: {
      householdId: session.householdId,
      name,
      role: role === "ADMIN" ? "PARENT" : role,
      pinHash: pin ? await hashPin(pin) : null,
    },
  });
  revalidatePath("/settings");
}

export async function saveRecipeAction(formData: FormData) {
  const session = await requireAdult();
  const sourceText = String(formData.get("sourceText") || "");
  const parsed = await parseRecipeText(sourceText);
  const title = String(formData.get("title") || parsed.title).trim() || parsed.title;
  const recipe = await prisma.recipe.create({
    data: {
      householdId: session.householdId,
      title,
      sourceText,
      instructions: parsed.instructions,
      servings: parsed.servings ?? undefined,
      ingredients: {
        create: parsed.ingredients.map((ing, index) => ({
          name: ing.name,
          quantity: ing.quantity || undefined,
          unit: ing.unit || undefined,
          notes: ing.notes || undefined,
          category: ing.category || "other",
          sortOrder: index,
        })),
      },
    },
  });
  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

export async function deleteRecipeAction(formData: FormData) {
  const session = await requireAdult();
  const id = String(formData.get("id") || "");
  await prisma.recipe.deleteMany({ where: { id, householdId: session.householdId } });
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function upsertPlannedMealAction(formData: FormData) {
  const session = await requireSession();
  const date = String(formData.get("date") || "");
  const slot = String(formData.get("slot") || "DINNER") as MealSlot;
  const title = String(formData.get("title") || "").trim();
  const recipeId = String(formData.get("recipeId") || "") || null;
  const id = String(formData.get("id") || "") || null;
  if (!date || !title) return;

  if (id) {
    await prisma.plannedMeal.updateMany({
      where: { id, householdId: session.householdId },
      data: {
        title,
        slot,
        date: parseDateKey(date),
        recipeId,
        requestedById: session.memberId,
      },
    });
  } else {
    await prisma.plannedMeal.create({
      data: {
        householdId: session.householdId,
        date: parseDateKey(date),
        slot,
        title,
        recipeId,
        requestedById: session.memberId,
      },
    });
  }
  revalidatePath("/plan");
  revalidatePath("/lunch");
}

export async function deletePlannedMealAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") || "");
  await prisma.plannedMeal.deleteMany({ where: { id, householdId: session.householdId } });
  revalidatePath("/plan");
}

export async function createLunchRequestAction(formData: FormData) {
  const session = await requireSession();
  const date = String(formData.get("date") || "");
  const requestText = String(formData.get("requestText") || "").trim();
  if (!date || !requestText) return;
  await prisma.lunchRequest.create({
    data: {
      householdId: session.householdId,
      memberId: session.memberId,
      date: parseDateKey(date),
      requestText,
    },
  });
  // Also drop onto the meal plan as lunch if adult or kid wants it visible
  await prisma.plannedMeal.create({
    data: {
      householdId: session.householdId,
      date: parseDateKey(date),
      slot: "LUNCH",
      title: `${session.member.name}: ${requestText}`,
      requestedById: session.memberId,
    },
  });
  revalidatePath("/lunch");
  revalidatePath("/plan");
}

export async function createStoreAction(formData: FormData) {
  const session = await requireAdult();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const store = await prisma.store.create({
    data: { householdId: session.householdId, name },
  });
  revalidatePath("/stores");
  redirect(`/stores/${store.id}`);
}

export async function upsertAisleAction(formData: FormData) {
  const session = await requireAdult();
  const storeId = String(formData.get("storeId") || "");
  const number = Number(formData.get("number") || 0);
  const name = String(formData.get("name") || "").trim() || `Aisle ${number}`;
  const categories = String(formData.get("categories") || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const id = String(formData.get("id") || "") || null;

  const store = await prisma.store.findFirst({
    where: { id: storeId, householdId: session.householdId },
  });
  if (!store) return;
  if (!number || number < 1) return;

  if (id) {
    await prisma.aisle.update({
      where: { id },
      data: { number, name, categories, sortOrder: number },
    });
  } else {
    await prisma.aisle.create({
      data: {
        storeId,
        number,
        name,
        categories,
        sortOrder: number,
      },
    });
  }
  revalidatePath(`/stores/${storeId}`);
}

export async function deleteAisleAction(formData: FormData) {
  const session = await requireAdult();
  const id = String(formData.get("id") || "");
  const storeId = String(formData.get("storeId") || "");
  const store = await prisma.store.findFirst({
    where: { id: storeId, householdId: session.householdId },
  });
  if (!store) return;
  await prisma.aisle.deleteMany({ where: { id, storeId } });
  revalidatePath(`/stores/${storeId}`);
}

export async function generateShoppingListAction(formData: FormData) {
  const session = await requireAdult();
  const storeId = String(formData.get("storeId") || "") || null;
  const weekStartRaw = String(formData.get("weekStart") || "");
  const weekStart = weekStartRaw ? parseDateKey(weekStartRaw) : weekStartFrom();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const meals = await prisma.plannedMeal.findMany({
    where: {
      householdId: session.householdId,
      date: { gte: weekStart, lte: weekEnd },
      recipeId: { not: null },
    },
    include: { recipe: { include: { ingredients: true } } },
  });

  const ingredients = meals.flatMap((meal) =>
    (meal.recipe?.ingredients || []).map((ing) => ({
      ...ing,
      recipeTitle: meal.recipe?.title || meal.title,
    })),
  );

  // Also include freeform meal titles without recipes as reminder lines? skip for now.
  const aggregated = aggregateIngredients(ingredients);
  const aisles = storeId
    ? await prisma.aisle.findMany({ where: { storeId }, orderBy: { number: "asc" } })
    : [];

  const trip = await prisma.shoppingTrip.create({
    data: {
      householdId: session.householdId,
      storeId,
      weekStart,
      items: {
        create: sortShoppingByAisle(
          aggregated.map((item) => {
            const aisle = matchAisle(item.category, aisles);
            return {
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category: item.category,
              aisleNumber: aisle?.number ?? null,
              aisleName: aisle?.name ?? null,
              sources: item.sources,
              sortOrder: aisle?.number ?? 9999,
            };
          }),
        ),
      },
    },
  });

  revalidatePath("/shop");
  redirect(`/shop?trip=${trip.id}`);
}

export async function toggleShoppingItemAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") || "");
  const item = await prisma.shoppingItem.findFirst({
    where: { id, trip: { householdId: session.householdId } },
  });
  if (!item) return;
  await prisma.shoppingItem.update({
    where: { id },
    data: { checked: !item.checked },
  });
  revalidatePath("/shop");
}

export async function saveSkylightSettingsAction(formData: FormData) {
  const session = await requireAdult();
  if (session.member.role !== "ADMIN" && session.member.role !== "PARENT") {
    return;
  }
  const email = String(formData.get("skylightEmail") || "").trim();
  const password = String(formData.get("skylightPassword") || "").trim();
  const frameId = String(formData.get("skylightFrameId") || "").trim();
  const enabled = String(formData.get("skylightEnabled") || "") === "on";

  await prisma.household.update({
    where: { id: session.householdId },
    data: {
      skylightEmail: email || null,
      skylightPassword: password || null,
      skylightFrameId: frameId || null,
      skylightEnabled: enabled,
    },
  });
  revalidatePath("/settings");
}

export async function testSkylightAction() {
  const session = await requireAdult();
  const h = session.household;
  if (!h.skylightEmail || !h.skylightPassword || !h.skylightFrameId) {
    return;
  }
  try {
    await testSkylightConnection({
      email: h.skylightEmail,
      password: h.skylightPassword,
      frameId: h.skylightFrameId,
    });
  } catch {
    // Connection errors surface in logs; UI keeps settings form simple for MVP.
  }
}

export async function syncWeekToSkylightAction(formData: FormData) {
  const session = await requireAdult();
  const h = session.household;
  if (!h.skylightEnabled || !h.skylightEmail || !h.skylightPassword || !h.skylightFrameId) {
    return;
  }
  const weekStartRaw = String(formData.get("weekStart") || "");
  const weekStart = weekStartRaw ? parseDateKey(weekStartRaw) : weekStartFrom();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const meals = await prisma.plannedMeal.findMany({
    where: {
      householdId: session.householdId,
      date: { gte: weekStart, lte: weekEnd },
    },
    include: { recipe: { include: { ingredients: true } } },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });

  const payload = meals.map((meal) => ({
    date: meal.date.toISOString().slice(0, 10),
    slot: meal.slot.toLowerCase() as "breakfast" | "lunch" | "dinner" | "snack",
    title: meal.title,
    recipe: meal.recipe
      ? {
          title: meal.recipe.title,
          instructions: meal.recipe.instructions,
          ingredients: meal.recipe.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
          })),
        }
      : undefined,
  }));

  try {
    await syncMealsToSkylight({
      email: h.skylightEmail,
      password: h.skylightPassword,
      frameId: h.skylightFrameId,
      meals: payload,
    });
  } catch {
    // Sync failures are non-blocking in MVP form posts.
  }
}
