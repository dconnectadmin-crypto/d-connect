import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 10 chars) to create the first admin.");
  }
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) { console.log(`Admin ${email} already exists; nothing to do.`); return; }
  await db.user.create({ data: { name: "Admin", email, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" } });
  console.log(`Created admin ${email}`);
}
main().finally(() => db.$disconnect());
