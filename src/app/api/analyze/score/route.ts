import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { UsageFeature } from "@prisma/client";
import { AnalyzeInputSchema } from "@/server/analyze/schema";
import { calculateScore } from "@/server/analyze/score";
import { usageGuard } from "@/server/usage/guard";
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
        console.error("[score] Validation error:", err.errors);
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
      feature: UsageFeature.SCORE,
      asin: input.asin
    });

    if (!guardResult.ok) {
      return NextResponse.json(
        { ok: false, error: guardResult.reason?.toUpperCase(), message: guardResult.message },
        { status: 403 }
      );
    }

    // Calculate score
    const result = await calculateScore(input);

    // Save to database
    const run = await prisma.analyzeRun.create({
      data: {
        userId,
        feature: UsageFeature.SCORE,
        asin: input.asin,
        scoreTotal: result.scoreTotal,
        payloadJson: JSON.stringify(input),
        resultJson: JSON.stringify(result)
      }
    });

    // Record usage
    await prisma.usageEvent.create({
      data: {
        userId,
        feature: UsageFeature.SCORE,
        asin: input.asin
      }
    });

    return NextResponse.json({ ok: true, runId: run.id, result });
  } catch (err) {
    console.error("[score] Error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "スコア計算に失敗しました。" },
      { status: 500 }
    );
  }
}
