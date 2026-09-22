"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
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
import { parseDateKey, toDateKey, weekStartFrom } from "@/lib/dates";
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
  const sourceText = String(formData.get("sourceText") || formData.get("sourceText") || "").trim();
  const parsed = await parseRecipeText(sourceText);
  const title = String(formData.get("title") || parsed.title).trim() || parsed.title;
  const instructionsOverride = String(formData.get("instructions") || "").trim();
  const recipe = await prisma.recipe.create({
    data: {
      householdId: session.householdId,
      title,
      sourceText,
      instructions: instructionsOverride || parsed.instructions || null,
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


export async function updateRecipeInstructionsAction(formData: FormData) {
  const session = await requireAdult();
  const id = String(formData.get("id") || "");
  const instructions = String(formData.get("instructions") || "").trim();
  await prisma.recipe.updateMany({
    where: { id, householdId: session.householdId },
    data: { instructions: instructions || null },
  });
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
  redirect(`/recipes/${id}?saved=1`);
}

export async function deleteRecipeAction(formData: FormData) {
  const session = await requireAdult();
  const id = String(formData.get("id") || "");
  await prisma.recipe.deleteMany({ where: { id, householdId: session.householdId } });
  revalidatePath("/recipes");
  