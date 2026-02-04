-- Migration: Document Processing V2
-- RAG V2 Phase 2 - Multi-Format Support and Advanced Chunking
-- Created: 2024

-- ============================================
-- Add new columns to documents table
-- ============================================

-- File format support (not just PDF)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS file_format VARCHAR(20) DEFAULT 'pdf';

-- Parsing metadata
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS parser_used VARCHAR(50);

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS parsing_duration_ms INTEGER;

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS parsing_warnings JSONB DEFAULT '[]'::jsonb;

-- Chunking version for migration tracking
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS chunking_version VARCHAR(10) DEFAULT 'v1';

-- Total token count (for quota tracking)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0;

-- Page count from parser
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1;

-- Document outline/structure (from parser)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS outline JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- Create chunk_metadata table for V2 chunks
-- ============================================

CREATE TABLE IF NOT EXISTS chunk_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(255) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id VARCHAR(255) NOT NULL,
    chunk_index INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT 2,
    parent_chunk_id VARCHAR(255),
    path VARCHAR(500) NOT NULL,
    chunking_method VARCHAR(50) NOT NULL DEFAULT 'fixed',
    page_start INTEGER DEFAULT 1,
    page_end INTEGER DEFAULT 1,
    token_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Indexes for efficient queries
    CONSTRAINT unique_chunk UNIQUE(document_id, chunk_id)
);

-- Indexes for chunk_metadata
CREATE INDEX IF NOT EXISTS idx_chunk_metadata_document
ON chunk_metadata(document_id);

CREATE INDEX IF NOT EXISTS idx_chunk_metadata_level
ON chunk_metadata(level);

CREATE INDEX IF NOT EXISTS idx_chunk_metadata_parent
ON chunk_metadata(parent_chunk_id);

CREATE INDEX IF NOT EXISTS idx_chunk_metadata_path
ON chunk_metadata(path);

-- ============================================
-- Create parsing_jobs table for tracking
-- ============================================

CREATE TABLE IF NOT EXISTS parsing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(255) REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    parser VARCHAR(50) NOT NULL DEFAULT 'docling',
    file_format VARCHAR(20) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    blocks_extracted INTEGER DEFAULT 0,
    tables_extracted INTEGER DEFAULT 0,
    chunks_created INTEGER DEFAULT 0,
    error_message TEXT,
    warnings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for parsing_jobs
CREATE INDEX IF NOT EXISTS idx_parsing_jobs_document
ON parsing_jobs(document_id);

CREATE INDEX IF NOT EXISTS idx_parsing_jobs_status
ON parsing_jobs(status);

-- ============================================
-- Update file_type constraint to support more formats
-- ============================================

-- Drop old constraint if exists
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_file_type_check;

-- Add new constraint with all supported formats
ALTER TABLE documents
ADD CONSTRAINT documents_file_type_check
CHECK (file_type IN ('pdf', 'docx', 'pptx', 'xlsx', 'html', 'md', 'txt'));

-- ============================================
-- Add functions for chunk hierarchy queries
-- ============================================

-- Function to get all child chunks of a parent
CREATE OR REPLACE FUNCTION get_child_chunks(parent_id VARCHAR)
RETURNS TABLE (
    chunk_id VARCHAR,
    level INTEGER,
    path VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT cm.chunk_id, cm.level, cm.path
    FROM chunk_metadata cm
    WHERE cm.parent_chunk_id = parent_id
    ORDER BY cm.chunk_index;
END;
$$ LANGUAGE plpgsql;

-- Function to get chunk hierarchy for a document
CREATE OR REPLACE FUNCTION get_document_chunk_hierarchy(doc_id VARCHAR)
RETURNS TABLE (
    chunk_id VARCHAR,
    level INTEGER,
    parent_chunk_id VARCHAR,
    path VARCHAR,
    chunking_method VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cm.chunk_id,
        cm.level,
        cm.parent_chunk_id,
        cm.path,
        cm.chunking_method
    FROM chunk_metadata cm
    WHERE cm.document_id = doc_id
    ORDER BY cm.level, cm.chunk_index;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add view for document processing stats
-- ============================================

CREATE OR REPLACE VIEW document_processing_stats AS
SELECT
    d.id,
    d.filename,
    d.file_type,
    d.file_format,
    d.file_size,
    d.page_count,
    d.chunk_count,
    d.total_tokens,
    d.chunking_version,
    d.parser_used,
    d.parsing_duration_ms,
    d.upload_date,
    d.processed_date,
    d.status,
    (SELECT COUNT(*) FROM chunk_metadata cm WHERE cm.document_id = d.id AND cm.level = 0) as doc_chunks,
    (SELECT COUNT(*) FROM chunk_metadata cm WHERE cm.document_id = d.id AND cm.level = 1) as section_chunks,
    (SELECT COUNT(*) FROM chunk_metadata cm WHERE cm.document_id = d.id AND cm.level = 2) as para_chunks
FROM documents d
WHERE d.status = 'completed';

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE chunk_metadata IS 'Stores metadata for V2 hierarchical chunks (actual vectors in Weaviate)';
COMMENT ON TABLE parsing_jobs IS 'Tracks document parsing jobs and their status';
COMMENT ON COLUMN documents.chunking_version IS 'v1 for legacy word-based, v2 for semantic hierarchical';
COMMENT ON COLUMN documents.file_format IS 'Detected file format from parser';
COMMENT ON COLUMN chunk_metadata.level IS '0=document, 1=section, 2=paragraph';
COMMENT ON COLUMN chunk_metadata.path IS 'Hierarchy path like doc/section-1/chunk-0';
