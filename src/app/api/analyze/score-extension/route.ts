import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UsageFeature } from "@prisma/client";
import { AnalyzeInputSchema } from "@/server/analyze/schema";
import { calculateScore } from "@/server/analyze/score";
import { usageGuardWithDb } from "@/server/usage/guard";
import { getUsageStatusWithDb } from "@/server/usage/usageStatus";
import { getEnv } from "@/lib/env";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// Extension用の入力スキーマ（title/urlを含み、images等はオプショナル）
const ExtensionInputSchema = z.object({
  asin: z.string().min(1),
  url: z.string().optional(),
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  imageUrls: z.array(z.string().url()).optional(), // 後方互換性のため
  hasAplus: z.boolean().optional(), // 後方互換性のため
  reviewCount: z.number().int().min(0).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  // 新しい画像構造
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
  // 新しいA+構造
  aplus: z.object({
    hasAPlus: z.boolean(),
    moduleCount: z.number().int().min(0).optional(),
    isPremium: z.boolean().optional()
  }).optional(),
  // 新しいブランド構造
  brand: z.object({
    hasBrandStory: z.boolean().optional()
  }).optional(),
  // 旧形式（後方互換性のため）
  images_old: z.array(
    z.object({
      url: z.string().url(),
      imageBase64: z.string().optional(),
      backgroundWhiteRatio: z.number().min(0).max(1).optional(),
      subjectOccupancyRatio: z.number().min(0).max(1).optional()
    })
  ).optional(),
  description: z.string().optional(),
  reviews: z.object({
    averageRating: z.number().min(0).max(5).optional(),
    totalCount: z.number().int().min(0).optional()
  }).optional(),
  aPlusContent: z.boolean().optional(), // 後方互換性のため
  brandContent: z.boolean().optional() // 後方互換性のため
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
      console.error(`[score-extension][${requestId}] UNAUTHORIZED: Invalid API key`);
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
      console.error(`[score-extension][${requestId}] Invalid JSON body:`, err);
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
    
    // 開発環境では受け取ったpayloadをログ出力
    if (isDev) {
      console.log(`[score-extension][${requestId}] Received payload:`, JSON.stringify(inputData, null, 2));
    }
    
    if (!userId) {
      console.error(`[score-extension][${requestId}] USER_ID_REQUIRED`);
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

    // Zod validation（失敗時は400を返す）
    let validatedInput: any;
    try {
      validatedInput = ExtensionInputSchema.parse(inputData);
    } catch (err) {
      if (err instanceof ZodError) {
        console.error(`[score-extension][${requestId}] Validation error:`, err.errors);
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
      throw err; // Zod以外のエラーは再スロー
    }

    // missingSignalsの収集はcalculateScore内で行う
    // route側では400エラーを返さず、常に200を返してcalculateScoreに処理を委ねる

    // 新しい画像構造（images.main/subImages）を処理
    let images: Array<{ url: string; width?: number; height?: number; imageBase64?: string; backgroundWhiteRatio?: number; subjectOccupancyRatio?: number; bgIsWhite?: boolean; fillRatio?: number }> = [];
    let subImageHasVideo: boolean | undefined = undefined;
    
    if (validatedInput.images && typeof validatedInput.images === 'object' && 'main' in validatedInput.images) {
      // 新しい構造: { main: {url,width,height,bgIsWhite,fillRatio}, subs: [{url,width,height}], hasVideo }
      if (validatedInput.images.main) {
        images.push({
          url: validatedInput.images.main.url,
          ...(validatedInput.images.main.width && { width: validatedInput.images.main.width }),
          ...(validatedInput.images.main.height && { height: validatedInput.images.main.height }),
          ...(validatedInput.images.main.bgIsWhite !== undefined && { bgIsWhite: validatedInput.images.main.bgIsWhite }),
          ...(validatedInput.images.main.fillRatio !== undefined && { fillRatio: validatedInput.images.main.fillRatio })
        });
      }
      // subsが空配列でも必ず設定する（必ず配列として返す）
      if (validatedInput.images.subs && Array.isArray(validatedInput.images.subs)) {
        validatedInput.images.subs.forEach((sub: any) => {
          images.push({
            url: sub.url,
            ...(sub.width && { width: sub.width }),
            ...(sub.height && { height: sub.height })
          });
        });
      }
      // hasVideo情報を保存
      if (validatedInput.images.hasVideo !== undefined) {
        subImageHasVideo = validatedInput.images.hasVideo;
      }
    } else {
      // 旧形式: imageUrls または images_old（配列）
      const imageUrls: string[] = validatedInput.imageUrls || [];
      images = imageUrls.length > 0
        ? imageUrls.map((url: string) => ({ url }))
        : (Array.isArray(validatedInput.images) ? validatedInput.images : []);
    }

    // bulletsをdescriptionに変換（既存のscoreロジックに合わせる）
    const bullets = validatedInput.bullets || [];
    const description = validatedInput.description || bullets.join("\n");

    // reviews情報を構築（extensionから送られてきたreviewCount/ratingを使用）
    const reviews = validatedInput.reviews || {};
    if (validatedInput.reviewCount !== null && validatedInput.reviewCount !== undefined) {
      reviews.totalCount = validatedInput.reviewCount;
    }
    if (validatedInput.rating !== null && validatedInput.rating !== undefined) {
      reviews.averageRating = validatedInput.rating;
    }

    // 新しい構造（images.main/subs）を優先的に使用
    let inputImages: any = null;
    if (validatedInput.images && typeof validatedInput.images === 'object' && 'subs' in validatedInput.images) {
      // 新しい構造: { main: {...}, subs: [...] }
      inputImages = {
        ...(validatedInput.images.main && { main: validatedInput.images.main }),
        subs: Array.isArray(validatedInput.images.subs) ? validatedInput.images.subs : []
      };
      console.log(`[score-extension][${requestId}] Using new image structure:`, {
        main: inputImages.main ? {
          url: inputImages.main.url,
          width: inputImages.main.width,
          height: inputImages.main.height,
          bgIsWhite: inputImages.main.bgIsWhite,
          fillRatio: inputImages.main.fillRatio
        } : null,
        subsCount: inputImages.subs.length,
        subsWithDimensions: inputImages.subs.filter((s: any) => s.width && s.height).length
      });
    } else {
      // 旧形式: images配列
      inputImages = images.length > 0 ? images : [];
      console.log(`[score-extension][${requestId}] Using old image array structure:`, inputImages.length);
    }
    
    const input: any = {
      asin: validatedInput.asin,
      url: validatedInput.url,
      title: validatedInput.title || "",
      images: inputImages,
      description,
      reviews: Object.keys(reviews).length > 0 ? reviews : {}
    };
    
    // subImageHasVideoをinputに追加
    if (subImageHasVideo !== undefined) {
      input.subImageHasVideo = subImageHasVideo;
    }

    // A+情報（新しい構造を優先）
    if (validatedInput.aplus) {
      input.aPlusContent = validatedInput.aplus.hasAPlus;
      input.aplusModuleCount = validatedInput.aplus.moduleCount;
      input.aplusIsPremium = validatedInput.aplus.isPremium;
    } else {
      // 後方互換性: 旧形式
      if (validatedInput.aPlusContent !== undefined) {
        input.aPlusContent = validatedInput.aPlusContent;
      } else if (validatedInput.hasAplus !== undefined) {
        input.aPlusContent = validatedInput.hasAplus;
      }
    }

    // ブランドコンテンツ情報（新しい構造を優先）
    if (validatedInput.brand) {
      input.brandContent = validatedInput.brand.hasBrandStory;
    } else {
      // 後方互換性: 旧形式
      if (validatedInput.brandContent !== undefined) {
        input.brandContent = validatedInput.brandContent;
      }
    }

    // AnalyzeInputSchemaに適合させる
    // 注意: 新しい構造（{ main, subs }）の場合はそのまま使用、旧形式（配列）の場合は空配列でもOK
    const analyzeInput: any = {
      ...input
    };
    
    // 新しい構造の場合はそのまま使用、旧形式の場合は配列として処理
    if (input.images && typeof input.images === 'object' && 'subs' in input.images) {
      // 新しい構造: { main: {...}, subs: [...] } をそのまま使用
      analyzeInput.images = input.images;
    } else if (Array.isArray(input.images)) {
      // 旧形式: 配列として処理
      analyzeInput.images = input.images.length > 0 ? input.images : [];
    } else {
      // どちらでもない場合は空配列
      analyzeInput.images = [];
    }

    // 開発環境では正規化後の入力をログ出力
    if (isDev) {
      console.log(`[score-extension][${requestId}] Normalized input for calculateScore:`, JSON.stringify(analyzeInput, null, 2));
    }
    
    if (dryRun) {
      console.log(`[score-extension][${requestId}] DRY RUN MODE: Skipping usage guard and usage consumption`);
    }

    // Usage guard（dryRun時はスキップ）
    let usageStatus;
    if (!dryRun) {
      const guardResult = await usageGuardWithDb(
        {
          userId,
          feature: UsageFeature.SCORE,
          asin: input.asin
        },
        prisma
      );

      if (!guardResult.ok) {
        usageStatus = await getUsageStatusWithDb(userId, prisma);
        console.warn(`[score-extension][${requestId}] Usage guard failed:`, guardResult.reason);
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

    // Calculate score
    let result: any;
    try {
      result = await calculateScore(analyzeInput);
      
      // 開発環境では計算結果をログ出力
      if (isDev) {
        console.log(`[score-extension][${requestId}] Score calculation result:`, JSON.stringify(result, null, 2));
      }
    } catch (calcError: any) {
      console.error(`[score-extension][${requestId}] calculateScore error:`, {
        message: calcError?.message,
        stack: calcError?.stack,
        name: calcError?.name,
        fullError: calcError,
        inputKeys: Object.keys(analyzeInput || {}),
        inputImagesType: typeof analyzeInput?.images,
        inputImagesValue: analyzeInput?.images
      });
      throw calcError; // Re-throw to be caught by outer try-catch
    }

    // Save to database（dryRun時も保存するが、usage消費はしない）
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

    // 開発環境では保存されたpayloadをログ出力
    if (isDev) {
      console.log(`[score-extension][${requestId}] Saved payload in AnalyzeRun:`, JSON.stringify(input, null, 2));
    }

    // Record usage（dryRun時はスキップ）
    if (!dryRun) {
      await prisma.usageEvent.create({
        data: {
          userId,
          feature: UsageFeature.SCORE,
          asin: input.asin
        }
      });
    }

    // Usage statusを取得（dryRun時も取得するが、消費はしない）
    usageStatus = await getUsageStatusWithDb(userId, prisma);

    console.log(`[score-extension][${requestId}] Success: runId=${run.id}, asin=${input.asin}, scoreTotal=${result.scoreTotal}, dryRun=${dryRun}`);

    // 新仕様: scoreオブジェクトで返す
    const responseResult = {
      scoreTotal: result.scoreTotal,
      breakdown: result.breakdown,
      notes: result.notes ?? [],
      missingSignals: result.missingSignals ?? []
    };

    return NextResponse.json(
      {
        ok: true,
        runId: run.id,
        score: responseResult,
        usage: usageStatus,
        ...(dryRun && { dryRun: true, message: "Dry run mode - usage not consumed" })
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
    const errorCause = err instanceof Error ? err.cause : undefined;

    // Prismaエラーの場合は詳細をログに出力
    if (prismaError) {
      console.error(`[score-extension][${requestId}] Prisma error:`, {
        code: prismaError.code,
        message: prismaError.message,
        stack: errorStack,
        fullError: err
      });
    } else {
      console.error(`[score-extension][${requestId}] Error:`, {
        message: errorMessage,
        stack: errorStack,
        cause: errorCause,
        fullError: err,
        errorType: err?.constructor?.name,
        errorString: String(err)
      });
    }

    // 開発環境ではより詳細なエラー情報を返す
    const errorResponse: any = {
      ok: false,
      error: "INTERNAL",
      requestId,
      message: isDev ? errorMessage : "スコア計算に失敗しました。",
    };

    if (isDev) {
      errorResponse.stack = errorStack;
      errorResponse.cause = errorCause;
      if (prismaError) {
        errorResponse.prismaCode = prismaError.code;
        errorResponse.prismaMessage = prismaError.message;
      }
      // エラーオブジェクトの詳細情報も含める
      if (err && typeof err === 'object') {
        errorResponse.errorDetails = {
          name: (err as any).name,
          message: (err as any).message,
          ...(Object.keys(err).length > 0 && { additionalProperties: Object.keys(err) })
        };
      }
    }

    return NextResponse.json(
      errorResponse,
      {
        status: 500,
        headers: { "x-request-id": requestId }
      }
    );
  }
}
