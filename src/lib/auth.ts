import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { customAlphabet } from "nanoid";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Member, MemberRole } from "@prisma/client";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
const SESSION_COOKIE = "pantry_session";
const SESSION_DAYS = 60;

export function makeInviteCode() {
  return nanoid();
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string | null | undefined) {
  if (!hash) return true;
  return bcrypt.compare(pin, hash);
}

export async function createSession(householdId: string, memberId: string) {
  const token = customAlphabet(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    40,
  )();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await prisma.session.create({
    data: { token, householdId, memberId, expiresAt },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      household: true,
      member: true,
    },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

export async function requireAdult() {
  const session = await requireSession();
  if (session.member.role === "KID") redirect("/lunch");
  return session;
}

export function canManageStores(role: MemberRole) {
  return role === "ADMIN" || role === "PARENT";
}

export type SessionMember = Member;
