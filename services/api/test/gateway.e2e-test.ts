import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Socket, io } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { BookingService } from '../src/bookings/booking.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PORT = 4101;

interface BookingChanged {
  id: string;
  tutorId: string;
  status: string;
}

describe('BookingsGateway (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookings: BookingService;
  let client: Socket;

  let tutorId = '';
  let studentId = '';
  let subjectId = '';
  let bookingId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(PORT);

    prisma = app.get(PrismaService);
    bookings = app.get(BookingService);
    const tutor = await prisma.tutor.create({
      data: {
        name: 'WS Tutor',
        timezone: 'UTC',
        hourlyCents: 3000,
        workingHours: [{ day: 1, start: '09:00', end: '17:00' }],
        subjects: { create: [{ name: 'WS Subject', level: 'BEGINNER' }] },
      },
      include: { subjects: true },
    });
    tutorId = tutor.id;
    subjectId = tutor.subjects[0]?.id ?? '';
    const student = await prisma.student.create({
      data: { fullName: 'WS Student', email: `ws+${Date.now().toString()}@example.com` },
    });
    studentId = student.id;

    client = io(`http://localhost:${PORT.toString()}`, { transports: ['websocket'] });
    await new Promise<void>((resolve) =>
      client.on('connect', () => {
        resolve();
      }),
    );
  });

  afterAll(async () => {
    client.close();
    if (bookingId !== '') await prisma.booking.deleteMany({ where: { id: bookingId } });
    if (subjectId !== '') await prisma.subject.deleteMany({ where: { id: subjectId } });
    if (tutorId !== '') await prisma.tutor.deleteMany({ where: { id: tutorId } });
    if (studentId !== '') await prisma.student.deleteMany({ where: { id: studentId } });
    await app.close();
  });

  it('pushes a bookingChanged event to a subscribed tutor room', async () => {
    await new Promise<void>((resolve) => {
      client.emit('subscribeTutor', { tutorId }, () => {
        resolve();
      });
    });

    const received = new Promise<BookingChanged>((resolve) => {
      client.once('bookingChanged', (payload: BookingChanged) => {
        resolve(payload);
      });
    });

    const booking = await bookings.create({
      tutorId,
      studentId,
      subjectId,
      startTime: '2025-06-02T09:00:00.000Z',
      endTime: '2025-06-02T10:00:00.000Z',
    });
    bookingId = booking.id;

    const payload = await received;
    expect(payload.id).toBe(booking.id);
    expect(payload.tutorId).toBe(tutorId);
    expect(payload.status).toBe('PENDING');
  });
});
