import { PlanKey, UsageFeature } from "@prisma/client";

export type Entitlements = {
  planKey: PlanKey;
  limits: {
    scoreMonthly?: number; // null or undefined = unlimited (SIMPLE/PRO)
    superMonthly: number; // 0 = unavailable (FREE)
    improveMonthly: number; // 0 = unavailable (FREE)
  };
};

export const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  FREE: {
    planKey: PlanKey.FREE,
    limits: {
      scoreMonthly: 5,
      superMonthly: 0, // 利用不可
      improveMonthly: 0 // 利用不可
    }
  },
  SIMPLE: {
    planKey: PlanKey.SIMPLE,
    limits: {
      // scoreMonthly は undefined（無制限）
      superMonthly: 10,
      improveMonthly: 3
    }
  },
  PRO: {
    planKey: PlanKey.PRO,
    limits: {
      // scoreMonthly は undefined（無制限）
      superMonthly: 30,
      improveMonthly: 20
    }
  }
};

export function featureToUsageFeature(feature: "score" | "deep" | "super" | "improve"): UsageFeature {
  switch (feature) {
    case "score":
      return UsageFeature.SCORE;
    case "deep":
      return UsageFeature.DEEP;
    case "super":
      return UsageFeature.SUPER;
    case "improve":
      return UsageFeature.IMPROVE;
  }
}
