import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UsageFeature } from "@prisma/client";
import { AnalyzeInputSchema } from "@/server/analyze/schema";
import { calculateScore } from "@/server/analyze/score";
import { analyzeSuper } from "@/server/analyze/super";
import { usageGuardWithDb } from "@/server/usage/guard";
import { getUsageStatusWithDb } from "@/server/usage/usageStatus";
import { getEnv } from "@/lib/env";
import { CombinedResponseSchema } from "@/server/analyze/responseSchema";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// Extension用の入力スキーマ（score-extensionと同じ）
const ExtensionInputSchema = z.object({
  asin: z.string().min(1),
  url: z.string().optional(),
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  imageUrls: z.array(z.string().url()).optional(),
  hasAplus: z.boolean().optional(),
  reviewCount: z.number().int().min(0).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  images: z.object({
    main: z.object({
      url: z.string().url(),
      width: z.number().optional(),
      height: z.number().optional(),
      bgIsWhite: z.boolean().optional(),
      fillRatio: z.number().min(0).max(1).optional()
    }).nullable().optional(),
    subs: z.array(z.object({
      url: z.string().url(),
      width: z.number().optional(),
      height: z.number().optional()
    })).optional(),
    hasVideo: z.boolean().optional()
  }).optional(),
  aplus: z.object({
    hasAPlus: z.boolean(),
    moduleCount: z.number().int().min(0).optional(),
    isPremium: z.boolean().optional()
  }).optional(),
  brand: z.object({
    hasBrandStory: z.boolean().optional()
  }).optional(),
  description: z.string().optional(),
  reviews: z.object({
    averageRating: z.number().min(0).max(5).optional(),
    totalCount: z.number().int().min(0).optional()
  }).optional(),
  aPlusContent: z.boolean().optional(),
  brandContent: z.boolean().optional()
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
  
  // dryRunチェック（開発環境のみ）
  const url = new URL(req.url);
  const dryRun = isDev && url.searchParams.get("dryRun") === "1";

  try {
    const env = getEnv();
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== env.EXTENSION_API_KEY) {
      console.error(`[super-extension][${requestId}] UNAUTHORIZED: Invalid API key`);
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
      console.error(`[super-extension][${requestId}] Invalid JSON body:`, err);
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

    const { userId, ...inputData } = body;
    
    if (!userId) {
      console.error(`[super-extension][${requestId}] USER_ID_REQUIRED`);
      return NextResponse.json(
        { 
          ok: false, 
          error: "USER_ID_REQUIRED",
          requestId,
          message: "userId is required"
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
      validatedInput = ExtensionInputSchema.parse(inputData);
    } catch (err) {
      if (err instanceof ZodError) {
        console.error(`[super-extension][${requestId}] Validation error:`, err.errors);
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

    // 入力データをAnalyzeInput形式に変換（score-extensionと同じロジック）
    let images: Array<{ url: string; width?: number; height?: number; bgIsWhite?: boolean; fillRatio?: number }> = [];
    let subImageHasVideo: boolean | undefined = undefined;
    
    if (validatedInput.images && typeof validatedInput.images === 'object' && 'main' in validatedInput.images) {
      if (validatedInput.images.main) {
        images.push({
          url: validatedInput.images.main.url,
          ...(validatedInput.images.main.width && { width: validatedInput.images.main.width }),
          ...(validatedInput.images.main.height && { height: validatedInput.images.main.height }),
          ...(validatedInput.images.main.bgIsWhite !== undefined && { bgIsWhite: validatedInput.images.main.bgIsWhite }),
          ...(validatedInput.images.main.fillRatio !== undefined && { fillRatio: validatedInput.images.main.fillRatio })
        });
      }
      if (validatedInput.images.subs && Array.isArray(validatedInput.images.subs)) {
        validatedInput.images.subs.forEach((sub: any) => {
          images.push({
            url: sub.url,
            ...(sub.width && { width: sub.width }),
            ...(sub.height && { height: sub.height })
          });
        });
      }
      if (validatedInput.images.hasVideo !== undefined) {
        subImageHasVideo = validatedInput.images.hasVideo;
      }
    } else {
      const imageUrls: string[] = validatedInput.imageUrls || [];
      images = imageUrls.length > 0
        ? imageUrls.map((url: string) => ({ url }))
        : [];
    }

    const bullets = validatedInput.bullets || [];
    const description = validatedInput.description || bullets.join("\n");

    const reviews = validatedInput.reviews || {};
    if (validatedInput.reviewCount !== null && validatedInput.reviewCount !== undefined) {
      reviews.totalCount = validatedInput.reviewCount;
    }
    if (validatedInput.rating !== null && validatedInput.rating !== undefined) {
      reviews.averageRating = validatedInput.rating;
    }

    let inputImages: any = null;
    if (validatedInput.images && typeof validatedInput.images === 'object' && 'subs' in validatedInput.images) {
      inputImages = {
        ...(validatedInput.images.main && { main: validatedInput.images.main }),
        subs: Array.isArray(validatedInput.images.subs) ? validatedInput.images.subs : []
      };
    } else {
      inputImages = images.length > 0 ? images : [];
    }
    
    const input: any = {
      asin: validatedInput.asin,
      url: validatedInput.url,
      title: validatedInput.title || "",
      images: inputImages,
      description,
      reviews: Object.keys(reviews).length > 0 ? reviews : {}
    };
    
    if (subImageHasVideo !== undefined) {
      input.subImageHasVideo = subImageHasVideo;
    }

    if (validatedInput.aplus) {
      input.aPlusContent = validatedInput.aplus.hasAPlus;
      input.aplusModuleCount = validatedInput.aplus.moduleCount;
      input.aplusIsPremium = validatedInput.aplus.isPremium;
    } else {
      if (validatedInput.aPlusContent !== undefined) {
        input.aPlusContent = validatedInput.aPlusContent;
      } else if (validatedInput.hasAplus !== undefined) {
        input.aPlusContent = validatedInput.hasAplus;
      }
    }

    if (validatedInput.brand) {
      input.brandContent = validatedInput.brand.hasBrandStory;
    } else {
      if (validatedInput.brandContent !== undefined) {
        input.brandContent = validatedInput.brandContent;
      }
    }

    const analyzeInput: any = {
      ...input
    };
    
    if (input.images && typeof input.images === 'object' && 'subs' in input.images) {
      analyzeInput.images = input.images;
    } else if (Array.isArray(input.images)) {
      analyzeInput.images = input.images.length > 0 ? input.images : [];
    } else {
      analyzeInput.images = [];
    }

    if (dryRun) {
      console.log(`[super-extension][${requestId}] DRY RUN MODE: Skipping usage guard and usage consumption`);
    }

    // Usage guard（dryRun時はスキップ）
    let usageStatus;
    if (!dryRun) {
      const guardResult = await usageGuardWithDb(
        {
          userId,
          feature: UsageFeature.SUPER,
          asin: input.asin
        },
        prisma
      );

      if (!guardResult.ok) {
        usageStatus = await getUsageStatusWithDb(userId, prisma);
        console.warn(`[super-extension][${requestId}] Usage guard failed:`, guardResult.reason);
        return NextResponse.json(
          {
            ok: false,
            code: guardResult.code || "LIMIT_EXCEEDED",
            error: guardResult.reason?.toUpperCase() || "LIMIT",
            requestId,
            message: guardResult.message,
            feature: guardResult.feature,
            resetAt: guardResult.resetAt,
            usage: usageStatus
          },
          { 
            status: 402, // 402 Payment Required (制限超過)
            headers: { "x-request-id": requestId }
          }
        );
      }
    }

    // Calculate Score first (Scoreが0点でもSuperは必ず返す)
    const scoreResult = await calculateScore(analyzeInput);
    
    // Calculate Super
    const superResult = await analyzeSuper(analyzeInput, scoreResult.scoreTotal);

    // 開発環境では計算結果をログ出力
    if (isDev) {
      console.log(`[super-extension][${requestId}] Score result:`, JSON.stringify(scoreResult, null, 2));
      console.log(`[super-extension][${requestId}] Super result:`, JSON.stringify(superResult, null, 2));
    }

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
      totalScore: scoreResult.scoreTotal + superResult.total,
      ...(dryRun && { dryRun: true, message: "Dry run mode - usage not consumed" })
    };

    // Zod検証
    const validatedResponse = CombinedResponseSchema.parse(responseData);

    // Save to database（dryRun時も保存するが、usage消費はしない）
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

    // Record usage（dryRun時はスキップ）
    if (!dryRun) {
      await prisma.usageEvent.create({
        data: {
          userId,
          feature: UsageFeature.SUPER,
          asin: input.asin
        }
      });
    }

    // Usage statusを取得
    usageStatus = await getUsageStatusWithDb(userId, prisma);

    console.log(`[super-extension][${requestId}] Success: runId=${run.id}, asin=${input.asin}, totalScore=${validatedResponse.totalScore}, dryRun=${dryRun}`);

    // runIdを設定
    validatedResponse.runId = run.id;

    return NextResponse.json(
      {
        ...validatedResponse,
        usage: usageStatus
      },
      {
        headers: {
          "x-request-id": requestId,
          "x-usage-remaining-score": String(
            usageStatus.remaining.scoreThisMonth ?? 99999
          ),
          "x-usage-remaining-super": String(usageStatus.remaining.superThisMonth),
          "x-usage-remaining-improve": String(usageStatus.remaining.improveThisMonth),
          "x-reset-date-month": usageStatus.resetsAt.month
        }
      }
    );
  } catch (err) {
    const prismaError = formatPrismaError(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    if (prismaError) {
      console.error(`[super-extension][${requestId}] Prisma error:`, {
        code: prismaError.code,
        message: prismaError.message,
        stack: errorStack
      });
    } else {
      console.error(`[super-extension][${requestId}] Error:`, {
        message: errorMessage,
        stack: errorStack
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL",
        requestId,
        message: isDev ? errorMessage : "Super分析に失敗しました。",
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
