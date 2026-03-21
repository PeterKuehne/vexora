-- Cor7ex + Langfuse PostgreSQL Initialization
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
-- Cor7ex Database
-- ===========================================
\c postgres
CREATE DATABASE cor7ex;
CREATE USER cor7ex WITH PASSWORD 'xgw15pmc';
GRANT ALL PRIVILEGES ON DATABASE cor7ex TO cor7ex;
ALTER DATABASE cor7ex OWNER TO cor7ex;

\c cor7ex
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO cor7ex;

-- ===========================================
-- ADW Projects Database (für spätere Nutzung)
-- ===========================================
\c postgres
CREATE DATABASE adw_projects;
GRANT ALL PRIVILEGES ON DATABASE adw_projects TO cor7ex;

\c adw_projects
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO cor7ex;

-- ===========================================
-- Verify Setup
-- ===========================================
\c postgres
SELECT datname FROM pg_database WHERE datname IN ('langfuse', 'cor7ex', 'adw_projects');
