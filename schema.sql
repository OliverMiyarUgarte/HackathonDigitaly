--
-- PostgreSQL database dump
--

\restrict ZYa8Dg69NUEW984IYvF2MbyR6D3Z5ijXpkbFJnZZnkk4VXsXJtvKjA6bsQjPOMt

-- Dumped from database version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: consultas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consultas (
    type "char"[],
    doctor_description "char"[],
    id integer NOT NULL,
    patient_description "char"[],
    date_consulta date,
    patient_id integer,
    doctor_id integer,
    ai_feedback text,
    status character varying(30) DEFAULT 'agendada'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.consultas OWNER TO postgres;

--
-- Name: medicos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medicos (
    id integer NOT NULL,
    name "char"[],
    type "char"[],
    email "char"[],
    password integer
);


ALTER TABLE public.medicos OWNER TO postgres;

--
-- Name: pacientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pacientes (
    id integer NOT NULL,
    name "char"[],
    email "char"[],
    password integer,
    description "char"[],
    age integer
);


ALTER TABLE public.pacientes OWNER TO postgres;

--
-- Name: pacientes pk_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pk_id PRIMARY KEY (id);


--
-- Name: consultas pk_id_consultas; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas
    ADD CONSTRAINT pk_id_consultas PRIMARY KEY (id);


--
-- Name: medicos pk_id_medicos; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medicos
    ADD CONSTRAINT pk_id_medicos PRIMARY KEY (id);


--
-- Name: fki_fk_consultas_pacientes; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_fk_consultas_pacientes ON public.consultas USING btree (patient_id);


--
-- Name: fki_p; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_p ON public.consultas USING btree (doctor_id);


--
-- Name: consultas fk_consultas_medicos; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas
    ADD CONSTRAINT fk_consultas_medicos FOREIGN KEY (doctor_id) REFERENCES public.medicos(id) ON DELETE CASCADE NOT VALID;


--
-- Name: consultas fk_consultas_pacientes; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas
    ADD CONSTRAINT fk_consultas_pacientes FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE NOT VALID;


--
-- PostgreSQL database dump complete
--

\unrestrict ZYa8Dg69NUEW984IYvF2MbyR6D3Z5ijXpkbFJnZZnkk4VXsXJtvKjA6bsQjPOMt

