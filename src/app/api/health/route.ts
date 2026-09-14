import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Ping ligero para monitoreo externo (uptime checks). Sin cron de Vercel
// (el plan Hobby solo permite crons diarios, insuficiente para mantener
// despierta la base Neon); el primer request tras inactividad puede ser
// lento, mitigado por `conReintento` en `db-retry.ts`. No expone datos.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
