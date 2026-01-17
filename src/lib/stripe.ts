import Stripe from "stripe";
import { getEnv } from "./env";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const env = getEnv();
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia"
    });
  }
  return stripeInstance;
}
