import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { PrismaService } from '../prisma/prisma.service';
import { AppointmentAccessService } from './appointment-access.service';

const DOCTOR: AuthenticatedUser = { sub: 'doctor-1', role: 'doctor' };

describe('AppointmentAccessService', () => {
  let service: AppointmentAccessService;
  let prisma: { appointment: { findFirst: jest.Mock } };

  beforeEach(() => {
    prisma = { appointment: { findFirst: jest.fn() } };
    service = new AppointmentAccessService(prisma as unknown as PrismaService);
  });

  it('scopes patient access to non-cancelled appointments', async () => {
    prisma.appointment.findFirst.mockResolvedValue(null);

    await expect(
      service.assertPatientAccess(DOCTOR, 'patient-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
      where: {
        doctorId: DOCTOR.sub,
        patientId: 'patient-1',
        status: { not: 'cancelled' },
      },
      select: { id: true },
    });
  });

  it('grants access when a non-cancelled link exists', async () => {
    prisma.appointment.findFirst.mockResolvedValue({ id: 'appointment-1' });

    await expect(
      service.assertPatientAccess(DOCTOR, 'patient-1'),
    ).resolves.toBeUndefined();
  });

  it('keeps assertNonCancelledPatientAccess consistent with assertPatientAccess', async () => {
    prisma.appointment.findFirst.mockResolvedValue({ id: 'appointment-1' });

    await expect(
      service.assertNonCancelledPatientAccess(DOCTOR, 'patient-1'),
    ).resolves.toBeUndefined();

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
      where: {
        doctorId: DOCTOR.sub,
        patientId: 'patient-1',
        status: { not: 'cancelled' },
      },
      select: { id: true },
    });
  });
});
