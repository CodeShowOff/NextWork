import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@workplace.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      status: 'active',
      profile: {
        create: {
          displayName: 'Workplace Admin',
          bio: 'Seeded admin account',
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
