import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const startTime = Date.now();
  let dbOk = false;

  try {
    // Simple DB check: SELECT 1
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    console.error("[health] DB check failed:", err);
    dbOk = false;
  }

  const elapsed = Date.now() - startTime;

  return NextResponse.json(
    {
      ok: true,
      env: process.env.NODE_ENV || "development",
      timeISO: new Date().toISOString(),
      version: process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
      db: dbOk,
      elapsed: `${elapsed}ms`
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key"
      }
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key"
    }
  });
}
