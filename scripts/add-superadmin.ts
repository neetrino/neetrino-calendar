/**
 * Добавляет суперадмина в Neon (один раз).
 * Запуск: npx tsx scripts/add-superadmin.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const SUPERADMIN = {
  email: "admin@neetrino.com",
  password: "admin123",
  name: "Super Admin",
  role: "ADMIN",
};

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: SUPERADMIN.email },
    include: { permissions: true },
  });

  if (existing) {
    console.log(`[OK] Пользователь ${SUPERADMIN.email} уже существует.`);
    return;
  }

  const passwordHash = await hashPassword(SUPERADMIN.password);
  const admin = await prisma.user.create({
    data: {
      name: SUPERADMIN.name,
      email: SUPERADMIN.email,
      passwordHash,
      role: SUPERADMIN.role,
    },
  });

  for (const module of ["meetings", "deadlines", "schedule"]) {
    await prisma.userPermission.create({
      data: {
        userId: admin.id,
        module,
        myLevel: "EDIT",
        allLevel: "EDIT",
      },
    });
  }

  console.log(`[OK] Создан суперадмин: ${SUPERADMIN.email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
