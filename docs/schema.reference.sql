--
-- PostgreSQL database dump
--

\restrict W1FkApTM5hqKqLEifVOulW7XJRtxxoINCkd89RbMhMePZ7ZP8kapioDBtHoXVIR

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AppointmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AppointmentStatus" AS ENUM (
    'pending_code',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: AttachmentKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttachmentKind" AS ENUM (
    'document',
    'image',
    'other'
);


--
-- Name: ConsultationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ConsultationStatus" AS ENUM (
    'active',
    'ended'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'doctor',
    'patient'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    scheduled_at timestamp(6) with time zone NOT NULL,
    status public."AppointmentStatus" DEFAULT 'pending_code'::public."AppointmentStatus" NOT NULL,
    cancel_reason text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    consultation_id uuid,
    uploader_id uuid NOT NULL,
    file_name text NOT NULL,
    content_type text NOT NULL,
    size_bytes integer NOT NULL,
    kind public."AttachmentKind" NOT NULL,
    storage_key text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text NOT NULL,
    metadata jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: consultations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultations (
    id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    status public."ConsultationStatus" DEFAULT 'active'::public."ConsultationStatus" NOT NULL,
    started_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: medical_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_records (
    id uuid NOT NULL,
    patient_id uuid NOT NULL,
    consultation_id uuid NOT NULL,
    created_by uuid NOT NULL,
    notes text NOT NULL,
    diagnosis text,
    prescriptions text[] DEFAULT ARRAY[]::text[],
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: pre_consult_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_consult_answers (
    id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    question_key text NOT NULL,
    answer text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    revoked_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    role public."UserRole" NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    specialty text,
    crm text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


--
-- Name: validation_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validation_codes (
    id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    consumed_at timestamp(6) with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: pre_consult_answers pre_consult_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_consult_answers
    ADD CONSTRAINT pre_consult_answers_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: validation_codes validation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_codes
    ADD CONSTRAINT validation_codes_pkey PRIMARY KEY (id);


--
-- Name: appointments_doctor_id_scheduled_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_doctor_id_scheduled_at_idx ON public.appointments USING btree (doctor_id, scheduled_at);


--
-- Name: appointments_patient_id_scheduled_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_patient_id_scheduled_at_idx ON public.appointments USING btree (patient_id, scheduled_at DESC);


--
-- Name: appointments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_status_idx ON public.appointments USING btree (status);


--
-- Name: attachments_appointment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attachments_appointment_id_idx ON public.attachments USING btree (appointment_id);


--
-- Name: audit_logs_actor_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_actor_id_created_at_idx ON public.audit_logs USING btree (actor_id, created_at);


--
-- Name: audit_logs_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_resource_type_resource_id_idx ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: consultations_appointment_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consultations_appointment_id_key ON public.consultations USING btree (appointment_id);


--
-- Name: consultations_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consultations_started_at_idx ON public.consultations USING btree (started_at DESC);


--
-- Name: consultations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consultations_status_idx ON public.consultations USING btree (status);


--
-- Name: medical_records_consultation_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX medical_records_consultation_id_key ON public.medical_records USING btree (consultation_id);


--
-- Name: medical_records_patient_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX medical_records_patient_id_created_at_idx ON public.medical_records USING btree (patient_id, created_at DESC);


--
-- Name: pre_consult_answers_appointment_id_question_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pre_consult_answers_appointment_id_question_key_key ON public.pre_consult_answers USING btree (appointment_id, question_key);


--
-- Name: refresh_tokens_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_expires_at_idx ON public.refresh_tokens USING btree (expires_at);


--
-- Name: refresh_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refresh_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens USING btree (user_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_role_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_deleted_at_idx ON public.users USING btree (role, deleted_at);


--
-- Name: validation_codes_appointment_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validation_codes_appointment_id_created_at_idx ON public.validation_codes USING btree (appointment_id, created_at DESC) WHERE (consumed_at IS NULL);


--
-- Name: validation_codes_appointment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validation_codes_appointment_id_idx ON public.validation_codes USING btree (appointment_id);


--
-- Name: appointments appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: attachments attachments_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attachments attachments_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: attachments attachments_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: consultations consultations_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: medical_records medical_records_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: medical_records medical_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: medical_records medical_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pre_consult_answers pre_consult_answers_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_consult_answers
    ADD CONSTRAINT pre_consult_answers_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: validation_codes validation_codes_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_codes
    ADD CONSTRAINT validation_codes_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict W1FkApTM5hqKqLEifVOulW7XJRtxxoINCkd89RbMhMePZ7ZP8kapioDBtHoXVIR

