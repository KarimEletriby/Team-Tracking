-- ========================================================================
-- STEP 1: Add 'admin' to app_role enum
-- Run this single line in Supabase SQL Editor and click RUN.
-- ========================================================================

alter type public.app_role add value if not exists 'admin';
