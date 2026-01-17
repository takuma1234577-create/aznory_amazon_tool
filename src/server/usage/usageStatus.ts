import { PlanKey, UsageFeature } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_ENTITLEMENTS } from "@/lib/plans";
import { getPlanForUserWithDb } from "@/server/billing/getPlanForUser";
import { startOfUtcDay, startOfUtcMonth } from "@/server/time";

type Db = typeof prisma;

export type UsageStatus = {
  planKey: PlanKey;
  limits: {
    scoreMonthly?: number; // undefined = unlimited
    superMonthly: number;
    improveMonthly: number;
  };
  used: {
    scoreThisMonth: number;
    superThisMonth: number;
    improveThisMonth: number;
  };
  remaining: {
    scoreThisMonth?: number; // undefined = unlimited
    superThisMonth: number;
    improveThisMonth: number;
  };
  resetsAt: {
    month: string; // ISO string
  };
};

/**
 * Get usage status for a user (plan, limits, used, remaining, reset timestamps).
 * Should be called AFTER consumption if usage is being consumed in the same transaction.
 */
export async function getUsageStatus(userId: string): Promise<UsageStatus> {
  return getUsageStatusWithDb(userId, prisma);
}

export async function getUsageStatusWithDb(userId: string, db: Db): Promise<UsageStatus> {
  const now = new Date();
  const planKey = await getPlanForUserWithDb(userId, db);
  const ent = PLAN_ENTITLEMENTS[planKey];

  // Calculate time boundaries
  const monthStart = startOfUtcMonth(now);
  
  // Next reset time (next month)
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  // Count usage events
  const [scoreMonthCount, superMonthCount, improveMonthCount] = await Promise.all([
    db.usageEvent.count({
      where: {
        userId,
        feature: UsageFeature.SCORE,
        createdAt: { gte: monthStart }
      }
    }),
    db.usageEvent.count({
      where: {
        userId,
        feature: UsageFeature.SUPER,
        createdAt: { gte: monthStart }
      }
    }),
    db.usageEvent.count({
      where: {
        userId,
        feature: UsageFeature.IMPROVE,
        createdAt: { gte: monthStart }
      }
    })
  ]);

  // Determine limits
  const limits = {
    scoreMonthly: ent.limits.scoreMonthly,
    superMonthly: ent.limits.superMonthly,
    improveMonthly: ent.limits.improveMonthly
  };

  // Calculate remaining
  const remaining = {
    scoreThisMonth: limits.scoreMonthly !== undefined 
      ? Math.max(0, limits.scoreMonthly - scoreMonthCount) 
      : undefined, // undefined = unlimited
    superThisMonth: Math.max(0, limits.superMonthly - superMonthCount),
    improveThisMonth: Math.max(0, limits.improveMonthly - improveMonthCount)
  };

  return {
    planKey,
    limits,
    used: {
      scoreThisMonth: scoreMonthCount,
      superThisMonth: superMonthCount,
      improveThisMonth: improveMonthCount
    },
    remaining,
    resetsAt: {
      month: nextMonth.toISOString()
    }
  };
}
