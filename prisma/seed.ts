import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Upsert test user
  const user = await prisma.user.upsert({
    where: {
      email: "test@local.dev"
    },
    update: {
      // 既に存在する場合は更新しない（既存データを保持）
    },
    create: {
      email: "test@local.dev",
      name: "Test User"
    }
  });

  console.log("✅ Test user created/updated:");
  console.log(`   userId: ${user.id}`);
  console.log(`   email: ${user.email}`);
  console.log(`   name: ${user.name || "(null)"}`);
  console.log("");
  console.log("📋 Use this userId in extension settings:");
  console.log(`   ${user.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
