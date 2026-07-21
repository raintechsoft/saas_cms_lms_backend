-- Run in pgAdmin Query Tool as postgres SUPERUSER

-- 1) Create / reset login user (password must match .env)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'saas_admin') THEN
    CREATE ROLE saas_admin LOGIN PASSWORD 'saas_anwin@7736';
  ELSE
    ALTER ROLE saas_admin WITH LOGIN PASSWORD 'saas_anwin@7736';
  END IF;
END
$$;

-- 2) Create database if missing (run once; ignore error if it already exists)
-- CREATE DATABASE saas_cms_lms OWNER saas_admin;

-- If database already exists, just transfer ownership:
ALTER DATABASE saas_cms_lms OWNER TO saas_admin;
GRANT ALL PRIVILEGES ON DATABASE saas_cms_lms TO saas_admin;
