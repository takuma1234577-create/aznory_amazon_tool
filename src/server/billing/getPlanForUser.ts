import { PlanKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = typeof prisma;

export async function getPlanForUser(userId: string): Promise<PlanKey> {
  return getPlanForUserWithDb(userId, prisma);
}

export async function getPlanForUserWithDb(userId: string, db: Db): Promise<PlanKey> {
  const customer = await db.stripeCustomer.findUnique({
    where: { userId },
    select: { planKey: true }
  });

  return customer?.planKey ?? PlanKey.FREE;
}
