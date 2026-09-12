import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SlotDto } from '@telemed/service-contracts';
import { PrismaService } from '../prisma/prisma.service';

const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;
const BUSINESS_START_MINUTES = 9 * 60;
const BUSINESS_END_MINUTES = 17 * 60;
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

interface SlotBounds {
  startsAt: Date;
  endsAt: Date;
}

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSlots(doctorId: string, from?: Date, to?: Date): Promise<SlotDto[]> {
    const rangeStart = from ?? new Date();
    const rangeEnd = to ?? new Date(rangeStart.getTime() + DEFAULT_RANGE_MS);
    this.validateRange(rangeStart, rangeEnd);

    const doctor = await this.prisma.user.findFirst({
      where: { id: doctorId, role: 'doctor', deletedAt: null },
      select: { id: true },
    });
    if (!doctor) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        message: 'Doctor not found',
      });
    }

    const booked = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { not: 'cancelled' },
        scheduledAt: {
          gte: new Date(rangeStart.getTime() - SLOT_MS),
          lt: rangeEnd,
        },
      },
      select: { scheduledAt: true },
    });

    return this.generateSlots(rangeStart, rangeEnd)
      .filter(
        (slot) =>
          !booked.some((appointment) =>
            this.overlaps(appointment.scheduledAt, slot),
          ),
      )
      .map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        doctorId,
      }));
  }

  private generateSlots(from: Date, to: Date): SlotBounds[] {
    const slots: SlotBounds[] = [];
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (day.getTime() <= to.getTime()) {
      const weekday = day.getDay();
      if (weekday !== 0 && weekday !== 6) {
        for (
          let minutes = BUSINESS_START_MINUTES;
          minutes + SLOT_MINUTES <= BUSINESS_END_MINUTES;
          minutes += SLOT_MINUTES
        ) {
          const startsAt = new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            0,
            minutes,
            0,
            0,
          );
          if (
            startsAt.getTime() < from.getTime() ||
            startsAt.getTime() >= to.getTime()
          ) {
            continue;
          }
          slots.push({
            startsAt,
            endsAt: new Date(startsAt.getTime() + SLOT_MS),
          });
        }
      }
      day.setDate(day.getDate() + 1);
    }
    return slots;
  }

  private overlaps(existingStart: Date, slot: SlotBounds): boolean {
    const start = existingStart.getTime();
    return (
      start < slot.endsAt.getTime() && start + SLOT_MS > slot.startsAt.getTime()
    );
  }

  private validateRange(from: Date, to: Date): void {
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to.getTime() <= from.getTime()
    ) {
      throw this.validationError('Invalid date range');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw this.validationError('Date range must not exceed 31 days');
    }
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({
      errorCode: 'VALIDATION_FAILED',
      message,
    });
  }
}
