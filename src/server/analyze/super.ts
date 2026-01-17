import { AnalyzeInput } from "./schema";
import { callChatGPT, ChatMessage } from "../llm/openaiClient";
import { callGeminiVision, fetchImageAsBase64, VisionInput } from "../llm/geminiClient";

export interface SuperAnalysis {
  main_image?: {
    listVisibility: number; // 0-8
    visualImpact: number; // 0-5
    instantUnderstanding: number; // 0-4
    cvrBlockers: number; // 0-3
    why?: string;
  };
  title?: {
    seoStructure: number; // 0-4
    ctrDesign: number; // 0-4
    readability: number; // 0-2
    why?: string;
  };
  sub_images?: {
    benefitDesign: number; // 0-10
    worldView: number; // 0-5
    informationDesign: number; // 0-5
    textVisibility: number; // 0-5
    cvrBlockers: number; // 0-5
    why?: string;
  };
  reviews?: {
    negativeVisibility: number; // 0-4
    negativeSeverity: number; // 0-3
    reassurancePath: number; // 0-3
    why?: string;
  };
  aplus_brand?: {
    compositionDesign: number; // 0-8
    benefitAppeal: number; // 0-8
    worldView: number; // 0-6
    visualDesign: number; // 0-5
    comparisonReassurance: number; // 0-3
    why?: string;
  };
}

export interface ImprovementSummary {
  most_critical_issue?: string;
  quick_wins?: string[];
  high_impact_actions?: string[];
}

// ImprovementPlanは別ファイルで定義
export type { ImprovementPlan, ImprovementAction } from "./improvementPlan";

export interface SuperResult {
  total: number; // 0-100
  breakdown: {
    main_image: number; // 0-20
    title: number; // 0-10
    sub_images: number; // 0-30
    reviews: number; // 0-10
    aplus_brand: number; // 0-30
  };
  analyses: SuperAnalysis;
  improvement_summary?: ImprovementSummary;
  // Gemini Visionの観察結果（改善計画生成用）
  observations?: {
    main_image?: string[];
    sub_images?: string[];
    aplus?: string[];
  };
}

/**
 * Super（追加100点）を計算
 * LLM + Visionによる論理評価
 */
export async function analyzeSuper(
  input: AnalyzeInput,
  scoreTotal: number
): Promise<SuperResult> {
  const analyses: SuperAnalysis = {};
  const breakdown: SuperResult["breakdown"] = {
    main_image: 0,
    title: 0,
    sub_images: 0,
    reviews: 0,
    aplus_brand: 0,
  };

  // メイン画像とサブ画像を分離
  let mainImage: any = null;
  let subImages: any[] = [];
  
  // Type guard: Check if input.images is an object with 'main' and 'subs' properties
  if (input.images && 
      typeof input.images === 'object' && 
      !Array.isArray(input.images) &&
      'main' in input.images && 
      'subs' in input.images) {
    // Type-safe access: input.images is { main, subs } shape
    const imagesObj = input.images as { main?: any; subs?: any[] };
    mainImage = imagesObj.main ?? null;
    subImages = Array.isArray(imagesObj.subs) ? imagesObj.subs : [];
  } else if (Array.isArray(input.images)) {
    // input.images is an array
    mainImage = input.images.length > 0 ? input.images[0] : null;
    subImages = input.images.length > 1 ? input.images.slice(1) : [];
  }

  // 観察結果を保存（改善計画生成用）
  const observations: {
    main_image?: string[];
    sub_images?: string[];
    aplus?: string[];
  } = {};

  // ===== 1. メイン画像：20点 =====
  if (mainImage) {
    try {
      const mainImageUrl = (mainImage as any)?.url;
      if (mainImageUrl) {
        const result = await analyzeMainImage(mainImageUrl);
        const analysis = result.analysis ?? {
          listVisibility: 0,
          visualImpact: 0,
          instantUnderstanding: 0,
          cvrBlockers: 0,
        };
        analyses.main_image = analysis;
        observations.main_image = result.observations;
        breakdown.main_image =
          analysis.listVisibility +
          analysis.visualImpact +
          analysis.instantUnderstanding +
          analysis.cvrBlockers;
      }
    } catch (error) {
      console.error("[Super] Failed to analyze main image:", error);
      // 失敗時はLLMのみで継続
      const analysisResult = await analyzeMainImageWithLLMOnly(input, mainImage);
      const analysis = analysisResult ?? {
        listVisibility: 0,
        visualImpact: 0,
        instantUnderstanding: 0,
        cvrBlockers: 0,
      };
      analyses.main_image = analysis;
      observations.main_image = [];
      breakdown.main_image =
        analysis.listVisibility +
        analysis.visualImpact +
        analysis.instantUnderstanding +
        analysis.cvrBlockers;
    }
  }

  // ===== 2. タイトル：10点 =====
  const title = (input as any)?.title || "";
  if (title) {
    const analysis = await analyzeTitle(title, input);
    analyses.title = analysis;
    breakdown.title = analysis.seoStructure + analysis.ctrDesign + analysis.readability;
  } else {
    // タイトルが存在しない場合は0点
    analyses.title = {
      seoStructure: 0,
      ctrDesign: 0,
      readability: 0,
      why: "タイトルが取得できませんでした",
    };
    breakdown.title = 0;
  }

  // ===== 3. サブ画像：30点 =====
  if (subImages.length > 0) {
    try {
      const subImageUrls = subImages
        .slice(0, 6) // 最大6枚まで
        .map((img: any) => img?.url)
        .filter((url: string) => url);
      
      if (subImageUrls.length > 0) {
        const result = await analyzeSubImages(subImageUrls);
        analyses.sub_images = result.analysis;
        observations.sub_images = result.observations;
        breakdown.sub_images =
          result.analysis.benefitDesign +
          result.analysis.worldView +
          result.analysis.informationDesign +
          result.analysis.textVisibility +
          result.analysis.cvrBlockers;
      }
    } catch (error) {
      console.error("[Super] Failed to analyze sub images:", error);
      // 失敗時はLLMのみで継続
      const analysis = await analyzeSubImagesWithLLMOnly(input, subImages);
      analyses.sub_images = analysis;
      observations.sub_images = [];
      breakdown.sub_images =
        analysis.benefitDesign +
        analysis.worldView +
        analysis.informationDesign +
        analysis.textVisibility +
        analysis.cvrBlockers;
    }
  }

  // ===== 4. レビュー：10点 =====
  // 注意: レビューは最大10件まで、星1-3のネガティブレビューのみ
  // 実際のレビューデータはinputに含まれていないため、レビュー数と評価のみで判断
  // TODO: 将来的にネガティブレビュー本文を取得できるようになったら、それを渡す
  const reviewCount = input.reviews?.totalCount || 0;
  const rating = input.reviews?.averageRating;
  const negativeReviews: string[] | undefined = undefined; // 将来的に実装
  
  if (reviewCount === 0) {
    // 対象レビューが0件の場合は10点満点
    breakdown.reviews = 10;
    analyses.reviews = {
      negativeVisibility: 4,
      negativeSeverity: 3,
      reassurancePath: 3,
      why: "レビューが0件のため、ネガティブレビューの影響なし",
    };
  } else {
    const analysis = await analyzeReviewsWithLLM(reviewCount, rating, negativeReviews);
    analyses.reviews = analysis;
    breakdown.reviews =
      analysis.negativeVisibility +
      analysis.negativeSeverity +
      analysis.reassurancePath;
  }

  // ===== 5. A+コンテンツ＋ブランド：30点 =====
  const aplusInfo = {
    hasAplus: input.aPlusContent || false,
    isPremium: (input as any).aplusIsPremium || false,
    moduleCount: (input as any).aplusModuleCount || 0,
    hasBrand: input.brandContent || false,
  };

  // A+コンテンツの画像URL（将来的にinputに含まれる可能性がある）
  const aplusImageUrls: string[] | undefined = (input as any).aplusImageUrls;

  const result = await analyzeAplusBrandWithLLM(aplusInfo, input, aplusImageUrls);
  analyses.aplus_brand = result.analysis;
  observations.aplus = result.observations;
  breakdown.aplus_brand =
    result.analysis.compositionDesign +
    result.analysis.benefitAppeal +
    result.analysis.worldView +
    result.analysis.visualDesign +
    result.analysis.comparisonReassurance;

  const total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

  // 改善提案のサマリーを生成（全セクションの分析結果から）
  const improvementSummary = await generateImprovementSummary(analyses, input);

  return {
    total,
    breakdown,
    analyses,
    improvement_summary: improvementSummary,
    observations, // Gemini Visionの観察結果を保存
  };
}

// ===== Improvement Summary Generator =====

async function generateImprovementSummary(
  analyses: SuperAnalysis,
  input: AnalyzeInput
): Promise<ImprovementSummary> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "あなたはAmazon商品ページ改善のトップコンサルタントです。分析結果から改善提案をまとめてください。",
    },
    {
      role: "user",
      content: `以下のSuper分析結果をもとに、改善提案のサマリーを生成してください。

【分析結果】
${JSON.stringify(analyses, null, 2)}

【出力形式（JSON厳守）】
{
  "most_critical_issue": "最も致命的な問題を1つ（50文字以内）",
  "quick_wins": ["すぐに改善できる項目（最大3つ）"],
  "high_impact_actions": ["高インパクトな改善アクション（最大3つ）"]
}

注意：
- 抽象論は禁止
- 実務で実行可能な具体的な改善案にする
- 各項目は簡潔に（1項目30文字以内）`,
    },
  ];

  try {
    const response = await callChatGPT(messages);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        most_critical_issue: parsed.most_critical_issue || undefined,
        quick_wins: Array.isArray(parsed.quick_wins) ? parsed.quick_wins.slice(0, 3) : undefined,
        high_impact_actions: Array.isArray(parsed.high_impact_actions) ? parsed.high_impact_actions.slice(0, 3) : undefined,
      };
    }
  } catch (error) {
    console.error("[Super] Failed to generate improvement summary:", error);
  }

  return {};
}

// ===== Helper Functions =====

async function analyzeMainImage(imageUrl: string): Promise<{
  analysis: SuperAnalysis["main_image"];
  observations: string[];
}> {
  try {
    // Step 1: Gemini Visionで視覚的な観察を取得（点数は出さない）
    const imageBase64 = await fetchImageAsBase64(imageUrl);
    const geminiPrompt = `You are a visual UX and e-commerce conversion expert.

Analyze the following Amazon product main image visually.
Do NOT score. Do NOT summarize.
Only provide concrete visual observations.

Focus on:
- Visibility when shown small in a grid
- Depth, lighting, contrast
- Instant clarity of what the product is

Output rules:
- No opinions like "good" or "bad" alone
- Describe what is visible and how it affects clarity or attention
- Bullet points only

Output format (JSON):
{
  "main_image_observations": string[]
}`;

    const geminiResponse = await callGeminiVision(geminiPrompt, [
      { imageBase64: imageBase64.base64, mimeType: imageBase64.mimeType },
    ]);

    let geminiObservations: string[] = [];
    const geminiJsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
    if (geminiJsonMatch) {
      const geminiParsed = JSON.parse(geminiJsonMatch[0]);
      geminiObservations = geminiParsed.main_image_observations || [];
    }

    // Step 2: ChatGPTで点数を決定（Geminiの観察結果を参考に）
    const chatGptPrompt = `あなたはAmazon商品ページ改善のトップコンサルタントです。
以下の商品ページ情報をもとに、「CVRが上がる構造か」を論理的に評価してください。

【重要な前提】
- これは感想や要約ではありません
- Amazonで「実際に売れるかどうか」を基準に判断してください
- 点数は必ず理由（why）とセットで出してください
- Score（ルールベース）とは役割が異なります

【入力情報】
- mainImage: メイン画像URL: ${imageUrl}

【Gemini Visionによる視覚観察】
${geminiObservations.map((obs, i) => `${i + 1}. ${obs}`).join("\n")}

【評価対象：メイン画像（20点）】
以下の4つの観点で評価してください：
1. 一覧で目立つか（CTR）: 0-8点
2. 立体感・視覚インパクト: 0-5点
3. 一瞬で商品理解できるか: 0-4点
4. CVRを下げる要素はないか: 0-3点（阻害要因が少ないほど高得点）

【出力ルール（厳守）】
- 点数は必ず理由（why）とセットで出してください
- 点数は指定された最大点数を超えない
- 抽象論は禁止（「良い」「弱い」だけはNG）
- 実務で改善できる指摘にする

【出力形式（JSON厳守）】
{
  "listVisibility": 0-8,
  "visualImpact": 0-5,
  "instantUnderstanding": 0-4,
  "cvrBlockers": 0-3,
  "why": "各項目の採点理由を具体的に説明（抽象論禁止）"
}`;

    const chatGptMessages: ChatMessage[] = [
      {
        role: "system",
        content: "あなたはAmazon商品ページ改善のトップコンサルタントです。CVRが上がる構造かを論理的に評価し、点数と理由を必ずセットで出力してください。",
      },
      {
        role: "user",
        content: chatGptPrompt,
      },
    ];

    const chatGptResponse = await callChatGPT(chatGptMessages);
    const chatGptJsonMatch = chatGptResponse.match(/\{[\s\S]*\}/);
    if (chatGptJsonMatch) {
      const parsed = JSON.parse(chatGptJsonMatch[0]);
      return {
        analysis: {
          listVisibility: Math.max(0, Math.min(8, parsed.listVisibility || 0)),
          visualImpact: Math.max(0, Math.min(5, parsed.visualImpact || 0)),
          instantUnderstanding: Math.max(0, Math.min(4, parsed.instantUnderstanding || 0)),
          cvrBlockers: Math.max(0, Math.min(3, parsed.cvrBlockers || 0)),
          why: parsed.why || "",
        },
        observations: geminiObservations,
      };
    }
  } catch (error) {
    console.error("[Super] Failed to analyze main image:", error);
    // フォールバック: LLMのみで継続
    const fallbackAnalysis = await analyzeMainImageWithLLMOnly({} as AnalyzeInput, { url: imageUrl });
    return {
      analysis: fallbackAnalysis,
      observations: [],
    };
  }

  // フォールバック
  return {
    analysis: {
      listVisibility: 4,
      visualImpact: 2,
      instantUnderstanding: 2,
      cvrBlockers: 1,
      why: "画像分析に失敗したため、デフォルト値を使用",
    },
    observations: [],
  };
}

async function analyzeMainImageWithLLMOnly(
  input: AnalyzeInput,
  mainImage: any
): Promise<SuperAnalysis["main_image"]> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "あなたはAmazon商品ページ改善のトップコンサルタントです。CVRが上がる構造かを論理的に評価し、点数と理由を必ずセットで出力してください。",
    },
    {
      role: "user",
      content: `あなたはAmazon商品ページ改善のトップコンサルタントです。
以下の商品ページ情報をもとに、「CVRが上がる構造か」を論理的に評価してください。

【重要な前提】
- これは感想や要約ではありません
- Amazonで「実際に売れるかどうか」を基準に判断してください
- 点数は必ず理由（why）とセットで出してください
- Score（ルールベース）とは役割が異なります

【入力情報】
- mainImage: メイン画像URL: ${(mainImage as any)?.url || "不明"}
- サイズ: ${(mainImage as any)?.width || "不明"} x ${(mainImage as any)?.height || "不明"}
- 背景が白: ${(mainImage as any)?.bgIsWhite || "不明"}

注意: 画像の視覚的分析はできませんが、提供された情報から推測して評価してください。

【評価対象：メイン画像（20点）】
以下の4つの観点で評価してください：
1. 一覧で目立つか（CTR）: 0-8点
2. 立体感・視覚インパクト: 0-5点
3. 一瞬で商品理解できるか: 0-4点
4. CVRを下げる要素はないか: 0-3点（阻害要因が少ないほど高得点）

【出力ルール（厳守）】
- 点数は必ず理由（why）とセットで出してください
- 点数は指定された最大点数を超えない
- 抽象論は禁止（「良い」「弱い」だけはNG）
- 実務で改善できる指摘にする

【出力形式（JSON厳守）】
{
  "listVisibility": 0-8,
  "visualImpact": 0-5,
  "instantUnderstanding": 0-4,
  "cvrBlockers": 0-3,
  "why": "各項目の採点理由を具体的に説明（抽象論禁止）"
}`,
    },
  ];

  const response = await callChatGPT(messages);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      listVisibility: Math.max(0, Math.min(8, parsed.listVisibility || 0)),
      visualImpact: Math.max(0, Math.min(5, parsed.visualImpact || 0)),
      instantUnderstanding: Math.max(0, Math.min(4, parsed.instantUnderstanding || 0)),
      cvrBlockers: Math.max(0, Math.min(3, parsed.cvrBlockers || 0)),
      why: parsed.why || "",
    };
  }

  return {
    listVisibility: 4,
    visualImpact: 2,
    instantUnderstanding: 2,
    cvrBlockers: 1,
    why: "LLM分析に失敗したため、デフォルト値を使用",
  };
}

async function analyzeTitle(
  title: string,
  input: AnalyzeInput
): Promise<SuperAnalysis["title"]> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "あなたはAmazon商品ページ改善のトップコンサルタントです。CVRが上がる構造かを論理的に評価し、点数と理由を必ずセットで出力してください。",
    },
    {
      role: "user",
      content: `あなたはAmazon商品ページ改善のトップコンサルタントです。
以下の商品ページ情報をもとに、「CVRが上がる構造か」を論理的に評価してください。

【重要な前提】
- これは感想や要約ではありません
- Amazonで「実際に売れるかどうか」を基準に判断してください
- 点数は必ず理由（why）とセットで出してください
- Score（ルールベース）とは役割が異なります

【入力情報】
- title: "${title}"

【評価対象：タイトル（10点）】
以下の3つの観点で評価してください：
1. SEOとCTRの両立: 0-4点（前半に主要KWが来ているか）
2. CTR設計: 0-4点（読みやすく、クリック理由があるか）
3. 可読性: 0-2点

【出力ルール（厳守）】
- 点数は必ず理由（why）とセットで出してください
- 点数は指定された最大点数を超えない
- 抽象論は禁止（「良い」「弱い」だけはNG）
- 実務で改善できる指摘にする

【出力形式（JSON厳守）】
{
  "seoStructure": 0-4,
  "ctrDesign": 0-4,
  "readability": 0-2,
  "why": "各項目の採点理由を具体的に説明（抽象論禁止）"
}`,
    },
  ];

  const response = await callChatGPT(messages);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      seoStructure: Math.max(0, Math.min(4, parsed.seoStructure || 0)),
      ctrDesign: Math.max(0, Math.min(4, parsed.ctrDesign || 0)),
      readability: Math.max(0, Math.min(2, parsed.readability || 0)),
      why: parsed.why || "",
    };
  }

  return {
    seoStructure: 2,
    ctrDesign: 2,
    readability: 1,
    why: "LLM分析に失敗したため、デフォルト値を使用",
  };
}

async function analyzeSubImages(imageUrls: string[]): Promise<{
  analysis: SuperAnalysis["sub_images"];
  observations: string[];
}> {
  try {
    // Step 1: Gemini Visionで視覚的な観察を取得（点数は出さない）
    const imagesToAnalyze = imageUrls.slice(0, 6);
    const visionInputs: VisionInput[] = [];

    for (const url of imagesToAnalyze) {
      try {
        const imageBase64 = await fetchImageAsBase64(url);
        visionInputs.push({
          imageBase64: imageBase64.base64,
          mimeType: imageBase64.mimeType,
        });
      } catch (error) {
        console.warn(`[Super] Failed to fetch image ${url}:`, error);
      }
    }

    if (visionInputs.length === 0) {
      throw new Error("No images could be fetched");
    }

    const geminiPrompt = `You are a visual UX and e-commerce conversion expert.

Analyze the following Amazon product sub images visually.
Do NOT score. Do NOT summarize.
Only provide concrete visual observations.

Focus on:
- Whether images communicate benefits visually
- Consistency of color, style, and tone
- Text density and readability on mobile
- Whether the image sequence tells a story

Output rules:
- No opinions like "good" or "bad" alone
- Describe what is visible and how it affects clarity or attention
- Bullet points only

Output format (JSON):
{
  "sub_image_observations": string[]
}`;

    const geminiResponse = await callGeminiVision(geminiPrompt, visionInputs);
    let geminiObservations: string[] = [];
    const geminiJsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
    if (geminiJsonMatch) {
      const geminiParsed = JSON.parse(geminiJsonMatch[0]);
      geminiObservations = geminiParsed.sub_image_observations || [];
    }

    // Step 2: ChatGPTで点数を決定（Geminiの観察結果を参考に）
    const chatGptPrompt = `あなたはAmazon商品ページ改善のトップコンサルタントです。
以下の商品ページ情報をもとに、「CVRが上がる構造か」を論理的に評価してください。

【重要な前提】
- これは感想や要約ではありません
- Amazonで「実際に売れるかどうか」を基準に判断してください
- 点数は必ず理由（reason）と改善案（improvement_suggestion）をセットで出してください
- Score（ルールベース）とは役割が異なります
- 理由は「抽象的な感想」ではなく、「画像内の『〇〇』という文字が〜」「色が××だから〜」と具体的に記述してください

【入力情報】
- subImages: サブ画像URL配列（${imageUrls.length}枚）

【Gemini Visionによる視覚観察】
${geminiObservations.map((obs, i) => `${i + 1}. ${obs}`).join("\n")}

【評価対象：サブ画像（30点）】
以下の5つの観点で評価してください：
1. ベネフィット主体か: 0-10点
2. 世界観は統一されているか: 0-5点
3. 情報の順番・導線があるか: 0-5点
4. 文字占有率は適切か: 0-5点
5. CVRを下げる表現はないか: 0-5点（阻害要因が少ないほど高得点）

【出力ルール（厳守）】
- 各評価項目ごとに、score、reason、improvement_suggestionを必ず出力してください
- reasonは「画像内の『〇〇』という文字が〜」「フォントが××だから〜」のように具体的に記述
- improvement_suggestionは「フォントをBoldからExtraBoldへ変更」のように具体的な改善指示
- 点数は指定された最大点数を超えない
- 抽象論は禁止（「良い」「弱い」だけはNG）

【出力形式（JSON厳守）】
{
  "sections": {
    "benefit_design": {
      "score": 0-10,
      "reason": "『とにかく硬い』というコピーが、手首の怪我を恐れるユーザーのインサイトに直結しているため高評価。",
      "improvement_suggestion": "特になし。"
    },
    "design_worldview": {
      "score": 0-5,
      "reason": "商品がハードな筋トレ器具であるのに対し、フォントが細い明朝体で頼りない印象を与えるため減点。",
      "improvement_suggestion": "フォントを極太のゴシック体に変更し、黒背景で重厚感を出してください。"
    },
    "information_design": {
      "score": 0-5,
      "reason": "画像の配置順序が論理的で、商品の機能から使用方法へと自然に導線が引かれている。",
      "improvement_suggestion": "現状維持で問題ありません。"
    },
    "text_visibility": {
      "score": 0-5,
      "reason": "文字占有率が60%を超えており、スマホで見ると圧迫感がある。",
      "improvement_suggestion": "下部のスペック表を削除し、メインコピーの余白を確保してください。"
    },
    "cvr_blockers": {
      "score": 0-5,
      "reason": "画像内にCVRを下げる要素（不安を煽る表現、競合比較など）が見当たらない。",
      "improvement_suggestion": "なし"
    }
  }
}`;

    const chatGptMessages: ChatMessage[] = [
      {
        role: "system",
        content: "あなたはAmazon商品ページ改善のトップコンサルタントです。CVRが上がる構造かを論理的に評価し、点数と理由を必ずセットで出力してください。",
      },
      {
        role: "user",
        content: chatGptPrompt,
      },
    ];

    const chatGptResponse = await callChatGPT(chatGptMessages);
    const chatGptJsonMatch = chatGptResponse.match(/\{[\s\S]*\}/);
    if (chatGptJsonMatch) {
      const parsed = JSON.parse(chatGptJsonMatch[0]);
      const sections = parsed.sections || {};
      
      // 新しい構造から値を取得（後方互換性のため、旧形式もサポート）
      const benefitSection = sections.benefit_design || {};
      const designSection = sections.design_worldview || {};
      const infoSection = sections.information_design || {};
      const textSection = sections.text_visibility || {};
      const blockerSection = sections.cvr_blockers || {};
      
      return {
        analysis: {
          benefitDesign: Math.max(0, Math.min(10, benefitSection.score ?? parsed.benefitDesign ?? 0)),
          worldView: Math.max(0, Math.min(5, designSection.score ?? parsed.worldView ?? 0)),
          informationDesign: Math.max(0, Math.min(5, infoSection.score ?? parsed.informationDesign ?? 0)),
          textVisibility: Math.max(0, Math.min(5, textSection.score ?? parsed.textVisibility ?? 0)),
          cvrBlockers: Math.max(0, Math.min(5, blockerSection.score ?? parsed.cvrBlockers ?? 0)),
          why: parsed.why || "",
          // 詳細情報を追加
          details: {
            benefitDesign: {
              reason: benefitSection.reason || "",
              improvement: benefitSection.improvement_suggestion || "",
            },
            worldView: {
              reason: designSection.reason || "",
              improvement: designSection.improvement_suggestion || "",
            },
            informationDesign: {
              reason: infoSection.reason || "",
              improvement: infoSection.improvement_suggestion || "",
            },
            textVisibility: {
              reason: textSection.reason || "",
              improvement: textSection.improvement_suggestion || "",
            },
            cvrBlockers: {
              reason: blockerSection.reason || "",
              improvement: blockerSection.improvement_suggestion || "",
            },
          },
        },
        observations: geminiObservations,
      };
    }
  } catch (error) {
    console.error("[Super] Failed to analyze sub images:", error);
    // フォールバック: LLMのみで継続
    const fallbackAnalysis = await analyzeSubImagesWithLLMOnly({} as AnalyzeInput, imageUrls.map(url => ({ url })));
    return {
      analysis: fallbackAnalysis,
      observations: [],
    };
  }

  return {
    analysis: {
      benefitDesign: 5,
      worldView: 2,
      informationDesign: 2,
      textVisibility: 2,
      cvrBlockers: 2,
      why: "画像分析に失敗したため、デフォルト値を使用",
    },
    observations: [],
  };
}

async function analyzeSubImagesWithLLMOnly(
  input: AnalyzeInput,
  subImages: any[]
): Promise<SuperAnalysis["sub_images"]> {
  const subImageInfo = subImages
    .slice(0, 6)
    .map((img: any, idx: number) => `画像${idx + 1}: ${img?.url || "不明"}`)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "あなたはAmazon商品ページ改善のトップコンサルタントです。CVRが上がる構造かを論理的に評価し、点数と理由を必ずセットで出力してください。",
    },
    {
      role: "user",
      content: `あなたはAmazon商品ページ改善のトップコンサルタントです。
以下の商品ページ情報をもとに、「CVRが上がる構造か」を論理的に評価してください。

【重要な前提】
- これは感想や要約ではありません
- Amazonで「実際に売れるかどうか」を基準に判断してください
- 点数は必ず理由（reason）と改善案（improvement_suggestion）をセットで出してください
- Score（ルールベース）とは役割が異なります
- 理由は「抽象的な感想」ではなく、「画像内の『〇〇』という文字が〜」「色が××だから〜」と具体的に記述してください

【入力情報】
- subImages: サブ画像URL配列（${subImages.length}枚）
${subImageInfo}

注意: 画像の視覚的分析はできませんが、提供された情報から推測して評価してください。

【評価対象：サブ画像（30点）】
以下の5つの観点で評価してください：
1. ベネフィット主体か: 0-10点
2. 世界観は統一されているか: 0-5点
3. 情報の順番・導線があるか: 0-5点
4. 文字占有率は適切か: 0-5点
5. CVRを下げる表現はないか: 0-5点（阻害要因が少ないほど高得点）

【出力ルール（厳守）】
- 各評価項目ごとに、score、reason、improvement_suggestionを必ず出力してください
- reasonは「画像内の『〇〇』という文字が〜」「フォントが××だから〜」のように具体的に記述
- improvement_suggestionは「フォントをBoldからExtraBoldへ変更」のように具体的な改善指示
- 点数は指定された最大点数を超えない
- 抽象論は禁止（「良い」「弱い」だけはNG）

【出力形式（JSON厳守）】
{
  "sections": {
    "benefit_design": {
      "score": 0-10,
      "reason": "『とにかく硬い』というコピーが、手首の怪我を恐れるユーザーのインサイトに直結しているため高評価。",
      "improvement_suggestion": "特になし。"
    },
    "design_worldview": {
      "score": 0-5,
      "reason": "商品がハードな筋トレ器具であるのに対し、フォントが細い明朝体で頼りない印象を与えるため減点。",
      "improvement_suggestion": "フォントを極太のゴシック体に変更し、黒背景で重厚感を出してください。"
    },
    "information_design": {
      "score": 0-5,
      "reason": "画像の配置順序が論理的で、商品の機能から使用方法へと自然に導線が引かれている。",
      "improvement_suggestion": "現状維持で問題ありません。"
    },
    "text_visibility": {
      "score": 0-5,
      "reason": "文字占有率が60%を超えており、スマホで見ると圧迫感がある。",
      "improvement_suggestion": "下部のスペック表を削除し、メインコピーの余白を確保してください。"
    },
    "cvr_blockers": {
      "score": 0-5,
      "reason": "画像内にCVRを下げる要素（不安を煽る表現、競合比較など）が見当たらない。",
      "improvement_suggestion": "なし"
    }
  }
}`,
    },
  ];

  const response = await callChatGPT(messages);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    const sections = parsed.sections || {};
    
    // 新しい構造から値を取得（後方互換性のため、旧形式もサポート）
    const benefitSection = sections.benefit_design || {};
    const designSection = sections.design_worldview || {};
    const infoSection = sections.information_design || {};
    const textSection = sections.text_visibility || {};
    const blockerSection = sections.cvr_blockers || {};
    
    return {
      benefitDesign: Math.max(0, Math.min(10, benefitSection.score ?? parsed.benefitDesign ?? 0)),
      worldView: Math.max(0, Math.min(5, designSection.score ?? parsed.worldView ?? 0)),
      informationDesign: Math.max(0, Math.min(5, infoSection.score ?? parsed.informationDesign ?? 0)),
      textVisibility: Math.max(0, Math.min(5, textSection.score ?? parsed.textVisibility ?? 0)),
      cvrBlockers: Math.max(0, Math.min(5, blockerSection.score ?? parsed.cvrBlockers ?? 0)),
      why: parsed.why || "",
      // 詳細情報を追加
      details: {
        benefitDesign: {
          reason: benefitSection.reason || "",
          improvement: benefitSection.improvement_suggestion || "",
        },
        worldView: {
          reason: designSection.reason || "",
          improvement: designSection.improvement_suggestion || "",
        },
        informationDesign: {
          reason: infoSection.reason || "",
          improvement: infoSection.improvement_suggestion || "",
        },
        textVisibility: {
          reason: textSection.reason || "",
          improvement: textSection.improvement_suggestion || "",
        },
        cvrBlockers: {
          reason: blockerSection.reason || "",
          improvement: blockerSection.improvement_suggestion || "",
        },
      },
    };
  }

  return {
    benefitDesign: 5,
    worldView: 2,
    informationDesign: 2,
    textVisibility: 2,
    cvrBlockers: 2,
    why: "LLM分析に失敗したため、デフォルト値を使用",
    details: {
      benefitDesign: { reason: "", improvement: "" },
      worldView: { reason: "", improvement: "" },
      informationDesign: { reason: "", improvement: "" },
      textVisibility: { reason: "", improvement: "" },
      cvrBlockers: { reason: "", improvement: "" },
    },
  };
}

async function analyzeReviewsWithLLM(
  reviewCount: number,
  rating?: number,
  negativeReviews?: string[] // 星1-3のネガティブレビュー本文（最大10件）
): Promise<SuperAnalysis["reviews"]> {
  // 対象レビューが0件の場合は10点満点
  if (reviewCount === 0) {
    return {
      negativeVisibility: 4,
      negativeSeverity: 3,
      reassurancePath: 3,
      why: "レビューが0件のため、ネガティブレビューの影響なし",
    };
  }

  const reviewText = negativeReviews && negativeReviews.length > 0
    ? negativeReviews.slice(0, 10).map((review, i) => `レビュー${i + 1}: ${review}`).join("\n")
    : `レビュー数: ${reviewCount}件\n平均評価: ${rating !== undefined ? rating.toFixed(1) : "不明"}星\n\n注意: 実際のレビュー本文は取得できませんでした。`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `あなたはAmazonのレビュー分析スペシャリストです。
購入転換率（CVR）を阻害する「ネガティブ要素のリスク」を判定してください。

### 【重要】採点の絶対ルール（減点方式）
この採点は「減点法」です。**画像内に明確なネガティブ要素が確認できない場合、自動的に「満点」を与えてください。**
AI特有の「何か粗を探そうとするバイアス」を捨ててください。平和なレビュー欄は、最高の評価に値します。`,
    },
    {
      role: "user",
      content: `あなたはAmazonのレビュー分析スペシャリストです。
以下のレビュー情報をもとに、購入転換率（CVR）を阻害する「ネガティブ要素のリスク」を判定してください。

### 【重要】採点の絶対ルール（減点方式）
この採点は「減点法」です。**明確なネガティブ要素が確認できない場合、自動的に「満点」を与えてください。**
AI特有の「何か粗を探そうとするバイアス」を捨ててください。平和なレビュー欄は、最高の評価に値します。

### 評価項目定義

#### 1. ネガティブの視認性 (Score: 1~4)
- **4点 (満点)**: ファーストビューに★1〜★2のレビューが**1つも存在しない**。または★4〜★5ばかりである。
- **3点**: ★3（普通）があるが、攻撃的なタイトルではない。
- **2点**: ★1〜★2が見えるが、タイトルが短く目立たない。
- **1点 (致命的)**: 明確に★1〜★2の低評価があり、かつ「最悪」「壊れていた」などのネガティブワードが視認できる。

#### 2. 内容の致命度 (Score: 0~3)
- **3点 (満点)**: そもそも低評価レビューが**存在しない**。
- **2点**: 低評価はあるが、「配送が遅い」「好みの問題」など、商品品質に直結しない内容。
- **1点**: 「サイズが合わない」「使いにくい」など、一部のユーザーに限定される不満。
- **0点 (致命的)**: 「すぐに壊れた」「偽物」「健康被害」など、品質や安全性に関わる致命的な欠陥が書かれている。

#### 3. 不安払拭（Reassurance）導線 (Score: 1~3)
- **3点 (満点)**: そもそもネガティブレビューがない（払拭する必要がないため満点とする）。または、ショップからの誠実な返信が表示されている。
- **2点**: ネガティブなレビューはあるが、直後にそれを否定するような高評価レビューが並んでいる。
- **1点 (要改善)**: ネガティブレビューが放置されており、それをフォローする要素（返信や他の高評価）が見当たらない。

【入力情報】
- レビュー数: ${reviewCount}件
- 平均評価: ${rating !== undefined ? rating.toFixed(1) : "不明"}星
- ネガティブレビュー（星1-3、最大10件）:
${reviewText}

【出力ルール（厳守）】
- 各評価項目ごとに、score、reason、improvement_suggestionを必ず出力してください
- reasonは「画像内に★1-2が見当たらないため満点とします」「『壊れやすい』というレビューがあるため減点」のように具体的に記述
- improvement_suggestionは「現状維持で問題ありません」「悪いレビューに対しての返信がないため低評価」のように具体的に記述
- ネガティブ要素がない場合は「満点」と明記すること

【出力形式（JSON厳守）】
{
  "sections": {
    "negative_visibility": {
      "score": 1-4,
      "reason": "画像内に★1-2が見当たらないため満点とします / 画像中央に『壊れやすい』というレビューがあるため減点",
      "improvement_suggestion": "現状維持で問題ありません。"
    },
    "fatal_content": {
      "score": 0-3,
      "reason": "品質に関する批判テキストが存在しないため満点 / 『異臭がする』という致命的な記載があるため0点",
      "improvement_suggestion": "なし"
    },
    "reassurance_path": {
      "score": 1-3,
      "reason": "ネガティブ要素自体が存在しないため満点 / 悪いレビューに対しての返信がないため低評価",
      "improvement_suggestion": "なし"
    }
  }
}`,
    },
  ];

  const response = await callChatGPT(messages);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    const sections = parsed.sections || {};
    
    // 新しい構造から値を取得（後方互換性のため、旧形式もサポート）
    const visibilitySection = sections.negative_visibility || {};
    const severitySection = sections.fatal_content || {};
    const reassuranceSection = sections.reassurance_path || {};
    
    // デフォルト値は満点（ネガティブ要素がない場合）
    return {
      negativeVisibility: Math.max(1, Math.min(4, visibilitySection.score ?? parsed.negativeVisibility ?? 4)),
      negativeSeverity: Math.max(0, Math.min(3, severitySection.score ?? parsed.negativeSeverity ?? 3)),
      reassurancePath: Math.max(1, Math.min(3, reassuranceSection.score ?? parsed.reassurancePath ?? 3)),
      why: parsed.why || "レビュー情報から明確なネガティブ要素が確認できないため、満点とします",
      // 詳細情報を追加
      details: {
        negativeVisibility: {
          reason: visibilitySection.reason || "画像内に★1-2が見当たらないため満点とします",
          improvement: visibilitySection.improvement_suggestion || "現状維持で問題ありません。",
        },
        negativeSeverity: {
          reason: severitySection.reason || "品質に関する批判テキストが存在しないため満点",
          improvement: severitySection.improvement_suggestion || "なし",
        },
        reassurancePath: {
          reason: reassuranceSection.reason || "ネガティブ要素自体が存在しないため満点",
          improvement: reassuranceSection.improvement_suggestion || "なし",
        },
      },
    };
  }

  // デフォルト値も満点（分析失敗時も安全側に倒す）
  return {
    negativeVisibility: 4,
    negativeSeverity: 3,
    reassurancePath: 3,
    why: "レビュー情報から明確なネガティブ要素が確認できないため、満点とします",
    details: {
      negativeVisibility: {
        reason: "画像内に★1-2が見当たらないため満点とします",
        improvement: "現状維持で問題ありません。",
      },
      negativeSeverity: {
        reason: "品質に関する批判テキストが存在しないため満点",
        improvement: "なし",
      },
      reassurancePath: {
        reason: "ネガティブ要素自体が存在しないため満点",
        improvement: "なし",
      },
    },
  };
}

async function analyzeAplusBrandWithLLM(
  aplusInfo: {
    hasAplus: boolean;
    isPremium: boolean;
    moduleCount: number;
    hasBrand: boolean;
  },
  input: AnalyzeInput,
  aplusImageUrls?: string[] // A+コンテンツ画像URL配列（存在すれば）
): Promise<{
  analysis: SuperAnalysis["aplus_brand"];
  observations: string[];
}> {
  // Step 1: A+画像がある場合はGemini Visionで視覚観察を取得
  let geminiObservations: string[] = [];
  if (aplusImageUrls && aplusImageUrls.length > 0) {
    try {
      const visionInputs: VisionInput[] = [];
      for (const url of aplusImageUrls.slice(0, 6)) {
        try {
          const imageBase64 = await fetchImageAsBase64(url);
          visionInputs.push({
            imageBase64: imageBase64.base64,
            mimeType: imageBase64.mimeType,
          });
        } catch (error) {
          console.warn(`[Super] Failed to fetch A+ image ${url}:`, error);
        }
      }

      if (visionInputs.length > 0) {
        const geminiPrompt = `You are a visual UX and e-commerce conversion expert.

Analyze the following Amazon A+ content images visually.
Do NOT score. Do NOT summarize.
Only provide concrete visual observations.

Focus on:
- Visual hierarchy
- Balance between text and imagery
- Consistency with main and sub images

Output rules:
- No opinions like "good" or "bad" alone
- Describe what is visible and how it affects clarity or attention
- Bullet points only

Output format (JSON):
{
  "aplus_observations": string[]
}`;

        const geminiResponse = await callGeminiVision(geminiPrompt, visionInputs);
        const geminiJsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
        if (geminiJsonMatch) {
          const geminiParsed = JSON.parse(geminiJsonMatch[0]);
          geminiObservations = geminiParsed.aplus_observations || [];
        }
      }
    } catch (error) {
      console.warn("[Super] Failed to analyze A+ images with Gemini:", error);
    }
  }

  // Step 2: ChatGPTで点数を決定
  const geminiText = geminiObservations.length > 0
    ? `【Gemini Visionによる視覚観察】\n${geminiObservations.map((obs, i) => `${i + 1}. ${obs}`).join("\n")}\n\n`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "あなたはAmazon商品ページ改善のトップコンサルタントです。CVRが上がる構造かを論理的に評価し、点数と理由を必ずセットで出力してください。",
    },
    {
      role: "user",
      content: `あなたはAmazon商品ページ改善のトップコンサルタントです。
以下の商品ページ情報をもとに、「CVRが上がる構造か」を論理的に評価してください。

【重要な前提】
- これは感想や要約ではありません
- Amazonで「実際に売れるかどうか」を基準に判断してください
- 点数は必ず理由（why）とセットで出してください
- Score（ルールベース）とは役割が異なります

【入力情報】
- A+導入: ${aplusInfo.hasAplus ? "あり" : "なし"}
- Premium A+: ${aplusInfo.isPremium ? "あり" : "なし"}
- モジュール数: ${aplusInfo.moduleCount}個
- ブランドストーリー: ${aplusInfo.hasBrand ? "あり" : "なし"}
${aplusImageUrls && aplusImageUrls.length > 0 ? `- A+画像URL: ${aplusImageUrls.length}枚\n` : ""}
${geminiText}【評価対象：A+コンテンツ＋ブランド（30点）】
以下の5つの観点で評価してください：
1. 迷わせない構成か: 0-8点
2. ベネフィットが明確か: 0-8点
3. 世界観が統一されているか: 0-6点
4. 視覚的に読みやすいか: 0-5点
5. 比較・不安解消ができているか: 0-3点

【出力ルール（厳守）】
- 点数は必ず理由（why）とセットで出してください
- 点数は指定された最大点数を超えない
- 抽象論は禁止（「良い」「弱い」だけはNG）
- 実務で改善できる指摘にする

【出力形式（JSON厳守）】
{
  "compositionDesign": 0-8,
  "benefitAppeal": 0-8,
  "worldView": 0-6,
  "visualDesign": 0-5,
  "comparisonReassurance": 0-3,
  "why": "各項目の採点理由を具体的に説明（抽象論禁止）"
}`,
    },
  ];

  const response = await callChatGPT(messages);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      analysis: {
        compositionDesign: Math.max(0, Math.min(8, parsed.compositionDesign || 0)),
        benefitAppeal: Math.max(0, Math.min(8, parsed.benefitAppeal || 0)),
        worldView: Math.max(0, Math.min(6, parsed.worldView || 0)),
        visualDesign: Math.max(0, Math.min(5, parsed.visualDesign || 0)),
        comparisonReassurance: Math.max(0, Math.min(3, parsed.comparisonReassurance || 0)),
        why: parsed.why || "",
      },
      observations: geminiObservations,
    };
  }

  return {
    analysis: {
      compositionDesign: 4,
      benefitAppeal: 4,
      worldView: 3,
      visualDesign: 2,
      comparisonReassurance: 1,
      why: "LLM分析に失敗したため、デフォルト値を使用",
    },
    observations: geminiObservations,
  };
}
