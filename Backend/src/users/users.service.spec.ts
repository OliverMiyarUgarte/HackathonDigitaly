import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { User } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AppointmentAccessService } from '../appointments/appointment-access.service';
import { UsersService } from './users.service';

const DOCTOR: AuthenticatedUser = { sub: 'doctor-1', role: 'doctor' };
const PATIENT: AuthenticatedUser = { sub: 'patient-1', role: 'patient' };

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: PATIENT.sub,
    role: 'patient',
    name: 'Joao Pereira',
    email: 'joao@example.test',
    passwordHash: 'argon2-hash',
    specialty: null,
    crm: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

interface UserDelegateMock {
  findFirst: jest.Mock<Promise<User | null>, [unknown]>;
  findMany: jest.Mock<Promise<User[]>, [unknown]>;
  update: jest.Mock<Promise<User>, [unknown]>;
}

interface PrismaMock {
  user: UserDelegateMock;
}

interface AccessMock {
  assertNonCancelledPatientAccess: jest.Mock<Promise<void>, [unknown, string]>;
}

function createPrismaMock(): PrismaMock {
  return {
    user: {
      findFirst: jest.fn<Promise<User | null>, [unknown]>(),
      findMany: jest.fn<Promise<User[]>, [unknown]>(),
      update: jest.fn<Promise<User>, [unknown]>(),
    },
  };
}

function createAccessMock(): AccessMock {
  return {
    assertNonCancelledPatientAccess: jest.fn<Promise<void>, [unknown, string]>(
      () => Promise.resolve(),
    ),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;
  let access: AccessMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    access = createAccessMock();
    service = new UsersService(
      prisma as unknown as PrismaService,
      access as unknown as AppointmentAccessService,
    );
  });

  describe('getMe', () => {
    it('returns the contract user shape without the password hash', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUser());

      const result = await service.getMe(PATIENT);

      expect(result).toEqual({
        id: PATIENT.sub,
        name: 'Joao Pereira',
        email: 'joao@example.test',
        role: 'patient',
        specialty: null,
        crm: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });

    it('rejects when the account is missing or soft-deleted', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getMe(PATIENT)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('updateMe', () => {
    it('updates only the mutable profile fields', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUser({ id: DOCTOR.sub }));
      prisma.user.update.mockResolvedValue(
        buildUser({
          id: DOCTOR.sub,
          role: 'doctor',
          name: 'Dra. Helena Marques',
          specialty: 'Cardiologia',
        }),
      );

      const result = await service.updateMe(DOCTOR, {
        name: '  Dra. Helena Marques  ',
        specialty: ' Cardiologia ',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: DOCTOR.sub },
        data: { name: 'Dra. Helena Marques', specialty: 'Cardiologia' },
      });
      expect(result.name).toBe('Dra. Helena Marques');
      expect(result.specialty).toBe('Cardiologia');
    });

    it('does not touch email, role, or password when only the name changes', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(buildUser({ name: 'Novo Nome' }));

      await service.updateMe(PATIENT, { name: 'Novo Nome' });

      const call = prisma.user.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).toEqual({ name: 'Novo Nome' });
      expect(call.data).not.toHaveProperty('email');
      expect(call.data).not.toHaveProperty('role');
      expect(call.data).not.toHaveProperty('passwordHash');
    });

    it('rejects when the account is missing or soft-deleted', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMe(PATIENT, { name: 'Novo Nome' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('listDoctors', () => {
    it('lists only active doctors and maps the summary shape', async () => {
      prisma.user.findMany.mockResolvedValue([
        buildUser({
          id: DOCTOR.sub,
          role: 'doctor',
          name: 'Dra. Helena Marques',
          specialty: 'Cardiologia',
          crm: 'CRM-SP 123456',
        }),
      ]);

      const result = await service.listDoctors({});

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'doctor', deletedAt: null },
        select: { id: true, name: true, specialty: true, crm: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        {
          id: DOCTOR.sub,
          name: 'Dra. Helena Marques',
          specialty: 'Cardiologia',
          crm: 'CRM-SP 123456',
        },
      ]);
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });

    it('applies case-insensitive specialty and name filters', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.listDoctors({ specialty: ' cardio ', q: ' Helena ' });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'doctor',
          deletedAt: null,
          specialty: { equals: 'cardio', mode: 'insensitive' },
          name: { contains: 'Helena', mode: 'insensitive' },
        },
        select: { id: true, name: true, specialty: true, crm: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getPatient', () => {
    it('returns the patient when a non-cancelled link exists', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUser());

      const result = await service.getPatient(DOCTOR, PATIENT.sub);

      expect(access.assertNonCancelledPatientAccess).toHaveBeenCalledWith(
        DOCTOR,
        PATIENT.sub,
      );
      expect(result.id).toBe(PATIENT.sub);
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });

    it('propagates the access denial for an unlinked doctor', async () => {
      access.assertNonCancelledPatientAccess.mockRejectedValue(
        new ForbiddenException({
          errorCode: 'FORBIDDEN',
          message: 'Access denied',
        }),
      );

      await expect(
        service.getPatient(DOCTOR, PATIENT.sub),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });
});
