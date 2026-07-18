import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/nextwork';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const email = (process.env.SEED_USER_EMAIL ?? 'admin@gmail.com').toLowerCase();
  const password = process.env.SEED_USER_PASSWORD ?? 'Pass123@';
  const displayName = process.env.SEED_USER_DISPLAY_NAME ?? 'NextWork Admin';
  const now = new Date();

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      status: 'active',
      emailVerifiedAt: now,
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      profile: {
        create: {
          displayName,
          bio: 'Seeded verified account',
        },
      },
    },
    update: {
      passwordHash,
      status: 'active',
      emailVerifiedAt: now,
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      profile: {
        upsert: {
          create: {
            displayName,
            bio: 'Seeded verified account',
          },
          update: {
            displayName,
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      status: true,
    },
  });

  console.log('Seeded verified user:', {
    id: user.id,
    email: user.email,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    password,
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
