import { NextResponse } from "next/server";
import { analyzeImagePipeline } from "@/server/analyze/imageAnalysis";
import { z } from "zod";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

// リクエストスキーマ
const ImageAnalysisRequestSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
});

/**
 * POST /api/analyze/image
 * 
 * Gemini 1.5 Pro 完結型 画像分析パイプライン
 * 
 * Request Body:
 * {
 *   "imageUrl": "https://example.com/image.jpg", // または
 *   "imageBase64": "data:image/jpeg;base64,...", // または
 *   "mimeType": "image/jpeg" // base64使用時のみ
 * }
 * 
 * Response:
 * {
 *   "ok": true,
 *   "evaluation": {
 *     "cvrGrade": "S" | "A" | "B" | "C" | "D",
 *     "overallJudgment": "...",
 *     "benefitDesign": {
 *       "score": number,
 *       "max": 5,
 *       "judgment": "...",
 *       "rewriteSuggestion": "..."
 *     },
 *     "designTone": {
 *       "score": number,
 *       "max": 5,
 *       "judgment": "...",
 *       "correctionInstruction": "..."
 *     },
 *     "visibility": {
 *       "score": number,
 *       "max": 5,
 *       "judgment": "...",
 *       "deletionEmphasisSuggestion": "..."
 *     },
 *     "actionableTasks": ["...", "...", "..."],
 *     "fullMarkdown": "..."
 *   }
 * }
 */
export async function POST(request: Request) {
  const requestId = `img-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const isDev = process.env.NODE_ENV === "development";

  try {
    const body = await request.json();
    const validated = ImageAnalysisRequestSchema.parse(body);

    if (!validated.imageUrl && !validated.imageBase64) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_INPUT",
          requestId,
          message: "Either imageUrl or imageBase64 must be provided",
        },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    console.log(`[image-analysis][${requestId}] Starting Gemini 1.5 Pro image analysis...`);

    // Gemini 1.5 Pro 完結型パイプラインを実行
    const result = await analyzeImagePipeline(
      validated.imageUrl,
      validated.imageBase64,
      validated.mimeType
    );

    console.log(`[image-analysis][${requestId}] Analysis completed:`, {
      cvrGrade: result.evaluation.cvrGrade,
      benefitScore: result.evaluation.benefitDesign.score,
      designScore: result.evaluation.designTone.score,
      visibilityScore: result.evaluation.visibility.score,
      tasksCount: result.evaluation.actionableTasks.length,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        evaluation: result.evaluation,
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`[image-analysis][${requestId}] Error:`, {
      message: errorMessage,
      stack: errorStack,
    });

    // Zodバリデーションエラー
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_INPUT",
          requestId,
          message: "Invalid request body",
          details: error.errors,
        },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL",
        requestId,
        message: isDev ? errorMessage : "画像解析に失敗しました。",
        ...(isDev && { stack: errorStack }),
      },
      {
        status: 500,
        headers: {
          "x-request-id": requestId,
        },
      }
    );
  }
}
