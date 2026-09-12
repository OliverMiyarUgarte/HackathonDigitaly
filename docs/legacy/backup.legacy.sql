--
-- PostgreSQL database dump
--

\restrict KEu3O8DVx9VTvyB8R4hfR9UoCM5HK0ntmVx8GTESCwfPpzox8hhlysaNVjGzTtH

-- Dumped from database version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)

-- Started on 2026-09-12 13:24:14 -03

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
-- TOC entry 211 (class 1259 OID 16397)
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
-- TOC entry 210 (class 1259 OID 16392)
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
-- TOC entry 209 (class 1259 OID 16385)
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
-- TOC entry 3370 (class 0 OID 16397)
-- Dependencies: 211
-- Data for Name: consultas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.consultas (type, doctor_description, id, patient_description, date_consulta, patient_id, doctor_id, ai_feedback, status, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3369 (class 0 OID 16392)
-- Dependencies: 210
-- Data for Name: medicos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.medicos (id, name, type, email, password) FROM stdin;
\.


--
-- TOC entry 3368 (class 0 OID 16385)
-- Dependencies: 209
-- Data for Name: pacientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pacientes (id, name, email, password, description, age) FROM stdin;
\.


--
-- TOC entry 3220 (class 2606 OID 16389)
-- Name: pacientes pk_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pk_id PRIMARY KEY (id);


--
-- TOC entry 3226 (class 2606 OID 16403)
-- Name: consultas pk_id_consultas; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas
    ADD CONSTRAINT pk_id_consultas PRIMARY KEY (id);


--
-- TOC entry 3222 (class 2606 OID 16411)
-- Name: medicos pk_id_medicos; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medicos
    ADD CONSTRAINT pk_id_medicos PRIMARY KEY (id);


--
-- TOC entry 3223 (class 1259 OID 16409)
-- Name: fki_fk_consultas_pacientes; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_fk_consultas_pacientes ON public.consultas USING btree (patient_id);


--
-- TOC entry 3224 (class 1259 OID 16417)
-- Name: fki_p; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_p ON public.consultas USING btree (doctor_id);


--
-- TOC entry 3228 (class 2606 OID 16412)
-- Name: consultas fk_consultas_medicos; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas
    ADD CONSTRAINT fk_consultas_medicos FOREIGN KEY (doctor_id) REFERENCES public.medicos(id) ON DELETE CASCADE NOT VALID;


--
-- TOC entry 3227 (class 2606 OID 16404)
-- Name: consultas fk_consultas_pacientes; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas
    ADD CONSTRAINT fk_consultas_pacientes FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE NOT VALID;


-- Completed on 2026-09-12 13:24:14 -03

--
-- PostgreSQL database dump complete
--

\unrestrict KEu3O8DVx9VTvyB8R4hfR9UoCM5HK0ntmVx8GTESCwfPpzox8hhlysaNVjGzTtH

