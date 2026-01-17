import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { generateImprovementPlan } from "@/server/analyze/improvementPlan";
import { usageGuardWithDb } from "@/server/usage/guard";
import { getUsageStatusWithDb } from "@/server/usage/usageStatus";
import { UsageFeature } from "@prisma/client";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// 入力スキーマ
const ImprovementPlanInputSchema = z.object({
  runId: z.string().optional(), // runIdから結果を取得する場合
  score: z.object({
    scoreTotal: z.number().min(0).max(100),
    breakdown: z.record(
      z.string(),
      z.object({
        score: z.number().min(0),
        max: z.number().min(0),
      })
    ),
    notes: z.array(z.string()).optional(),
    missingSignals: z.array(z.string()).optional(),
  }).optional(),
  super: z.object({
    total: z.number().min(0).max(100),
    breakdown: z.object({
      main_image: z.number().min(0).max(20),
      title: z.number().min(0).max(10),
      sub_images: z.number().min(0).max(30),
      reviews: z.number().min(0).max(10),
      aplus_brand: z.number().min(0).max(30),
    }),
    analyses: z.any().optional(),
    observations: z.object({
      main_image: z.array(z.string()).optional(),
      sub_images: z.array(z.string()).optional(),
      aplus: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
  productTitle: z.string().optional(),
  negativeReviews: z.array(z.string()).optional(),
});

function generateRequestId(): string {
  return crypto.randomUUID();
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

function formatPrismaError(err: unknown): { code?: string; message: string } | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      code: err.code,
      message: err.message
    };
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return {
      message: err.message
    };
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      message: err.message
    };
  }
  return null;
}

export async function POST(req: Request) {
  const requestId = generateRequestId();
  const isDev = isDevelopment();

  try {
    const env = getEnv();
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== env.EXTENSION_API_KEY) {
      console.error(`[improvement-plan][${requestId}] UNAUTHORIZED: Invalid API key`);
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED", requestId },
        { 
          status: 401,
          headers: { "x-request-id": requestId }
        }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch (err) {
      console.error(`[improvement-plan][${requestId}] Invalid JSON body:`, err);
      return NextResponse.json(
        { 
          ok: false, 
          error: "INVALID_REQUEST",
          requestId,
          message: "Invalid JSON body"
        },
        { 
          status: 400,
          headers: { "x-request-id": requestId }
        }
      );
    }

    // Zod validation
    let validatedInput: any;
    try {
      validatedInput = ImprovementPlanInputSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        console.error(`[improvement-plan][${requestId}] Validation error:`, err.errors);
        return NextResponse.json(
          {
            ok: false,
            error: "VALIDATION_ERROR",
            requestId,
            message: "Invalid input data",
            ...(isDev && { details: err.errors })
          },
          {
            status: 400,
            headers: { "x-request-id": requestId }
          }
        );
      }
      throw err;
    }

    // userIdの取得（runIdから、またはbodyから）
    let userId: string | undefined = body.userId;

    let scoreResult: any = null;
    let superResult: any = null;
    let productTitle: string | undefined = undefined;
    let observations: any = undefined;
    let negativeReviews: string[] | undefined = undefined;

    // runIdが指定されている場合はDBから取得
    if (validatedInput.runId) {
      const run = await prisma.analyzeRun.findUnique({
        where: { id: validatedInput.runId },
      });

      if (!run || !run.resultJson) {
        return NextResponse.json(
          {
            ok: false,
            error: "NOT_FOUND",
            requestId,
            message: "指定されたrunIdの分析結果が見つかりません",
          },
          {
            status: 404,
            headers: { "x-request-id": requestId }
          }
        );
      }

      // runIdからuserIdを取得（usageGuardで使用）
      userId = run.userId;

      const resultData = JSON.parse(run.resultJson);
      scoreResult = resultData.score;
      superResult = resultData.super;
      productTitle = resultData.score?.title || (run.payloadJson ? JSON.parse(run.payloadJson).title : undefined);
      observations = superResult?.observations;
    } else if (validatedInput.score && validatedInput.super) {
      // score/superが直接指定されている場合
      scoreResult = validatedInput.score;
      superResult = validatedInput.super;
      productTitle = validatedInput.productTitle;
      observations = validatedInput.super.observations;
      negativeReviews = validatedInput.negativeReviews;
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_REQUEST",
          requestId,
          message: "runIdまたはscore/superのいずれかが必要です",
        },
        {
          status: 400,
          headers: { "x-request-id": requestId }
        }
      );
    }

    if (!scoreResult || !superResult) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_REQUEST",
          requestId,
          message: "score/superの分析結果が必要です",
        },
        {
          status: 400,
          headers: { "x-request-id": requestId }
        }
      );
    }

    // Usage guard（improveMonthlyのチェック）
    let usageStatus;
    if (userId) {
      const guardResult = await usageGuardWithDb(
        {
          userId,
          feature: UsageFeature.IMPROVE
        },
        prisma
      );

      if (!guardResult.ok) {
        usageStatus = await getUsageStatusWithDb(userId, prisma);
        console.warn(`[improvement-plan][${requestId}] Usage guard failed:`, {
          reason: guardResult.reason,
          planKey: guardResult.planKey,
          message: guardResult.message,
          feature: guardResult.feature,
          resetAt: guardResult.resetAt,
        });
        return NextResponse.json(
          {
            ok: false,
            code: guardResult.code || "LIMIT_EXCEEDED",
            error: guardResult.reason?.toUpperCase() || "LIMIT",
            requestId,
            message: guardResult.message,
            feature: guardResult.feature,
            resetAt: guardResult.resetAt,
            planKey: guardResult.planKey, // プラン情報を追加
            usage: usageStatus
          },
          { 
            status: 402, // 402 Payment Required (制限超過)
            headers: { "x-request-id": requestId }
          }
        );
      }

      // Usage eventを記録
      await prisma.usageEvent.create({
        data: {
          userId,
          feature: UsageFeature.IMPROVE
        }
      });

      // Usage statusを取得
      usageStatus = await getUsageStatusWithDb(userId, prisma);
    }

    // 改善計画を生成
    const improvementPlan = await generateImprovementPlan(
      scoreResult,
      superResult,
      {
        productTitle: productTitle,
        mainImageObservations: observations?.main_image,
        subImageObservations: observations?.sub_images,
        aplusObservations: observations?.aplus,
        negativeReviews: negativeReviews,
      }
    );

    if (isDev) {
      console.log(`[improvement-plan][${requestId}] Generated improvement plan:`, JSON.stringify(improvementPlan, null, 2));
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        improvement_plan: improvementPlan,
        ...(usageStatus && { usage: usageStatus })
      },
      {
        headers: {
          "x-request-id": requestId,
          ...(usageStatus && {
            "x-usage-remaining-improve": String(usageStatus.remaining.improveThisMonth),
            "x-reset-date-month": usageStatus.resetsAt.month
          })
        }
      }
    );
  } catch (err) {
    const prismaError = formatPrismaError(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    if (prismaError) {
      console.error(`[improvement-plan][${requestId}] Prisma error:`, {
        code: prismaError.code,
        message: prismaError.message,
        stack: errorStack
      });
    } else {
      console.error(`[improvement-plan][${requestId}] Error:`, {
        message: errorMessage,
        stack: errorStack
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL",
        requestId,
        message: isDev ? errorMessage : "改善計画の生成に失敗しました。",
        ...(isDev && {
          stack: errorStack,
          ...(prismaError && {
            prismaCode: prismaError.code,
            prismaMessage: prismaError.message
          })
        })
      },
      {
        status: 500,
        headers: { "x-request-id": requestId }
      }
    );
  }
}
