import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getEnv } from "@/lib/env";
import { PlanKey } from "@prisma/client";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? req.headers.get("x-vercel-id") ?? randomUUID();
  
  try {
    const userId = await requireUserId();
    const env = getEnv();

    const body = await req.json();
    const { planKey } = body as { planKey: "SIMPLE" | "PRO" };

    if (planKey !== "SIMPLE" && planKey !== "PRO") {
      return NextResponse.json(
        { error: "Invalid plan key. Must be SIMPLE or PRO." },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customer = await prisma.stripeCustomer.findUnique({
      where: { userId }
    });

    const stripe = getStripe();
    let stripeCustomerId: string;

    if (customer) {
      stripeCustomerId = customer.stripeCustomerId;
    } else {
      // Get user email for Stripe customer creation
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      });

      const stripeCustomer = await stripe.customers.create({
        email: user?.email || undefined,
        name: user?.name || undefined,
        metadata: { userId }
      });

      stripeCustomerId = stripeCustomer.id;

      // Create StripeCustomer record
      customer = await prisma.stripeCustomer.create({
        data: {
          userId,
          stripeCustomerId,
          planKey: PlanKey.FREE
        }
      });
    }

    // Determine price ID
    const priceId = planKey === "SIMPLE" ? env.STRIPE_PRICE_ID_SIMPLE : env.STRIPE_PRICE_ID_PRO;
    if (!priceId) {
      console.error(`[stripe/checkout][${requestId}] STRIPE_PRICE_ID not configured for plan: ${planKey}`);
      return NextResponse.json(
        { ok: false, error: "STRIPE_NOT_CONFIGURED", requestId, message: `Stripe price ID not configured for plan: ${planKey}` },
        { status: 500, headers: { "x-request-id": requestId } }
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${env.NEXTAUTH_URL || "http://localhost:3000"}/settings/billing?success=true`,
      cancel_url: `${env.NEXTAUTH_URL || "http://localhost:3000"}/settings/billing?canceled=true`,
      metadata: {
        userId,
        planKey
      }
    });

    return NextResponse.json(
      { url: session.url },
      { headers: { "x-request-id": requestId } }
    );
  } catch (error) {
    console.error(`[stripe][checkout][${requestId}] Error:`, error);
    return NextResponse.json(
      { 
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
        requestId
      },
      { 
        status: 500,
        headers: { "x-request-id": requestId }
      }
    );
  }
}
