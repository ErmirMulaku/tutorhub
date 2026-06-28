import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password.js';
import { Level, NotificationType, PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** A standard weekday 9–5 schedule in the tutor's local timezone. */
const weekdays9to5 = [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '17:00' }));

interface SeedSubject {
  name: string;
  level: Level;
}

interface SeedTutor {
  name: string;
  avatarColor: string;
  timezone: string;
  priceCents: number;
  totalLessons: number;
  responseTime: string;
  headline: string;
  languages: string[];
  badges: string[];
  bio: string;
  subjects: SeedSubject[];
  /** Tutor-dashboard credentials. Only the persona tutor gets these. */
  email?: string;
  password?: string;
}

const TUTORS: SeedTutor[] = [
  {
    // The tutor-dashboard persona (design handoff). Signs into apps/dashboard.
    name: 'Lena Hartmann',
    avatarColor: 'teal',
    timezone: 'Europe/Berlin',
    priceCents: 5500,
    totalLessons: 214,
    responseTime: '~30 min',
    headline: 'Maths & Physics — patient, exam-focused tutoring',
    languages: ['English', 'German'],
    badges: ['Top rated', 'Fast responder', 'Verified'],
    bio: 'Maths and Physics tutor for A-Level, IB and first-year university. I turn intimidating problems into calm, repeatable methods — and every session ends with a clear next step.',
    subjects: [
      { name: 'Mathematics', level: Level.ADVANCED },
      { name: 'Physics', level: Level.ADVANCED },
    ],
    email: 'lena@tutor.example.com',
    password: 'password123',
  },
  {
    name: 'Sara Khan',
    avatarColor: 'teal',
    timezone: 'Europe/London',
    priceCents: 4200,
    totalLessons: 1820,
    responseTime: '~1 hr',
    headline: 'Maths & Physics — calm, exam-focused sessions',
    languages: ['English', 'Urdu'],
    badges: ['Top rated', 'Fast responder'],
    bio: 'Former secondary-school head of maths with 9 years of one-to-one tutoring. I break hard problems into calm, repeatable steps — and we always end a session knowing exactly what to practise next.',
    subjects: [
      { name: 'Mathematics', level: Level.ADVANCED },
      { name: 'Physics', level: Level.INTERMEDIATE },
    ],
  },
  {
    name: 'Daniel Lopez',
    avatarColor: 'amber',
    timezone: 'Europe/Madrid',
    priceCents: 3500,
    totalLessons: 740,
    responseTime: '~2 hrs',
    headline: 'Guitar & music theory for every level',
    languages: ['English', 'Spanish'],
    badges: ['Top rated'],
    bio: 'Session guitarist and teacher. Whether you want to play your first three chords or understand the modes, we build real songs from week one. Acoustic and electric; theory only as much as you want it.',
    subjects: [
      { name: 'Guitar', level: Level.BEGINNER },
      { name: 'Music Theory', level: Level.INTERMEDIATE },
    ],
  },
  {
    name: 'Mei Chen',
    avatarColor: 'rose',
    timezone: 'Asia/Singapore',
    priceCents: 4000,
    totalLessons: 1310,
    responseTime: '~30 min',
    headline: 'Mandarin from first words to fluency',
    languages: ['English', 'Mandarin'],
    badges: ['Fast responder', 'Verified'],
    bio: 'Native Mandarin speaker and certified HSK examiner. Conversation-first lessons with the grammar you actually need. I tailor each session to your goal — travel, business, or exams.',
    subjects: [
      { name: 'Mandarin', level: Level.BEGINNER },
      { name: 'Mandarin', level: Level.ADVANCED },
    ],
  },
  {
    name: 'Amara Okafor',
    avatarColor: 'green',
    timezone: 'Africa/Lagos',
    priceCents: 4800,
    totalLessons: 1495,
    responseTime: '~1 hr',
    headline: 'Chemistry & Biology, made intuitive',
    languages: ['English'],
    badges: ['Top rated', 'Verified'],
    bio: 'PhD in biochemistry and a decade of teaching. I help students see the why behind reactions and systems, not just memorise them. Great fit for A-level, IB and first-year university.',
    subjects: [
      { name: 'Chemistry', level: Level.ADVANCED },
      { name: 'Biology', level: Level.INTERMEDIATE },
    ],
  },
  {
    name: 'James Wright',
    avatarColor: 'blue',
    timezone: 'America/New_York',
    priceCents: 3800,
    totalLessons: 980,
    responseTime: '~3 hrs',
    headline: 'English literature & confident writing',
    languages: ['English'],
    badges: [],
    bio: 'Published writer and former university tutor. We read closely, argue clearly, and write essays that actually say something. I love working with students who think they "aren\'t good at English".',
    subjects: [
      { name: 'English Literature', level: Level.ADVANCED },
      { name: 'Essay Writing', level: Level.INTERMEDIATE },
    ],
  },
  {
    name: 'Priya Sharma',
    avatarColor: 'violet',
    timezone: 'Asia/Kolkata',
    priceCents: 5200,
    totalLessons: 1670,
    responseTime: '~45 min',
    headline: 'Maths & computer science for builders',
    languages: ['English', 'Hindi'],
    badges: ['Top rated', 'Fast responder', 'Verified'],
    bio: "Software engineer turned tutor. From algebra to algorithms, I teach the concepts that compound. Project-based when it helps — you'll write code and prove theorems, not just watch.",
    subjects: [
      { name: 'Mathematics', level: Level.ADVANCED },
      { name: 'Computer Science', level: Level.ADVANCED },
    ],
  },
  {
    name: 'Lucas Müller',
    avatarColor: 'amber',
    timezone: 'Europe/Berlin',
    priceCents: 3000,
    totalLessons: 520,
    responseTime: '~4 hrs',
    headline: 'German & history, conversational and clear',
    languages: ['English', 'German'],
    badges: [],
    bio: 'History graduate and lifelong language nerd. Relaxed, conversation-led German lessons and history sessions that connect the dots between events. Beginners very welcome.',
    subjects: [
      { name: 'German', level: Level.BEGINNER },
      { name: 'History', level: Level.INTERMEDIATE },
    ],
  },
  {
    name: 'Sofia Rossi',
    avatarColor: 'rose',
    timezone: 'Europe/Rome',
    priceCents: 3400,
    totalLessons: 1120,
    responseTime: '~1 hr',
    headline: 'Spanish & Italian with real conversation',
    languages: ['English', 'Italian', 'Spanish'],
    badges: ['Verified'],
    bio: 'Bilingual teacher who believes you learn a language by speaking it. Expect to talk from minute one, with gentle correction and the vocabulary that matters for your life.',
    subjects: [
      { name: 'Spanish', level: Level.INTERMEDIATE },
      { name: 'Italian', level: Level.BEGINNER },
    ],
  },
  {
    name: 'Omar Haddad',
    avatarColor: 'teal',
    timezone: 'Asia/Dubai',
    priceCents: 4500,
    totalLessons: 1340,
    responseTime: '~30 min',
    headline: 'Physics & maths, intuition first',
    languages: ['English', 'Arabic'],
    badges: ['Top rated', 'Fast responder'],
    bio: 'Engineer and examiner. I teach physics as a way of seeing the world, then back it with the maths. Strong track record with IB, A-level and university entrance prep.',
    subjects: [
      { name: 'Physics', level: Level.ADVANCED },
      { name: 'Mathematics', level: Level.INTERMEDIATE },
    ],
  },
  {
    name: 'Hannah Lee',
    avatarColor: 'violet',
    timezone: 'Asia/Seoul',
    priceCents: 4400,
    totalLessons: 610,
    responseTime: '~2 hrs',
    headline: 'Piano & theory for joyful practice',
    languages: ['English', 'Korean'],
    badges: ['Top rated'],
    bio: 'Conservatory-trained pianist. Lessons that balance technique, musicality and the pieces you actually want to play. Adults returning to piano are my favourite students.',
    subjects: [
      { name: 'Piano', level: Level.BEGINNER },
      { name: 'Music Theory', level: Level.ADVANCED },
    ],
  },
];

async function main(): Promise<void> {
  // Idempotent: clear in FK-safe order, then recreate.
  await prisma.notification.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.giftCard.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.student.deleteMany();

  const tutorsByName = new Map<string, { id: string; subjectIds: string[] }>();
  for (const t of TUTORS) {
    const created = await prisma.tutor.create({
      data: {
        name: t.name,
        bio: t.bio,
        headline: t.headline,
        timezone: t.timezone,
        hourlyCents: t.priceCents,
        avatarColor: t.avatarColor,
        languages: t.languages,
        badges: t.badges,
        responseTime: t.responseTime,
        totalLessons: t.totalLessons,
        workingHours: weekdays9to5,
        email: t.email,
        passwordHash: t.password ? hashPassword(t.password) : null,
        emailVerified: t.email ? true : false,
        subjects: { create: t.subjects },
      },
      include: { subjects: true },
    });
    tutorsByName.set(t.name, {
      id: created.id,
      subjectIds: created.subjects.map((s) => s.id),
    });
  }

  // Demo student kept at sara@example.com so the existing dev-login still works.
  const student = await prisma.student.create({
    data: {
      fullName: 'Alex Morgan',
      email: 'sara@example.com',
      phone: '+44 7700 900 123',
      avatarColor: 'violet',
      walletCents: 7500,
      emailVerified: true,
      paymentMethods: {
        create: [{ brand: 'visa', last4: '4242', expMonth: 8, expYear: 2027 }],
      },
      giftCards: {
        create: [
          {
            code: 'TH-4F9K-22ZQ',
            amountCents: 5000,
            balanceCents: 5000,
            design: 0,
            fromName: 'Mum',
          },
        ],
      },
    },
  });

  // A few favourites and bookings across statuses for the lessons/favourites screens.
  const priya = tutorsByName.get('Priya Sharma');
  const sara = tutorsByName.get('Sara Khan');
  const daniel = tutorsByName.get('Daniel Lopez');
  const mei = tutorsByName.get('Mei Chen');
  if (priya && sara && daniel && mei) {
    await prisma.favorite.createMany({
      data: [daniel, mei, tutorsByName.get('Omar Haddad')]
        .filter((t): t is { id: string; subjectIds: string[] } => Boolean(t))
        .map((t) => ({ studentId: student.id, tutorId: t.id })),
    });

    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const mk = (
      tutor: { id: string; subjectIds: string[] },
      startOffset: number,
      status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
    ): {
      tutorId: string;
      subjectId: string;
      studentId: string;
      startTime: Date;
      endTime: Date;
      status: typeof status;
    } => {
      const start = new Date(now + startOffset);
      return {
        tutorId: tutor.id,
        subjectId: tutor.subjectIds[0] as string,
        studentId: student.id,
        startTime: start,
        endTime: new Date(start.getTime() + hour),
        status,
      };
    };
    await prisma.booking.create({ data: mk(priya, 2 * day, 'CONFIRMED') });
    await prisma.booking.create({ data: mk(sara, 4 * day, 'PENDING') });
    const completed = await prisma.booking.create({ data: mk(daniel, -7 * day, 'COMPLETED') });
    await prisma.booking.create({ data: mk(mei, -14 * day, 'COMPLETED') });
    // Leave one completed booking reviewed so the profile shows a review.
    await prisma.review.create({
      data: {
        bookingId: completed.id,
        tutorId: daniel.id,
        rating: 5,
        comment:
          'Daniel makes practice feel like playing. Three chords to my first song in a month.',
      },
    });

    // Header notification feed. The client renders localised title/body from
    // `type` + these params, and a relative timestamp from `createdAt`.
    const min = 60 * 1000;
    await prisma.notification.createMany({
      data: [
        {
          studentId: student.id,
          type: NotificationType.BOOKING_CONFIRMED,
          actorName: 'Priya',
          detail: 'Computer Science',
          read: false,
          createdAt: new Date(now - 2 * hour),
        },
        {
          studentId: student.id,
          type: NotificationType.LESSON_REMINDER,
          actorName: 'Sara',
          detail: 'Mathematics',
          read: false,
          createdAt: new Date(now - 5 * hour),
        },
        {
          studentId: student.id,
          type: NotificationType.REVIEW_PROMPT,
          actorName: 'Daniel',
          detail: 'Guitar',
          read: false,
          createdAt: new Date(now - day - 30 * min),
        },
        {
          studentId: student.id,
          type: NotificationType.GIFT_RECEIVED,
          actorName: 'Mum',
          detail: '$50',
          read: true,
          createdAt: new Date(now - 3 * day),
        },
      ],
    });
  }

  // --- Tutor-dashboard data for the persona (Lena Hartmann) ---
  const lena = tutorsByName.get('Lena Hartmann');
  if (lena) {
    const [maths, physics] = lena.subjectIds;
    // A roster of students who book Lena (varied names/avatars on the dashboard).
    const roster = await Promise.all(
      [
        { fullName: 'Mia Chen', avatarColor: 'rose' },
        { fullName: 'Tom Becker', avatarColor: 'blue' },
        { fullName: 'Sofia Ricci', avatarColor: 'amber' },
        { fullName: 'Noah Schmidt', avatarColor: 'green' },
      ].map((s, i) =>
        prisma.student.create({
          data: {
            fullName: s.fullName,
            email: `student${String(i + 1)}@lena.example.com`,
            avatarColor: s.avatarColor,
            emailVerified: true,
          },
        }),
      ),
    );
    const [mia, tom, sofia, noah] = roster;
    if (!mia || !tom || !sofia || !noah || maths === undefined || physics === undefined) {
      throw new Error('Seed invariant: Lena needs four students and two subjects.');
    }

    /** A booking on `dayOffset` at local `hour`, fixed 60-min slot. */
    const slot = (dayOffset: number, hour: number): { startTime: Date; endTime: Date } => {
      const start = new Date();
      start.setDate(start.getDate() + dayOffset);
      start.setHours(hour, 0, 0, 0);
      return { startTime: start, endTime: new Date(start.getTime() + 60 * 60 * 1000) };
    };
    type Stu = (typeof roster)[number];
    const lessons: {
      student: Stu;
      subjectId: string;
      when: { startTime: Date; endTime: Date };
      status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
      review?: { rating: number; comment: string };
    }[] = [
      // Today
      { student: mia, subjectId: maths, when: slot(0, 9), status: 'COMPLETED' },
      { student: tom, subjectId: physics, when: slot(0, 14), status: 'CONFIRMED' },
      { student: sofia, subjectId: maths, when: slot(0, 16), status: 'CONFIRMED' },
      // Upcoming
      { student: noah, subjectId: physics, when: slot(1, 10), status: 'CONFIRMED' },
      { student: mia, subjectId: maths, when: slot(2, 15), status: 'CONFIRMED' },
      // Pending (the "Pending" badge + accept/decline flow)
      { student: tom, subjectId: maths, when: slot(2, 11), status: 'PENDING' },
      { student: sofia, subjectId: physics, when: slot(3, 13), status: 'PENDING' },
      // Past completed (earnings + reviews + analytics)
      {
        student: sofia,
        subjectId: maths,
        when: slot(-1, 10),
        status: 'COMPLETED',
        review: { rating: 5, comment: 'Lena explained vectors so clearly — finally clicked!' },
      },
      {
        student: noah,
        subjectId: physics,
        when: slot(-3, 13),
        status: 'COMPLETED',
        review: { rating: 5, comment: 'Calm, patient and incredibly well prepared every week.' },
      },
      {
        student: mia,
        subjectId: maths,
        when: slot(-7, 9),
        status: 'COMPLETED',
        review: { rating: 4, comment: 'Great session, would have liked a few more practice sums.' },
      },
      { student: tom, subjectId: physics, when: slot(-10, 16), status: 'CANCELLED' },
    ];

    for (const l of lessons) {
      const booking = await prisma.booking.create({
        data: {
          tutorId: lena.id,
          studentId: l.student.id,
          subjectId: l.subjectId,
          startTime: l.when.startTime,
          endTime: l.when.endTime,
          status: l.status,
        },
      });
      if (l.review) {
        await prisma.review.create({
          data: {
            bookingId: booking.id,
            tutorId: lena.id,
            rating: l.review.rating,
            comment: l.review.comment,
          },
        });
      }
    }

    // Catalog services (1:1, group, package) and a time-off range.
    await prisma.service.createMany({
      data: [
        {
          tutorId: lena.id,
          subjectId: maths,
          name: 'One-to-one Maths',
          type: 'ONE_ON_ONE',
          level: Level.ADVANCED,
          description: 'Focused 1:1 maths tutoring for A-Level, IB and university entrance.',
          priceCents: 5500,
          durationMin: 60,
          lessonsCount: 1,
        },
        {
          tutorId: lena.id,
          subjectId: physics,
          name: 'One-to-one Physics',
          type: 'ONE_ON_ONE',
          level: Level.ADVANCED,
          description: 'Build real intuition for mechanics, fields and modern physics.',
          priceCents: 5500,
          durationMin: 60,
          lessonsCount: 1,
        },
        {
          tutorId: lena.id,
          subjectId: maths,
          name: 'Exam-prep bundle',
          type: 'PACKAGE',
          level: Level.ADVANCED,
          description: 'Five-lesson intensive ahead of exams, with a practice plan.',
          priceCents: 25000,
          durationMin: 60,
          lessonsCount: 5,
        },
        {
          tutorId: lena.id,
          subjectId: physics,
          name: 'Group problem-solving',
          type: 'GROUP',
          level: Level.INTERMEDIATE,
          description: 'Small-group physics problem clinics (max 4 students).',
          priceCents: 3000,
          durationMin: 90,
          lessonsCount: 1,
          isActive: false,
        },
      ],
    });

    const offStart = new Date();
    offStart.setDate(offStart.getDate() + 20);
    const offEnd = new Date(offStart);
    offEnd.setDate(offEnd.getDate() + 7);
    await prisma.timeOff.create({
      data: { tutorId: lena.id, label: '🏖 Summer break', startDate: offStart, endDate: offEnd },
    });
  }
}

main()
  .then(async () => {
    const [tutors, subjects, students, favorites] = await Promise.all([
      prisma.tutor.count(),
      prisma.subject.count(),
      prisma.student.count(),
      prisma.favorite.count(),
    ]);
    console.log(
      `Seeded ${tutors} tutors, ${subjects} subjects, ${students} student(s), ${favorites} favourite(s).`,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
