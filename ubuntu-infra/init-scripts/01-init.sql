-- Vexora + Langfuse PostgreSQL Initialization
-- This script runs automatically on first container start

-- ===========================================
-- Langfuse Database
-- ===========================================
CREATE DATABASE langfuse;
CREATE USER langfuse WITH PASSWORD 'langfuse_db_xgw15pmc';
GRANT ALL PRIVILEGES ON DATABASE langfuse TO langfuse;
ALTER DATABASE langfuse OWNER TO langfuse;

-- Grant schema permissions
\c langfuse
GRANT ALL ON SCHEMA public TO langfuse;

-- ===========================================
-- Vexora Database
-- ===========================================
\c postgres
CREATE DATABASE vexora;
CREATE USER vexora WITH PASSWORD 'xgw15pmc';
GRANT ALL PRIVILEGES ON DATABASE vexora TO vexora;
ALTER DATABASE vexora OWNER TO vexora;

\c vexora
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO vexora;

-- ===========================================
-- ADW Projects Database (für spätere Nutzung)
-- ===========================================
\c postgres
CREATE DATABASE adw_projects;
GRANT ALL PRIVILEGES ON DATABASE adw_projects TO vexora;

\c adw_projects
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO vexora;

-- ===========================================
-- Verify Setup
-- ===========================================
\c postgres
SELECT datname FROM pg_database WHERE datname IN ('langfuse', 'vexora', 'adw_projects');
