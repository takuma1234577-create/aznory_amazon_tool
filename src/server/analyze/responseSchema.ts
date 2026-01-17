import { z } from "zod";
import { ScoreResult } from "./score";
import { SuperResult } from "./super";

// Scoreレスポンススキーマ
export const ScoreResponseSchema = z.object({
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
});

// Super分析スキーマ
export const SuperAnalysisSchema = z.object({
  main_image: z
    .object({
      listVisibility: z.number().min(0).max(8),
      visualImpact: z.number().min(0).max(5),
      instantUnderstanding: z.number().min(0).max(4),
      cvrBlockers: z.number().min(0).max(3),
      why: z.string().optional(),
    })
    .optional(),
  title: z
    .object({
      seoStructure: z.number().min(0).max(4),
      ctrDesign: z.number().min(0).max(4),
      readability: z.number().min(0).max(2),
      why: z.string().optional(),
    })
    .optional(),
  sub_images: z
    .object({
      benefitDesign: z.number().min(0).max(10),
      worldView: z.number().min(0).max(5),
      informationDesign: z.number().min(0).max(5),
      textVisibility: z.number().min(0).max(5),
      cvrBlockers: z.number().min(0).max(5),
      why: z.string().optional(),
    })
    .optional(),
  reviews: z
    .object({
      negativeVisibility: z.number().min(0).max(4),
      negativeSeverity: z.number().min(0).max(3),
      reassurancePath: z.number().min(0).max(3),
      why: z.string().optional(),
    })
    .optional(),
  aplus_brand: z
    .object({
      compositionDesign: z.number().min(0).max(8),
      benefitAppeal: z.number().min(0).max(8),
      worldView: z.number().min(0).max(6),
      visualDesign: z.number().min(0).max(5),
      comparisonReassurance: z.number().min(0).max(3),
      why: z.string().optional(),
    })
    .optional(),
});

// Improvement Summaryスキーマ
export const ImprovementSummarySchema = z.object({
  most_critical_issue: z.string().optional(),
  quick_wins: z.array(z.string()).optional(),
  high_impact_actions: z.array(z.string()).optional(),
});

// Improvement Actionスキーマ
export const ImprovementActionSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  category: z.enum(["score", "super", "both"]),
  action: z.string(),
  estimated_score_increase: z.number().min(0).max(100),
  estimated_super_increase: z.number().min(0).max(100),
  why: z.string(),
  implementation_hint: z.string().optional(),
});

// Improvement Planスキーマ
export const ImprovementPlanSchema = z.object({
  current_total_score: z.number().min(0).max(200),
  estimated_total_score_after: z.number().min(0).max(200),
  score_gap: z.number().min(0),
  priority_actions: z.array(ImprovementActionSchema).max(3),
  secondary_actions: z.array(ImprovementActionSchema).max(5),
  quick_wins: z.array(ImprovementActionSchema).max(5),
});

// Superレスポンススキーマ
export const SuperResponseSchema = z.object({
  total: z.number().min(0).max(100),
  breakdown: z.object({
    main_image: z.number().min(0).max(20),
    title: z.number().min(0).max(10),
    sub_images: z.number().min(0).max(30),
    reviews: z.number().min(0).max(10),
    aplus_brand: z.number().min(0).max(30),
  }),
  analyses: SuperAnalysisSchema,
  improvement_summary: ImprovementSummarySchema.optional(),
});

// 統合レスポンススキーマ（Super実行時）
export const CombinedResponseSchema = z.object({
  ok: z.boolean(),
  runId: z.string(),
  score: ScoreResponseSchema,
  super: SuperResponseSchema.extend({
    observations: z.object({
      main_image: z.array(z.string()).optional(),
      sub_images: z.array(z.string()).optional(),
      aplus: z.array(z.string()).optional(),
    }).optional(),
  }),
  totalScore: z.number().min(0).max(200),
  usage: z.any().optional(),
  dryRun: z.boolean().optional(),
  message: z.string().optional(),
});

// 改善計画レスポンススキーマ
export const ImprovementPlanResponseSchema = z.object({
  ok: z.boolean(),
  requestId: z.string(),
  improvement_plan: ImprovementPlanSchema,
});

export type CombinedResponse = z.infer<typeof CombinedResponseSchema>;
