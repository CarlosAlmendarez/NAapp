import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Ping ligero para monitoreo y para mantener "despierta" la base Neon
// (se suspende tras inactividad y el primer request luego es lento). Lo
// invoca el cron de Vercel (ver vercel.json). No expone datos.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
