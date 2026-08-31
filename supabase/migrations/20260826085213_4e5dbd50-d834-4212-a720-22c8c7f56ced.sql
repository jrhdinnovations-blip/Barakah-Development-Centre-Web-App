ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'case_officer';
CREATE TYPE public.payment_status AS ENUM ('pending','processing','completed','failed','refunded');
CREATE TYPE public.travel_enrolment_status AS ENUM ('enrolled','documents_pending','documents_verified','payment_in_progress','confirmed','completed','cancelled');
CREATE TYPE public.order_status AS ENUM ('placed','payment_confirmed','processing','fulfilled','cancelled');
CREATE TYPE public.case_status AS ENUM ('submitted','intake','assessment','eligibility_review','approved','declined','referred','in_support','follow_up','closed');
CREATE TYPE public.volunteer_application_status AS ENUM ('submitted','under_review','approved','rejected','withdrawn');