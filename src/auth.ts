import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

const env = getEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // Add your providers here (e.g., Google, GitHub)
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/api/auth/signin"
  },
  secret: env.NEXTAUTH_SECRET
});
