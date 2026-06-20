import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication } from '@nestjs/common';
import {
  type ClientGrpc,
  ClientProxyFactory,
  type MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { type Observable, firstValueFrom, lastValueFrom, take } from 'rxjs';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PROTO_PATH = fileURLToPath(new URL('../../../proto/booking.proto', import.meta.url));
const GRPC_URL = 'localhost:50071';

interface Timestamp {
  seconds: number;
  nanos: number;
}
interface GrpcBooking {
  id: string;
  tutorId: string;
  status: string;
  startTime: Timestamp;
}
interface BookingGrpc {
  GetBooking(req: { id: string }): Observable<GrpcBooking>;
  BookLesson(req: {
    tutorId: string;
    studentId: string;
    subjectId: string;
    startTime: Timestamp;
  }): Observable<GrpcBooking>;
  UpdateStatus(req: { id: string; status: string }): Observable<GrpcBooking>;
  WatchBookings(req: { tutorId: string }): Observable<GrpcBooking>;
}

const grpcOptions = {
  transport: Transport.GRPC as const,
  options: {
    package: 'tutorhub.v1',
    protoPath: PROTO_PATH,
    url: GRPC_URL,
    loader: { longs: Number, enums: String, defaults: true, oneofs: true },
  },
};

describe('gRPC BookingService (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: BookingGrpc;

  let tutorId = '';
  let studentId = '';
  let subjectId = '';
  let bookingId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.connectMicroservice<MicroserviceOptions>(grpcOptions);
    await app.startAllMicroservices();
    await app.init();

    prisma = app.get(PrismaService);
    const tutor = await prisma.tutor.create({
      data: {
        name: 'gRPC Tutor',
        timezone: 'UTC',
        hourlyCents: 3000,
        workingHours: [{ day: 1, start: '09:00', end: '17:00' }],
        subjects: { create: [{ name: 'gRPC Subject', level: 'BEGINNER' }] },
      },
      include: { subjects: true },
    });
    tutorId = tutor.id;
    subjectId = tutor.subjects[0]?.id ?? '';
    const student = await prisma.student.create({
      data: { fullName: 'gRPC Student', email: `grpc+${Date.now().toString()}@example.com` },
    });
    studentId = student.id;

    const client: ClientGrpc = ClientProxyFactory.create(grpcOptions);
    svc = client.getService<BookingGrpc>('BookingService');
  });

  afterAll(async () => {
    if (bookingId !== '') await prisma.booking.deleteMany({ where: { id: bookingId } });
    if (subjectId !== '') await prisma.subject.deleteMany({ where: { id: subjectId } });
    if (tutorId !== '') await prisma.tutor.deleteMany({ where: { id: tutorId } });
    if (studentId !== '') await prisma.student.deleteMany({ where: { id: studentId } });
    await app.close();
  });

  it('BookLesson creates a PENDING booking', async () => {
    const booking = await lastValueFrom(
      svc.BookLesson({
        tutorId,
        studentId,
        subjectId,
        startTime: { seconds: Math.floor(Date.UTC(2025, 5, 2, 9) / 1000), nanos: 0 },
      }),
    );
    bookingId = booking.id;
    expect(booking.status).toBe('PENDING');
    expect(booking.tutorId).toBe(tutorId);
  });

  it('GetBooking returns the booking', async () => {
    const booking = await lastValueFrom(svc.GetBooking({ id: bookingId }));
    expect(booking.id).toBe(bookingId);
  });

  it('GetBooking maps a missing id to NOT_FOUND', async () => {
    await expect(
      lastValueFrom(svc.GetBooking({ id: '00000000-0000-0000-0000-000000000000' })),
    ).rejects.toMatchObject({ code: GrpcStatus.NOT_FOUND });
  });

  it('UpdateStatus advances the lifecycle and rejects illegal transitions', async () => {
    const confirmed = await lastValueFrom(svc.UpdateStatus({ id: bookingId, status: 'CONFIRMED' }));
    expect(confirmed.status).toBe('CONFIRMED');

    await expect(
      lastValueFrom(svc.UpdateStatus({ id: bookingId, status: 'PENDING' })),
    ).rejects.toMatchObject({ code: GrpcStatus.FAILED_PRECONDITION });
  });

  it('WatchBookings streams a booking when its status changes', async () => {
    const received = firstValueFrom(svc.WatchBookings({ tutorId }).pipe(take(1)));
    await new Promise((resolve) => setTimeout(resolve, 500)); // let the stream attach
    await lastValueFrom(svc.UpdateStatus({ id: bookingId, status: 'COMPLETED' }));

    const streamed = await received;
    expect(streamed.id).toBe(bookingId);
    expect(streamed.status).toBe('COMPLETED');
  });
});
