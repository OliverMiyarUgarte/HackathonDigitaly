import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { SlotsService } from './slots.service';

const DOCTOR_ID = 'd3a0b8c6-d4b0-4320-8b15-ccb927c5914c';
const MONDAY = new Date(2026, 0, 5, 0, 0, 0, 0);
const TUESDAY = new Date(2026, 0, 6, 0, 0, 0, 0);

interface UserDelegateMock {
  findFirst: jest.Mock<Promise<{ id: string } | null>, [unknown]>;
}

interface AppointmentDelegateMock {
  findMany: jest.Mock<Promise<{ scheduledAt: Date }[]>, [unknown]>;
}

interface PrismaMock {
  user: UserDelegateMock;
  appointment: AppointmentDelegateMock;
}

function createPrismaMock(): PrismaMock {
  return {
    user: {
      findFirst: jest.fn<Promise<{ id: string } | null>, [unknown]>(),
    },
    appointment: {
      findMany: jest.fn<Promise<{ scheduledAt: Date }[]>, [unknown]>(),
    },
  };
}

async function expectHttpError(
  promise: Promise<unknown>,
): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected request to fail');
}

describe('SlotsService', () => {
  let service: SlotsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SlotsService(prisma as unknown as PrismaService);
    prisma.user.findFirst.mockResolvedValue({ id: DOCTOR_ID });
    prisma.appointment.findMany.mockResolvedValue([]);
  });

  it('generates deterministic 30-minute slots on weekdays between 09:00 and 17:00', async () => {
    const slots = await service.getSlots(DOCTOR_ID, MONDAY, TUESDAY);

    expect(slots).toHaveLength(16);
    expect(slots[0]).toEqual({
      startsAt: new Date(2026, 0, 5, 9, 0, 0, 0).toISOString(),
      endsAt: new Date(2026, 0, 5, 9, 30, 0, 0).toISOString(),
      doctorId: DOCTOR_ID,
    });
    expect(slots[15]).toEqual({
      startsAt: new Date(2026, 0, 5, 16, 30, 0, 0).toISOString(),
      endsAt: new Date(2026, 0, 5, 17, 0, 0, 0).toISOString(),
      doctorId: DOCTOR_ID,
    });
  });

  it('does not generate slots on weekends', async () => {
    const saturday = new Date(2026, 0, 3, 0, 0, 0, 0);
    const sunday = new Date(2026, 0, 4, 0, 0, 0, 0);

    const slots = await service.getSlots(DOCTOR_ID, saturday, sunday);

    expect(slots).toHaveLength(0);
  });

  it('excludes slots already taken by a non-cancelled appointment', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      { scheduledAt: new Date(2026, 0, 5, 10, 0, 0, 0) },
    ]);

    const slots = await service.getSlots(DOCTOR_ID, MONDAY, TUESDAY);

    expect(slots).toHaveLength(15);
    expect(
      slots.some(
        (slot) =>
          slot.startsAt === new Date(2026, 0, 5, 10, 0, 0, 0).toISOString(),
      ),
    ).toBe(false);
  });

  it('rejects ranges where to is not after from with 400 VALIDATION_FAILED', async () => {
    const error = await expectHttpError(
      service.getSlots(DOCTOR_ID, TUESDAY, MONDAY),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
    });
  });

  it('rejects ranges longer than 31 days with 400 VALIDATION_FAILED', async () => {
    const longEnd = new Date(MONDAY.getTime() + 40 * 24 * 60 * 60 * 1000);

    const error = await expectHttpError(
      service.getSlots(DOCTOR_ID, MONDAY, longEnd),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
    });
  });

  it('rejects an unknown doctor with 404 NOT_FOUND', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const error = await expectHttpError(
      service.getSlots(DOCTOR_ID, MONDAY, TUESDAY),
    );

    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toMatchObject({ errorCode: 'NOT_FOUND' });
  });
});
