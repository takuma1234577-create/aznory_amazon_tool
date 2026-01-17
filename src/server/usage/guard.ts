import { PlanKey, UsageFeature } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_ENTITLEMENTS } from "@/lib/plans";
import { getPlanForUserWithDb } from "@/server/billing/getPlanForUser";
import { startOfUtcDay, startOfUtcMonth } from "@/server/time";

type Db = typeof prisma;

export interface UsageGuardInput {
  userId: string;
  feature: UsageFeature;
  asin?: string;
  db?: Db;
}

export interface UsageGuardResult {
  ok: boolean;
  planKey: PlanKey;
  reason?: "limit" | "cooldown";
  message?: string;
  code?: string; // "LIMIT_EXCEEDED" など
  feature?: string; // "scoreMonthly", "superMonthly", "improveMonthly"
  resetAt?: string; // ISO string
}

export async function usageGuard(input: UsageGuardInput): Promise<UsageGuardResult> {
  return usageGuardWithDb(input, prisma);
}

export async function usageGuardWithDb(input: UsageGuardInput, db: Db): Promise<UsageGuardResult> {
  const { userId, feature, asin } = input;
  const now = new Date();

  const planKey = await getPlanForUserWithDb(userId, db);
  const ent = PLAN_ENTITLEMENTS[planKey];

  // Monthly quota checks
  const monthStart = startOfUtcMonth(now);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const monthCount = await db.usageEvent.count({
    where: { userId, feature, createdAt: { gte: monthStart } }
  });

  // Score: FREEは月5回まで、SIMPLE/PROは無制限
  if (feature === UsageFeature.SCORE) {
    const max = ent.limits.scoreMonthly;
    if (max !== undefined && monthCount >= max) {
      return {
        ok: false,
        planKey,
        reason: "limit",
        code: "LIMIT_EXCEEDED",
        feature: "scoreMonthly",
        message: `FREEのScoreは月${max}回までです。`,
        resetAt: nextMonth.toISOString()
      };
    }
  }

  // Super: FREEは0（利用不可）、SIMPLEは10、PROは30
  if (feature === UsageFeature.SUPER) {
    const max = ent.limits.superMonthly;
    if (max === 0) {
      return {
        ok: false,
        planKey,
        reason: "limit",
        code: "LIMIT_EXCEEDED",
        feature: "superMonthly",
        message: `${planKey}プランではSuper分析は利用できません。`
      };
    }
    if (monthCount >= max) {
      return {
        ok: false,
        planKey,
        reason: "limit",
        code: "LIMIT_EXCEEDED",
        feature: "superMonthly",
        message: `${planKey}プランのSuper分析は月${max}回までです。`,
        resetAt: nextMonth.toISOString()
      };
    }
  }

  // Improve: FREEは0（利用不可）、SIMPLEは3、PROは20
  if (feature === UsageFeature.IMPROVE) {
    const max = ent.limits.improveMonthly;
    if (max === 0) {
      return {
        ok: false,
        planKey,
        reason: "limit",
        code: "LIMIT_EXCEEDED",
        feature: "improveMonthly",
        message: `${planKey}プランでは改善点分析は利用できません。`
      };
    }
    if (monthCount >= max) {
      return {
        ok: false,
        planKey,
        reason: "limit",
        code: "LIMIT_EXCEEDED",
        feature: "improveMonthly",
        message: `${planKey}プランの改善点分析は月${max}回までです。`,
        resetAt: nextMonth.toISOString()
      };
    }
  }

  // DEEP: 廃止予定だが互換性のため残す（制限なしにする）
  if (feature === UsageFeature.DEEP) {
    // DEEPは廃止されているため、常に許可（既存コードの互換性のため）
  }

  return { ok: true, planKey };
}
