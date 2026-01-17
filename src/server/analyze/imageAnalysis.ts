/**
 * Gemini 1.5 Pro 完結型 画像分析パイプライン
 * 
 * Gemini 1.5 Pro (vision) を一回呼び出すだけで、
 * 画像解析から「断定的な評価・改善案」までを出力
 */

import { callGeminiVision, fetchImageAsBase64, VisionInput } from "../llm/geminiClient";
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// ===== Gemini 評価レポート（Markdown形式） =====

export interface ImageEvaluationReport {
  cvrGrade: "S" | "A" | "B" | "C" | "D";
  overallJudgment: string;
  benefitDesign: {
    score: number;
    max: number;
    judgment: string;
    rewriteSuggestion: string;
  };
  designTone: {
    score: number;
    max: number;
    judgment: string;
    correctionInstruction: string;
  };
  visibility: {
    score: number;
    max: number;
    judgment: string;
    deletionEmphasisSuggestion: string;
  };
  actionableTasks: string[];
  fullMarkdown: string;
}

// ===== Gemini System Prompt（断定型コンサルタント） =====

const GEMINI_CONSULTANT_PROMPT = `あなたはAmazon物販で月商1,000万円以上のブランドを数多く手がける、世界最高峰の「画像CVR最適化コンサルタント」です。
提供されたサブ画像を、スマホで閲覧する顧客の視点で厳しく査定し、改善案を提示してください。

### 判定の鉄則（重要）
- 「仮定」「推測」「確認できないため」という言葉は一切禁止。画像から見える事実を「正」として100%言い切ること。
- ターゲットはスマホユーザー（7割以上）。スマホ画面での「1秒以内の自分事化」を最優先基準とする。

### 分析・判定項目
1. ベネフィット設計 (Score: /5)
   - 機能の説明（スペック）に留まっていないか？
   - 「それを使うとどうなるか（未来の姿）」が直感的に脳に届くか？
2. デザイン・世界観 (Score: /5)
   - フォントの太さ(Weight)、配色、質感はターゲット層に適切か？（例：筋トレなら力強い極太ゴシック、高級感なら細身の明朝体など）
   - 背景と文字のコントラストが確保されており、ブランドの格を下げていないか？
3. スマホ視認性・情報設計 (Score: /5)
   - 文字占有率は適切か？（2026年トレンド：モバイル文字サイズ60pt相当以上を推奨）
   - 視線誘導（Zの法則、Fの法則）に基づき、メインコピーが埋没していないか？

### 出力フォーマット
--------------------------------------------------
**【総合判定】 CVR貢献度: [S/A/B/C/D] ランク**

**1. ベネフィット設計: [点数]/5**
- **断定判定**: [画像内のコピーや要素を具体的に挙げ、良い・悪いを言い切る]
- **リライト案**: [CVRを高めるための具体的な文言修正案]

**2. デザイン・世界観: [点数]/5**
- **断定判定**: [フォント、配色、レイアウトのミスマッチを指摘]
- **修正指示**: [「フォントをBoldからExtraBoldへ」「配色を黄色からオレンジへ」など具体的に]

**3. スマホ視認性・情報設計: [点数]/5**
- **断定判定**: [スマホ画面での情報の多さ、読みにくさを指摘]
- **削除・強調案**: [「右下のスペック表を削除しろ」「メインコピーを1.2倍にしろ」など]

**4. デザイナーへの具体的な修正タスク (To-Do)**:
- [ ] 指示1
- [ ] 指示2
- [ ] 指示3
--------------------------------------------------`;

/**
 * Gemini 1.5 Proで画像を解析し、断定的な評価・改善案を生成
 * 
 * @param imageUrl 画像URL
 * @param imageBase64 画像のbase64データ（URLの代わりに使用可能）
 * @param mimeType 画像のMIMEタイプ（base64使用時）
 * @returns 評価レポート（Markdown形式）
 */
export async function analyzeImageWithGemini(
  imageUrl?: string,
  imageBase64?: string,
  mimeType?: string
): Promise<ImageEvaluationReport> {
  if (!imageUrl && !imageBase64) {
    throw new Error("Either imageUrl or imageBase64 must be provided");
  }

  // 画像をbase64に変換
  let base64Data: string;
  let finalMimeType: string;

  if (imageBase64) {
    base64Data = imageBase64;
    finalMimeType = mimeType || "image/jpeg";
  } else if (imageUrl) {
    const fetched = await fetchImageAsBase64(imageUrl);
    base64Data = fetched.base64;
    finalMimeType = fetched.mimeType;
  } else {
    throw new Error("Image data is required");
  }

  // Gemini Vision APIを呼び出し（safety_settingsを設定）
  const visionInput: VisionInput = {
    imageBase64: base64Data,
    mimeType: finalMimeType,
  };

  const markdownReport = await callGeminiVisionWithSafety(
    GEMINI_CONSULTANT_PROMPT,
    [visionInput],
    {
      temperature: 0.7, // 創造性と断定性のバランス
      maxOutputTokens: 3000, // 詳細なレポートのため増やす
    }
  );

  // Markdownから構造化データを抽出
  const report = parseMarkdownReport(markdownReport);

  return {
    ...report,
    fullMarkdown: markdownReport,
  };
}

/**
 * Gemini Vision APIを呼び出し（safety_settings付き）
 */
async function callGeminiVisionWithSafety(
  prompt: string,
  images: VisionInput[],
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const { getEnv } = await import("@/lib/env");

  const env = getEnv();
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: "gemini-1.5-pro",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });

  // Convert images to Gemini format
  const imageParts = await Promise.all(
    images.map(async (img) => {
      if (img.imageBase64) {
        return {
          inlineData: {
            data: img.imageBase64,
            mimeType: img.mimeType || "image/jpeg",
          },
        };
      } else if (img.imageUrl) {
        const { base64, mimeType } = await fetchImageAsBase64(img.imageUrl);
        return {
          inlineData: {
            data: base64,
            mimeType: mimeType,
          },
        };
      }
      throw new Error("Image must have either imageUrl or imageBase64");
    })
  );

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 3000,
    },
  });

  const response = result.response;
  const text = response.text();
  if (!text) {
    throw new Error("Gemini Vision returned empty response");
  }

  return text;
}

/**
 * Markdownレポートをパースして構造化データに変換
 */
function parseMarkdownReport(markdown: string): Omit<ImageEvaluationReport, "fullMarkdown"> {
  // CVR貢献度を抽出
  const cvrGradeMatch = markdown.match(/CVR貢献度:\s*([SABCD])/i);
  const cvrGrade = (cvrGradeMatch?.[1]?.toUpperCase() || "C") as "S" | "A" | "B" | "C" | "D";

  // 総合判定を抽出
  const overallMatch = markdown.match(/【総合判定】\s*CVR貢献度:\s*[SABCD]\s*ランク\s*\n([^\n]+)/i);
  const overallJudgment = overallMatch?.[1]?.trim() || "";

  // 1. ベネフィット設計を抽出
  const benefitMatch = markdown.match(/\*\*1\.\s*ベネフィット設計:\s*(\d+)\/5\*\*\s*\n- \*\*断定判定\*\*:\s*([^\n]+)\s*\n- \*\*リライト案\*\*:\s*([^\n]+)/i);
  const benefitDesign = {
    score: benefitMatch?.[1] ? parseInt(benefitMatch[1], 10) : 0,
    max: 5,
    judgment: benefitMatch?.[2]?.trim() || "",
    rewriteSuggestion: benefitMatch?.[3]?.trim() || "",
  };

  // 2. デザイン・世界観を抽出
  const designMatch = markdown.match(/\*\*2\.\s*デザイン・世界観:\s*(\d+)\/5\*\*\s*\n- \*\*断定判定\*\*:\s*([^\n]+)\s*\n- \*\*修正指示\*\*:\s*([^\n]+)/i);
  const designTone = {
    score: designMatch?.[1] ? parseInt(designMatch[1], 10) : 0,
    max: 5,
    judgment: designMatch?.[2]?.trim() || "",
    correctionInstruction: designMatch?.[3]?.trim() || "",
  };

  // 3. スマホ視認性・情報設計を抽出
  const visibilityMatch = markdown.match(/\*\*3\.\s*スマホ視認性・情報設計:\s*(\d+)\/5\*\*\s*\n- \*\*断定判定\*\*:\s*([^\n]+)\s*\n- \*\*削除・強調案\*\*:\s*([^\n]+)/i);
  const visibility = {
    score: visibilityMatch?.[1] ? parseInt(visibilityMatch[1], 10) : 0,
    max: 5,
    judgment: visibilityMatch?.[2]?.trim() || "",
    deletionEmphasisSuggestion: visibilityMatch?.[3]?.trim() || "",
  };

  // 4. デザイナーへの具体的な修正タスクを抽出
  const tasksMatch = markdown.match(/\*\*4\.\s*デザイナーへの具体的な修正タスク[^\n]*:\s*\n([\s\S]*?)(?=---|$)/i);
  const tasksText = tasksMatch?.[1] || "";
  const actionableTasks = tasksText
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => {
      // チェックボックス形式の行を抽出（- [ ] または - [x] で始まる行）
      return /^-\s*\[[\sx]\]/.test(line);
    })
    .map((line) => line.replace(/^-\s*\[[\sx]\]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3); // 最大3つまで

  return {
    cvrGrade,
    overallJudgment,
    benefitDesign,
    designTone,
    visibility,
    actionableTasks,
  };
}

// ===== パイプライン統合関数（後方互換性のため） =====

/**
 * Gemini 1.5 Pro 完結型 画像分析パイプライン
 * 
 * @param imageUrl 画像URL
 * @param imageBase64 画像のbase64データ（URLの代わりに使用可能）
 * @param mimeType 画像のMIMEタイプ（base64使用時）
 * @returns 評価レポート（Markdown形式）
 */
export async function analyzeImagePipeline(
  imageUrl?: string,
  imageBase64?: string,
  mimeType?: string
): Promise<{
  evaluation: ImageEvaluationReport;
}> {
  console.log("[ImageAnalysis] Analyzing image with Gemini 1.5 Pro (single-step)...");
  
  const evaluation = await analyzeImageWithGemini(imageUrl, imageBase64, mimeType);
  
  console.log("[ImageAnalysis] Analysis completed:", {
    cvrGrade: evaluation.cvrGrade,
    benefitScore: evaluation.benefitDesign.score,
    designScore: evaluation.designTone.score,
    visibilityScore: evaluation.visibility.score,
    tasksCount: evaluation.actionableTasks.length,
  });

  return {
    evaluation,
  };
}
