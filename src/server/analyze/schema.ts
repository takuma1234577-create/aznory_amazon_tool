import { z } from "zod";

export const AnalyzeInputSchema = z.object({
  asin: z.string().min(1),
  url: z.string().optional(),
  title: z.string().optional(), // Scoreのタイトル採点用
  images: z.array(
    z.object({
      url: z.string().url(),
      imageBase64: z.string().optional(),
      backgroundWhiteRatio: z.number().min(0).max(1).optional(),
      subjectOccupancyRatio: z.number().min(0).max(1).optional()
    })
  ).optional(), // 空配列を許可
  description: z.string().optional(),
  reviews: z.object({
    averageRating: z.number().min(0).max(5).optional(),
    totalCount: z.number().int().min(0).optional()
  }).optional(),
  aPlusContent: z.boolean().optional(),
  brandContent: z.boolean().optional(),
  // 新しい画像構造もサポート
  images_new: z.object({
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
  }).optional()
});

export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>;
