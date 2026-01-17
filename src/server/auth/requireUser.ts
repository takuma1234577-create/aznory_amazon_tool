import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }
  return session.user.id;
}
