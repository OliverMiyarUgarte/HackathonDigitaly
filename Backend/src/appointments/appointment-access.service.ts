import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { Appointment } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppointmentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAppointmentAccess(
    user: AuthenticatedUser,
    appointmentId: string,
  ): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...(user.role === 'patient'
          ? { patientId: user.sub }
          : { doctorId: user.sub }),
      },
    });
    if (!appointment) {
      throw this.forbidden();
    }
    return appointment;
  }

  async assertPatientAccess(
    doctor: AuthenticatedUser,
    patientId: string,
  ): Promise<void> {
    const link = await this.prisma.appointment.findFirst({
      where: { doctorId: doctor.sub, patientId },
      select: { id: true },
    });
    if (!link) {
      throw this.forbidden();
    }
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      errorCode: 'FORBIDDEN',
      message: 'Access denied',
    });
  }
}
