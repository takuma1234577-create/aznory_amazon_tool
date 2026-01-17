import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { UsageFeature } from "@prisma/client";
import { AnalyzeInputSchema } from "@/server/analyze/schema";
import { calculateScore } from "@/server/analyze/score";
import { analyzeDeep } from "@/server/analyze/deep";
import { usageGuard } from "@/server/usage/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Deep Researchは廃止されました。Super Researchを使用してください。
  return NextResponse.json(
    { 
      ok: false, 
      error: "DEPRECATED",
      message: "Deep Researchは廃止されました。Super Researchを使用してください。" 
    },
    { status: 410 } // 410 Gone
  );
}

/* 旧実装（無効化）
export async function POST_OLD(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const input = AnalyzeInputSchema.parse(body);

    // Usage guard
    const guardResult = await usageGuard({
      userId,
      feature: UsageFeature.DEEP,
      asin: input.asin
    });

    if (!guardResult.ok) {
      return NextResponse.json(
        { ok: false, error: guardResult.reason?.toUpperCase(), message: guardResult.message },
        { status: 403 }
      );
    }

    // Calculate base score first
    const baseResult = await calculateScore(input);
    const deepResult = await analyzeDeep(input, baseResult.scoreTotal);

    // Save to database
    const run = await prisma.analyzeRun.create({
      data: {
        userId,
        feature: UsageFeature.DEEP,
        asin: input.asin,
        scoreTotal: deepResult.score150_total,
        payloadJson: JSON.stringify(input),
        resultJson: JSON.stringify({ ...baseResult, ...deepResult })
      }
    });

    // Record usage
    await prisma.usageEvent.create({
      data: {
        userId,
        feature: UsageFeature.DEEP,
        asin: input.asin
      }
    });

    return NextResponse.json({ ok: true, runId: run.id, result: { ...baseResult, ...deepResult } });
  } catch (err) {
    console.error("[deep] Error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Deep分析に失敗しました。" },
      { status: 500 }
    );
  }
}
*/
