import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@1234", 12);

  const user = await prisma.user.upsert({
    where: { email: "admin@mediflow.com" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@mediflow.com",
      passwordHash,
      roles: JSON.stringify(["SUPER_ADMIN"]),
      isActive: true,
    },
  });

  console.log("Admin user created:", user.email);
  console.log("Password: Admin@1234");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
