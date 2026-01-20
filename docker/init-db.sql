-- Vexora Database Initialization Script
-- This script runs automatically when PostgreSQL container starts for the first time

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify pgvector is installed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension is not installed!';
    END IF;
    RAISE NOTICE 'pgvector extension is installed and ready.';
END
$$;

-- Documents table: stores uploaded document metadata
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'pdf',
    file_size BIGINT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    chunk_count INTEGER DEFAULT 0,
    error_message TEXT,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document embeddings table: tracks which embedding models were used
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    embedding_model VARCHAR(255) NOT NULL,
    embedding_dimensions INTEGER NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    weaviate_collection VARCHAR(255),
    UNIQUE(document_id, embedding_model)
);

-- Processing jobs table: tracks document processing status
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    progress INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    worker_id VARCHAR(100)
);

-- Query logs table: tracks user queries for analytics
CREATE TABLE IF NOT EXISTS query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    conversation_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retrieval_time_ms INTEGER,
    chunks_retrieved INTEGER,
    response_time_ms INTEGER,
    documents_used UUID[] DEFAULT '{}',
    user_rating INTEGER,
    rag_enabled BOOLEAN DEFAULT true
);

-- Model configurations table: stores model profiles
CREATE TABLE IF NOT EXISTS model_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id VARCHAR(100) UNIQUE NOT NULL,
    profile_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    llm_model VARCHAR(255) NOT NULL,
    llm_provider VARCHAR(100) DEFAULT 'ollama',
    embedding_model VARCHAR(255) NOT NULL,
    embedding_dimensions INTEGER NOT NULL,
    reranker_model VARCHAR(255),
    chunk_size INTEGER DEFAULT 512,
    chunk_overlap INTEGER DEFAULT 50,
    retrieval_top_k INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RAG settings table: stores user RAG preferences
CREATE TABLE IF NOT EXISTS rag_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date DESC);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_document_id ON processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_priority ON processing_jobs(priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_query_logs_timestamp ON query_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_query_logs_conversation ON query_logs(conversation_id);

CREATE INDEX IF NOT EXISTS idx_model_configurations_active ON model_configurations(is_active) WHERE is_active = true;

-- Insert default RAG settings
INSERT INTO rag_settings (setting_key, setting_value) VALUES
    ('hybrid_alpha', '{"value": 0.5, "description": "Balance between semantic (1.0) and keyword (0.0) search"}'),
    ('top_k', '{"value": 5, "description": "Number of chunks to retrieve"}'),
    ('reranking_enabled', '{"value": true, "description": "Enable reranking for better accuracy"}'),
    ('chunk_size', '{"value": 512, "description": "Size of document chunks in tokens"}'),
    ('chunk_overlap', '{"value": 50, "description": "Overlap between chunks in tokens"}')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default model configuration for MacBook M2 16GB
INSERT INTO model_configurations (
    profile_id,
    profile_name,
    is_active,
    llm_model,
    embedding_model,
    embedding_dimensions,
    reranker_model,
    chunk_size,
    chunk_overlap,
    retrieval_top_k
) VALUES (
    'macbook-m2-16gb',
    'MacBook M2 16GB (Recommended)',
    true,
    'qwen3:8b-q4_K_M',
    'nomic-embed-text',
    768,
    'qwen3-reranker-0.6B',
    512,
    50,
    5
) ON CONFLICT (profile_id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_model_configurations_updated_at ON model_configurations;
CREATE TRIGGER update_model_configurations_updated_at
    BEFORE UPDATE ON model_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rag_settings_updated_at ON rag_settings;
CREATE TRIGGER update_rag_settings_updated_at
    BEFORE UPDATE ON rag_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Vexora database initialized successfully!';
    RAISE NOTICE 'pgvector extension: enabled';
    RAISE NOTICE 'Tables created: documents, document_embeddings, processing_jobs, query_logs, model_configurations, rag_settings';
END
$$;
