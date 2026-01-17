import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UsageFeature } from "@prisma/client";
import { AnalyzeInputSchema } from "@/server/analyze/schema";
import { calculateScore } from "@/server/analyze/score";
import { analyzeDeep } from "@/server/analyze/deep";
import { usageGuardWithDb } from "@/server/usage/guard";
import { getUsageStatusWithDb } from "@/server/usage/usageStatus";
import { getEnv } from "@/lib/env";

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
    const env = getEnv();
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== env.EXTENSION_API_KEY) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, ...inputData } = body;
    
    if (!userId) {
      return NextResponse.json({ ok: false, error: "USER_ID_REQUIRED" }, { status: 400 });
    }

    const input = AnalyzeInputSchema.parse(inputData);

    // Usage guard
    const guardResult = await usageGuardWithDb(
      {
        userId,
        feature: UsageFeature.DEEP,
        asin: input.asin
      },
      prisma
    );

    if (!guardResult.ok) {
      const usageStatus = await getUsageStatusWithDb(userId, prisma);
      return NextResponse.json(
        {
          ok: false,
          error: guardResult.reason?.toUpperCase(),
          message: guardResult.message,
          usage: usageStatus
        },
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

    const usageStatus = await getUsageStatusWithDb(userId, prisma);

    // Generate request ID for debugging
    const requestId = crypto.randomUUID();

    return NextResponse.json(
      {
        ok: true,
        runId: run.id,
        result: { ...baseResult, ...deepResult },
        usage: usageStatus
      },
      {
        headers: {
          "x-request-id": requestId,
          "x-usage-remaining-score": String(
            usageStatus.planKey === "FREE"
              ? usageStatus.remaining.scoreThisMonth ?? 0
              : usageStatus.remaining.scoreToday ?? 0
          ),
          "x-usage-remaining-deep": String(usageStatus.remaining.deepThisMonth),
          "x-usage-remaining-super": String(usageStatus.remaining.superThisMonth),
          "x-reset-date-score": usageStatus.planKey === "FREE"
            ? usageStatus.resetsAt.month
            : usageStatus.resetsAt.scoreDay,
          "x-reset-date-month": usageStatus.resetsAt.month
        }
      }
    );
  } catch (err) {
    console.error("[deep-extension] Error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Deep分析に失敗しました。" },
      { status: 500 }
    );
  }
}
*/
