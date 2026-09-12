import 'dotenv/config';
import { argon2id, hash } from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

const DEMO_PASSWORD = 'Demo@1234';

const DEMO_IDS = {
  pendingAppointment: 'a0000000-0000-4000-8000-000000000001',
  confirmedAppointment: 'a0000000-0000-4000-8000-000000000002',
  completedAppointment: 'a0000000-0000-4000-8000-000000000003',
  consumedCodeAppointment: 'a0000000-0000-4000-8000-000000000004',
  completedConsultation: 'c0000000-0000-4000-8000-000000000001',
  medicalRecord: 'd0000000-0000-4000-8000-000000000001',
  consumedValidationCode: 'e0000000-0000-4000-8000-000000000001',
};

const preConsultAnswers = [
  { questionKey: 'chief_complaint', answer: 'Palpitacoes frequentes em repouso' },
  { questionKey: 'symptom_duration', answer: 'Cerca de tres semanas' },
  { questionKey: 'current_medications', answer: 'Losartana 50mg' },
  { questionKey: 'allergies', answer: 'Nega alergias medicamentosas' },
  { questionKey: 'medical_history', answer: 'Hipertensao arterial, sem internacoes recentes' },
] as const;

function hashValidationCode(
  pepper: string,
  appointmentId: string,
  code: string,
): string {
  return createHmac('sha256', pepper)
    .update(`${appointmentId}:${code}`)
    .digest('hex');
}

async function main(): Promise<void> {
  const otpPepper = process.env.OTP_PEPPER;
  if (!otpPepper) {
    throw new Error('OTP_PEPPER is required to seed the demo validation code');
  }

  const passwordHash = await hash(DEMO_PASSWORD, { type: argon2id });

  const doctor = await prisma.user.upsert({
    where: { email: 'medico@digitaly.health' },
    update: {
      role: 'doctor',
      name: 'Dra. Helena Marques',
      specialty: 'Cardiologia',
      crm: 'CRM-SP 123456',
      passwordHash,
      deletedAt: null,
    },
    create: {
      role: 'doctor',
      name: 'Dra. Helena Marques',
      email: 'medico@digitaly.health',
      specialty: 'Cardiologia',
      crm: 'CRM-SP 123456',
      passwordHash,
    },
  });

  const doctorTwo = await prisma.user.upsert({
    where: { email: 'medico2@digitaly.health' },
    update: {
      role: 'doctor',
      name: 'Dr. Rafael Nogueira',
      specialty: 'Dermatologia',
      crm: 'CRM-RJ 654321',
      passwordHash,
      deletedAt: null,
    },
    create: {
      role: 'doctor',
      name: 'Dr. Rafael Nogueira',
      email: 'medico2@digitaly.health',
      specialty: 'Dermatologia',
      crm: 'CRM-RJ 654321',
      passwordHash,
    },
  });

  const patient = await prisma.user.upsert({
    where: { email: 'paciente@digitaly.health' },
    update: {
      role: 'patient',
      name: 'Joao Pereira',
      passwordHash,
      deletedAt: null,
    },
    create: {
      role: 'patient',
      name: 'Joao Pereira',
      email: 'paciente@digitaly.health',
      passwordHash,
    },
  });

  const patientTwo = await prisma.user.upsert({
    where: { email: 'paciente2@digitaly.health' },
    update: {
      role: 'patient',
      name: 'Maria Souza',
      passwordHash,
      deletedAt: null,
    },
    create: {
      role: 'patient',
      name: 'Maria Souza',
      email: 'paciente2@digitaly.health',
      passwordHash,
    },
  });

  const now = new Date();
  const oneDayAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const twoHoursAhead = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const threeHoursAhead = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(lastWeek.getTime() + 30 * 60 * 1000);
  const consumedAt = new Date(now.getTime() - 5 * 60 * 1000);
  const consumedCodeExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const consumedCodeHash = hashValidationCode(
    otpPepper,
    DEMO_IDS.consumedCodeAppointment,
    '482913',
  );

  const pendingAppointment = await prisma.appointment.upsert({
    where: { id: DEMO_IDS.pendingAppointment },
    update: {
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: oneDayAhead,
      status: 'pending_code',
      cancelReason: null,
    },
    create: {
      id: DEMO_IDS.pendingAppointment,
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: oneDayAhead,
      status: 'pending_code',
    },
  });

  await prisma.appointment.upsert({
    where: { id: DEMO_IDS.confirmedAppointment },
    update: {
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: twoHoursAhead,
      status: 'confirmed',
      cancelReason: null,
    },
    create: {
      id: DEMO_IDS.confirmedAppointment,
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: twoHoursAhead,
      status: 'confirmed',
    },
  });

  const consumedCodeAppointment = await prisma.appointment.upsert({
    where: { id: DEMO_IDS.consumedCodeAppointment },
    update: {
      patientId: patientTwo.id,
      doctorId: doctorTwo.id,
      scheduledAt: threeHoursAhead,
      status: 'confirmed',
      cancelReason: null,
    },
    create: {
      id: DEMO_IDS.consumedCodeAppointment,
      patientId: patientTwo.id,
      doctorId: doctorTwo.id,
      scheduledAt: threeHoursAhead,
      status: 'confirmed',
    },
  });

  const completedAppointment = await prisma.appointment.upsert({
    where: { id: DEMO_IDS.completedAppointment },
    update: {
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: lastWeek,
      status: 'completed',
      cancelReason: null,
    },
    create: {
      id: DEMO_IDS.completedAppointment,
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: lastWeek,
      status: 'completed',
    },
  });

  const consultation = await prisma.consultation.upsert({
    where: { appointmentId: completedAppointment.id },
    update: {
      status: 'ended',
      startedAt: lastWeek,
      endedAt: lastWeekEnd,
    },
    create: {
      id: DEMO_IDS.completedConsultation,
      appointmentId: completedAppointment.id,
      status: 'ended',
      startedAt: lastWeek,
      endedAt: lastWeekEnd,
    },
  });

  await prisma.medicalRecord.upsert({
    where: { consultationId: consultation.id },
    update: {
      patientId: patient.id,
      createdBy: doctor.id,
      notes:
        'Paciente relata palpitacoes em repouso. Exame fisico sem alteracoes. Orientada hidratacao e retorno em 30 dias.',
      diagnosis: 'Hipertensao arterial sistemica compensada',
      prescriptions: ['Losartana 50mg 2x ao dia', 'Hidroclorotiazida 25mg 1x ao dia'],
    },
    create: {
      id: DEMO_IDS.medicalRecord,
      patientId: patient.id,
      consultationId: consultation.id,
      createdBy: doctor.id,
      notes:
        'Paciente relata palpitacoes em repouso. Exame fisico sem alteracoes. Orientada hidratacao e retorno em 30 dias.',
      diagnosis: 'Hipertensao arterial sistemica compensada',
      prescriptions: ['Losartana 50mg 2x ao dia', 'Hidroclorotiazida 25mg 1x ao dia'],
    },
  });

  for (const item of preConsultAnswers) {
    await prisma.preConsultAnswer.upsert({
      where: {
        appointmentId_questionKey: {
          appointmentId: completedAppointment.id,
          questionKey: item.questionKey,
        },
      },
      update: { answer: item.answer },
      create: {
        appointmentId: completedAppointment.id,
        questionKey: item.questionKey,
        answer: item.answer,
      },
    });
  }

  await prisma.validationCode.upsert({
    where: { id: DEMO_IDS.consumedValidationCode },
    update: {
      appointmentId: consumedCodeAppointment.id,
      codeHash: consumedCodeHash,
      expiresAt: consumedCodeExpiresAt,
      consumedAt,
      attempts: 1,
    },
    create: {
      id: DEMO_IDS.consumedValidationCode,
      appointmentId: consumedCodeAppointment.id,
      codeHash: consumedCodeHash,
      expiresAt: consumedCodeExpiresAt,
      consumedAt,
      attempts: 1,
    },
  });

  console.log(`Seeded demo users: ${doctor.email}, ${doctorTwo.email}, ${patient.email}, ${patientTwo.email}`);
  console.log(`Pending appointment: ${pendingAppointment.id}`);
  console.log(`Confirmed with consumed code: ${consumedCodeAppointment.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
