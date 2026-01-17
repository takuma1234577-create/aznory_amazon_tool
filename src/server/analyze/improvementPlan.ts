import { callChatGPT, ChatMessage } from "../llm/openaiClient";
import { ScoreResult } from "./score";
import { SuperResult, SuperAnalysis } from "./super";

export interface SectionScoreReason {
  section: string; // "title" | "mainImage" | "subImages" | "reviews" | "aplusBrand"
  score: number; // 現在の点数
  max: number; // 満点
  reason: string; // なぜこの点数なのか（具体的な理由、200文字以内）
  gap_analysis: string; // 何が不足しているのか（100文字以内）
}

export interface ImprovementAction {
  priority: "P0" | "P1" | "P2";
  category: "score" | "super" | "both";
  section: string; // 対象セクション（"title" | "mainImage" | "subImages" | "reviews" | "aplusBrand"）
  action: string; // 具体的な改善アクション（80文字以内）
  estimated_score_increase: number; // Score上昇見積もり
  estimated_super_increase: number; // Super上昇見積もり
  cvr_impact: string; // CVR向上への影響（50文字以内）
  ctr_impact: string; // CTR向上への影響（50文字以内）
  revenue_impact: string; // 売上向上への影響（50文字以内）
  why: string; // なぜこの改善が効果的か（150文字以内）
  implementation_hint?: string; // 実装のヒント（80文字以内）
}

export interface ImprovementPlan {
  current_total_score: number;
  estimated_total_score_after: number;
  score_gap: number;
  section_reasons: SectionScoreReason[]; // 各セクションの点数理由
  priority_actions: ImprovementAction[];
  secondary_actions: ImprovementAction[];
  quick_wins: ImprovementAction[];
}

/**
 * Score/Super分析結果から改善計画を生成
 */
export async function generateImprovementPlan(
  scoreResult: ScoreResult,
  superResult: SuperResult,
  input: {
    productTitle?: string;
    mainImageObservations?: string[];
    subImageObservations?: string[];
    aplusObservations?: string[];
    negativeReviews?: string[];
  }
): Promise<ImprovementPlan> {
  const currentTotal = scoreResult.scoreTotal + superResult.total;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `あなたはAmazon商品ページ改善の世界最高レベルのコンサルタントです。
分析結果から、CVR（コンバージョン率）・CTR（クリック率）・売上向上に直結する具体的な改善計画を生成してください。

【重要ルール】
1. 各セクションの点数理由を詳細に推論し、なぜその点数になったのかを明確に説明する
2. 改善点を提案する際は、必ず「これは今よりもCVRやCTR、売上が上がる改善になるか？」を自問自答し、効果が確実なもののみを出力する
3. 抽象論は禁止。具体的な数値・指示・例を含める
4. 各改善点は、CVR/CTR/売上への影響を明確に記載する`,
    },
    {
      role: "user",
      content: `あなたはAmazon商品ページ改善の世界最高レベルのコンサルタントです。

以下はすでに完了した「Score（100点：ルールベース）」と「Super（100点：LLM+Visionによる論理評価）」の分析結果です。
新しい分析は行わず、以下2点を具体的にまとめてください：

1. 【各セクションの点数理由の詳細推論】
   - なぜその点数になったのか、LLMが推論した具体的な理由をセクションごとに説明する
   - Score分析とSuper分析の両方について、詳細な推論を行う

2. 【具体的な改善点の提案】
   - 上記の点数理由から、適切な改善点を具体的に出力する
   - 各改善点について、必ず「これは今よりもCVRやCTR、売上が上がる改善になるか？」を自問自答し、効果が確実なもののみを出力する

────────────────────
【入力情報】
────────────────────
- 商品タイトル: ${input.productTitle || "不明"}

【Score分析結果（100点満点）】
現在のスコア: ${scoreResult.scoreTotal}点
内訳:
${Object.entries(scoreResult.breakdown)
  .map(([key, value]) => `- ${key}: ${value.score}/${value.max}点`)
  .join("\n")}
不足しているシグナル: ${scoreResult.missingSignals?.join(", ") || "なし"}

【Super分析結果（100点満点）】
現在のスコア: ${superResult.total}点
内訳:
- メイン画像: ${superResult.breakdown.main_image}/20点
- タイトル: ${superResult.breakdown.title}/10点
- サブ画像: ${superResult.breakdown.sub_images}/30点
- レビュー: ${superResult.breakdown.reviews}/10点
- A+コンテンツ＋ブランド: ${superResult.breakdown.aplus_brand}/30点

【Super分析の詳細理由】
${JSON.stringify(superResult.analyses, null, 2)}

【視覚観察結果】
${input.mainImageObservations && input.mainImageObservations.length > 0
  ? `メイン画像観察:\n${input.mainImageObservations.map((obs, i) => `${i + 1}. ${obs}`).join("\n")}\n`
  : ""}
${input.subImageObservations && input.subImageObservations.length > 0
  ? `サブ画像観察:\n${input.subImageObservations.map((obs, i) => `${i + 1}. ${obs}`).join("\n")}\n`
  : ""}
${input.aplusObservations && input.aplusObservations.length > 0
  ? `A+コンテンツ観察:\n${input.aplusObservations.map((obs, i) => `${i + 1}. ${obs}`).join("\n")}\n`
  : ""}

【ネガティブレビュー（最大10件）】
${input.negativeReviews && input.negativeReviews.length > 0
  ? input.negativeReviews.map((review, i) => `${i + 1}. ${review}`).join("\n")
  : "なし"}

────────────────────
【目的】
────────────────────
1. 【各セクションの点数理由の詳細推論】
   - なぜその点数になったのか、LLMが推論した具体的な理由をセクションごとに説明する
   - Score分析とSuper分析の両方について、詳細な推論を行う
   - 各セクションの不足点・改善余地を明確に指摘する

2. 【具体的な改善点の提案】
   - 上記の点数理由から、適切な改善点を具体的に出力する
   - 各改善点について、必ず「これは今よりもCVRやCTR、売上が上がる改善になるか？」を自問自答し、効果が確実なもののみを出力する
   - CVR（コンバージョン率）・CTR（クリック率）・売上向上に直結する改善点のみを提案する

────────────────────
【重要ルール】
────────────────────
- **必須自問自答**: 各改善点を提案する前に、必ず「これは今よりもCVRやCTR、売上が上がる改善になるか？」を自問自答し、効果が確実なもののみを出力する
- 画像生成やコピー生成はしない
- 抽象論は禁止（「良くする」「改善する」だけはNG）
- 実装可能な指示にする（例：「メイン画像を1500×1500の正方形に変更」）
- 現実的な点数上昇幅を提示する（盛りすぎない）
- P0: 致命的な問題、即座に修正すべき（Score/Super合計で10点以上上昇見込み）
- P1: 重要な改善、優先的に実施（Score/Super合計で5-9点上昇見込み）
- P2: 細かい改善、余裕があれば実施（Score/Super合計で1-4点上昇見込み）

────────────────────
【出力形式（JSON厳守）】
────────────────────
{
  "current_total_score": ${currentTotal},
  "estimated_total_score_after": number, // 改善実施後の見積もり合計点
  "score_gap": number, // estimated_total_score_after - current_total_score
  "section_reasons": [
    {
      "section": "title" | "mainImage" | "subImages" | "reviews" | "aplusBrand" | "description",
      "score": number, // 現在の点数
      "max": number, // 満点
      "reason": "なぜこの点数なのか（具体的な理由、200文字以内）",
      "gap_analysis": "何が不足しているのか（100文字以内）"
    }
  ],
  "priority_actions": [
    {
      "priority": "P0",
      "category": "score" | "super" | "both",
      "section": "title" | "mainImage" | "subImages" | "reviews" | "aplusBrand" | "description",
      "action": "具体的な改善アクション（80文字以内）",
      "estimated_score_increase": number, // Score上昇見積もり（0-100）
      "estimated_super_increase": number, // Super上昇見積もり（0-100）
      "cvr_impact": "CVR向上への影響（50文字以内）",
      "ctr_impact": "CTR向上への影響（50文字以内）",
      "revenue_impact": "売上向上への影響（50文字以内）",
      "why": "なぜこの改善が効果的か（150文字以内）",
      "implementation_hint": "実装のヒント（80文字以内、任意）"
    }
  ],
  "secondary_actions": [
    // P1アクション（最大5件）
  ],
  "quick_wins": [
    // P2アクション（最大5件、すぐにできる改善）
  ]
}

注意：
- section_reasons: 全セクションについて、点数理由と不足点を記載する（必須）
- priority_actions: P0のみ（最大3件）、各アクションにcvr_impact/ctr_impact/revenue_impactを必須記載
- secondary_actions: P1のみ（最大5件）、各アクションにcvr_impact/ctr_impact/revenue_impactを必須記載
- quick_wins: P2のみ（最大5件）、各アクションにcvr_impact/ctr_impact/revenue_impactを必須記載
- 各アクションのestimated_score_increase + estimated_super_increaseの合計が、score_gapを超えないようにする
- 現実的な見積もりにする（1つのアクションで50点以上上がるなどは非現実的）
- **最重要**: 各改善点は必ず「CVR/CTR/売上向上」に直結する理由を明確に記載する`,
    },
  ];

  try {
    const response = await callChatGPT(messages, {
      temperature: 0.7,
      maxTokens: 3000,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // バリデーションと正規化
      const plan: ImprovementPlan = {
        current_total_score: currentTotal,
        estimated_total_score_after: Math.max(
          currentTotal,
          Math.min(200, parsed.estimated_total_score_after || currentTotal)
        ),
        score_gap: Math.max(0, parsed.score_gap || 0),
        section_reasons: (parsed.section_reasons || [])
          .map((reason: any) => ({
            section: String(reason.section || ""),
            score: Math.max(0, reason.score || 0),
            max: Math.max(0, reason.max || 0),
            reason: String(reason.reason || "").slice(0, 200),
            gap_analysis: String(reason.gap_analysis || "").slice(0, 100),
          })),
        priority_actions: (parsed.priority_actions || [])
          .slice(0, 3)
          .map((action: any) => ({
            priority: action.priority === "P0" ? "P0" : "P1",
            category: ["score", "super", "both"].includes(action.category)
              ? action.category
              : "both",
            section: String(action.section || ""),
            action: String(action.action || "").slice(0, 80),
            estimated_score_increase: Math.max(0, Math.min(100, action.estimated_score_increase || 0)),
            estimated_super_increase: Math.max(0, Math.min(100, action.estimated_super_increase || 0)),
            cvr_impact: String(action.cvr_impact || "").slice(0, 50),
            ctr_impact: String(action.ctr_impact || "").slice(0, 50),
            revenue_impact: String(action.revenue_impact || "").slice(0, 50),
            why: String(action.why || "").slice(0, 150),
            implementation_hint: action.implementation_hint
              ? String(action.implementation_hint).slice(0, 80)
              : undefined,
          })),
        secondary_actions: (parsed.secondary_actions || [])
          .slice(0, 5)
          .map((action: any) => ({
            priority: "P1" as const,
            category: ["score", "super", "both"].includes(action.category)
              ? action.category
              : "both",
            section: String(action.section || ""),
            action: String(action.action || "").slice(0, 80),
            estimated_score_increase: Math.max(0, Math.min(100, action.estimated_score_increase || 0)),
            estimated_super_increase: Math.max(0, Math.min(100, action.estimated_super_increase || 0)),
            cvr_impact: String(action.cvr_impact || "").slice(0, 50),
            ctr_impact: String(action.ctr_impact || "").slice(0, 50),
            revenue_impact: String(action.revenue_impact || "").slice(0, 50),
            why: String(action.why || "").slice(0, 150),
            implementation_hint: action.implementation_hint
              ? String(action.implementation_hint).slice(0, 80)
              : undefined,
          })),
        quick_wins: (parsed.quick_wins || [])
          .slice(0, 5)
          .map((action: any) => ({
            priority: "P2" as const,
            category: ["score", "super", "both"].includes(action.category)
              ? action.category
              : "both",
            section: String(action.section || ""),
            action: String(action.action || "").slice(0, 80),
            estimated_score_increase: Math.max(0, Math.min(100, action.estimated_score_increase || 0)),
            estimated_super_increase: Math.max(0, Math.min(100, action.estimated_super_increase || 0)),
            cvr_impact: String(action.cvr_impact || "").slice(0, 50),
            ctr_impact: String(action.ctr_impact || "").slice(0, 50),
            revenue_impact: String(action.revenue_impact || "").slice(0, 50),
            why: String(action.why || "").slice(0, 150),
            implementation_hint: action.implementation_hint
              ? String(action.implementation_hint).slice(0, 80)
              : undefined,
          })),
      };

      // score_gapを再計算（実際の見積もり合計から）
      const totalEstimatedIncrease = [
        ...plan.priority_actions,
        ...plan.secondary_actions,
        ...plan.quick_wins,
      ].reduce(
        (sum, action) =>
          sum + action.estimated_score_increase + action.estimated_super_increase,
        0
      );
      plan.estimated_total_score_after = Math.min(
        200,
        currentTotal + totalEstimatedIncrease
      );
      plan.score_gap = plan.estimated_total_score_after - currentTotal;

      return plan;
    }
  } catch (error) {
    console.error("[ImprovementPlan] Failed to generate plan:", error);
  }

  // フォールバック
  return {
    current_total_score: currentTotal,
    estimated_total_score_after: currentTotal,
    score_gap: 0,
    section_reasons: [],
    priority_actions: [],
    secondary_actions: [],
    quick_wins: [],
  };
}
