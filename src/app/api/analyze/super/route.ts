import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { UsageFeature } from "@prisma/client";
import { AnalyzeInputSchema } from "@/server/analyze/schema";
import { calculateScore } from "@/server/analyze/score";
import { analyzeSuper } from "@/server/analyze/super";
import { usageGuard } from "@/server/usage/guard";
import { CombinedResponseSchema } from "@/server/analyze/responseSchema";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    let body: any;
    try {
      body = await req.json();
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: "INVALID_JSON", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    let input;
    try {
      input = AnalyzeInputSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        console.error("[super] Validation error:", err.errors);
        return NextResponse.json(
          {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "Invalid input data",
            ...(process.env.NODE_ENV === "development" && { details: err.errors })
          },
          { status: 400 }
        );
      }
      throw err;
    }

    // Usage guard
    const guardResult = await usageGuard({
      userId,
      feature: UsageFeature.SUPER,
      asin: input.asin
    });

    if (!guardResult.ok) {
      return NextResponse.json(
        { ok: false, error: guardResult.reason?.toUpperCase(), message: guardResult.message },
        { status: 403 }
      );
    }

    // Calculate Score first (Scoreが0点でもSuperは必ず返す)
    const scoreResult = await calculateScore(input);
    const superResult = await analyzeSuper(input, scoreResult.scoreTotal);

    // レスポンスを構築（improvement_planは含めない。別APIで生成）
    const responseData = {
      ok: true,
      runId: "", // 後で設定
      score: {
        scoreTotal: scoreResult.scoreTotal,
        breakdown: scoreResult.breakdown,
        notes: scoreResult.notes ?? [],
        missingSignals: scoreResult.missingSignals ?? []
      },
      super: {
        total: superResult.total,
        breakdown: superResult.breakdown,
        analyses: superResult.analyses,
        improvement_summary: superResult.improvement_summary,
        observations: superResult.observations // 改善計画生成用に観察結果を含める
      },
      totalScore: scoreResult.scoreTotal + superResult.total
    };

    // Zod検証
    const validatedResponse = CombinedResponseSchema.parse(responseData);

    // Save to database
    const run = await prisma.analyzeRun.create({
      data: {
        userId,
        feature: UsageFeature.SUPER,
        asin: input.asin,
        scoreTotal: validatedResponse.totalScore,
        payloadJson: JSON.stringify(input),
        resultJson: JSON.stringify(validatedResponse)
      }
    });

    // Record usage
    await prisma.usageEvent.create({
      data: {
        userId,
        feature: UsageFeature.SUPER,
        asin: input.asin
      }
    });

    // runIdを設定
    validatedResponse.runId = run.id;

    return NextResponse.json(validatedResponse);
  } catch (err) {
    console.error("[super] Error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Super分析に失敗しました。" },
      { status: 500 }
    );
  }
}
