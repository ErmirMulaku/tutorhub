import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** A standard weekday 9–5 schedule in the tutor's local timezone. */
const weekdays9to5 = [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '17:00' }));

async function main(): Promise<void> {
  // Idempotent: clear in FK-safe order, then recreate.
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.student.deleteMany();

  await prisma.tutor.create({
    data: {
      name: 'Ana Marković',
      bio: 'Classical guitarist and music-theory tutor.',
      timezone: 'Europe/Belgrade',
      hourlyCents: 3000,
      workingHours: weekdays9to5,
      subjects: {
        create: [
          { name: 'Guitar', level: 'BEGINNER' },
          { name: 'Music Theory', level: 'INTERMEDIATE' },
        ],
      },
    },
  });

  await prisma.tutor.create({
    data: {
      name: 'Ben Carter',
      bio: 'Maths tutor specialising in calculus and exam prep.',
      timezone: 'America/New_York',
      hourlyCents: 4500,
      workingHours: weekdays9to5,
      subjects: {
        create: [{ name: 'Mathematics', level: 'ADVANCED' }],
      },
    },
  });

  await prisma.tutor.create({
    data: {
      name: 'Chen Wei',
      bio: 'Physics and Mandarin tutor.',
      timezone: 'Asia/Singapore',
      hourlyCents: 4000,
      workingHours: weekdays9to5,
      subjects: {
        create: [
          { name: 'Physics', level: 'INTERMEDIATE' },
          { name: 'Mandarin', level: 'BEGINNER' },
        ],
      },
    },
  });

  await prisma.student.create({
    data: { fullName: 'Sara Student', email: 'sara@example.com' },
  });
}

main()
  .then(async () => {
    const [tutors, subjects, students] = await Promise.all([
      prisma.tutor.count(),
      prisma.subject.count(),
      prisma.student.count(),
    ]);
    console.log(`Seeded ${tutors} tutors, ${subjects} subjects, ${students} student(s).`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
