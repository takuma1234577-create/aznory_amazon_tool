import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getEnv } from "@/lib/env";
import { PlanKey } from "@prisma/client";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const env = getEnv();
  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe][webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planKey = session.metadata?.planKey as PlanKey;

        if (!userId || !planKey) {
          console.error("[stripe][webhook] Missing userId or planKey in session metadata");
          break;
        }

        // Get subscription ID from session
        const subscriptionId = session.subscription as string | null;

        if (!subscriptionId) {
          console.error("[stripe][webhook] Missing subscription ID in session");
          break;
        }

        // Get subscription to get current period end
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

        // Update or create StripeCustomer
        await prisma.stripeCustomer.upsert({
          where: { userId },
          update: {
            planKey: planKey as PlanKey,
            subscriptionId,
            subscriptionStatus: subscription.status,
            currentPeriodEnd
          },
          create: {
            userId,
            stripeCustomerId: session.customer as string,
            planKey: planKey as PlanKey,
            subscriptionId,
            subscriptionStatus: subscription.status,
            currentPeriodEnd
          }
        });

        console.log(`[stripe][webhook] Updated user ${userId} to plan ${planKey}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find StripeCustomer by customerId
        const customer = await prisma.stripeCustomer.findUnique({
          where: { stripeCustomerId: customerId }
        });

        if (!customer) {
          console.error(`[stripe][webhook] Customer not found: ${customerId}`);
          break;
        }

        // Determine planKey from price ID
        const priceId = subscription.items.data[0]?.price.id;
        let planKey: PlanKey = PlanKey.FREE;
        
        if (env.STRIPE_PRICE_ID_SIMPLE && priceId === env.STRIPE_PRICE_ID_SIMPLE) {
          planKey = PlanKey.SIMPLE;
        } else if (env.STRIPE_PRICE_ID_PRO && priceId === env.STRIPE_PRICE_ID_PRO) {
          planKey = PlanKey.PRO;
        }

        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

        // Update StripeCustomer
        await prisma.stripeCustomer.update({
          where: { stripeCustomerId: customerId },
          data: {
            planKey,
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            currentPeriodEnd
          }
        });

        console.log(`[stripe][webhook] Updated subscription ${subscription.id} for user ${customer.userId} to plan ${planKey}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find StripeCustomer by customerId
        const customer = await prisma.stripeCustomer.findUnique({
          where: { stripeCustomerId: customerId }
        });

        if (!customer) {
          console.error(`[stripe][webhook] Customer not found: ${customerId}`);
          break;
        }

        // Update StripeCustomer to FREE
        await prisma.stripeCustomer.update({
          where: { stripeCustomerId: customerId },
          data: {
            planKey: PlanKey.FREE,
            subscriptionId: null,
            subscriptionStatus: null,
            currentPeriodEnd: null
          }
        });

        console.log(`[stripe][webhook] Updated user ${customer.userId} to FREE plan (subscription deleted)`);
        break;
      }

      default:
        console.log(`[stripe][webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe][webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
