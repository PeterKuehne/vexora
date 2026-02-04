-- Migration 007: Graph Entities
-- Part of RAG V2 Phase 4: Intelligence & Production
--
-- Creates tables for storing entities and relationships
-- that are synced with Neo4j for graph traversal.

-- ============================================
-- Entities Table
-- ============================================
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  text TEXT NOT NULL,
  canonical_form TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  neo4j_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for entities
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_canonical ON entities(canonical_form);
CREATE INDEX IF NOT EXISTS idx_entities_text ON entities USING gin(to_tsvector('german', text));
CREATE INDEX IF NOT EXISTS idx_entities_neo4j_synced ON entities(neo4j_synced) WHERE NOT neo4j_synced;
CREATE INDEX IF NOT EXISTS idx_entities_created ON entities(created_at DESC);

-- ============================================
-- Entity Occurrences Table
-- ============================================
CREATE TABLE IF NOT EXISTS entity_occurrences (
  id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  document_id VARCHAR(255) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL,
  position INTEGER,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for occurrences
CREATE INDEX IF NOT EXISTS idx_occurrences_entity ON entity_occurrences(entity_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_document ON entity_occurrences(document_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_chunk ON entity_occurrences(chunk_id);

-- ============================================
-- Entity Relationships Table
-- ============================================
CREATE TABLE IF NOT EXISTS entity_relationships (
  id UUID PRIMARY KEY,
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence TEXT,
  document_id VARCHAR(255) REFERENCES documents(id) ON DELETE SET NULL,
  extraction_method VARCHAR(20) NOT NULL CHECK (extraction_method IN ('pattern', 'spacy', 'llm')),
  neo4j_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for relationships
CREATE INDEX IF NOT EXISTS idx_relationships_source ON entity_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON entity_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON entity_relationships(type);
CREATE INDEX IF NOT EXISTS idx_relationships_document ON entity_relationships(document_id);
CREATE INDEX IF NOT EXISTS idx_relationships_neo4j_synced ON entity_relationships(neo4j_synced) WHERE NOT neo4j_synced;

-- ============================================
-- Entity Merge History (for auditing)
-- ============================================
CREATE TABLE IF NOT EXISTS entity_merge_history (
  id SERIAL PRIMARY KEY,
  merged_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_entity_ids UUID[] NOT NULL,
  merge_method VARCHAR(50) NOT NULL,
  similarity_score DECIMAL(4,3),
  merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merge_history_entity ON entity_merge_history(merged_entity_id);

-- ============================================
-- Graph Statistics View
-- ============================================
CREATE OR REPLACE VIEW graph_statistics AS
SELECT
  (SELECT COUNT(*) FROM entities) as total_entities,
  (SELECT COUNT(*) FROM entity_relationships) as total_relationships,
  (SELECT COUNT(DISTINCT document_id) FROM entity_occurrences) as documents_with_entities,
  (SELECT COUNT(*) FROM entities WHERE neo4j_synced) as entities_synced,
  (SELECT COUNT(*) FROM entity_relationships WHERE neo4j_synced) as relationships_synced,
  (SELECT json_object_agg(type, cnt) FROM (
    SELECT type, COUNT(*) as cnt FROM entities GROUP BY type
  ) t) as entities_by_type,
  (SELECT json_object_agg(type, cnt) FROM (
    SELECT type, COUNT(*) as cnt FROM entity_relationships GROUP BY type
  ) t) as relationships_by_type;

-- ============================================
-- Trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_entities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entities_updated_at ON entities;
CREATE TRIGGER entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_entities_updated_at();

-- ============================================
-- Function to get entity statistics per document
-- ============================================
CREATE OR REPLACE FUNCTION get_document_entity_stats(doc_id VARCHAR(255))
RETURNS TABLE (
  entity_type VARCHAR(50),
  entity_count BIGINT,
  relationship_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.type as entity_type,
    COUNT(DISTINCT e.id) as entity_count,
    COUNT(DISTINCT r.id) as relationship_count
  FROM entities e
  JOIN entity_occurrences eo ON e.id = eo.entity_id
  LEFT JOIN entity_relationships r ON (r.source_entity_id = e.id OR r.target_entity_id = e.id)
  WHERE eo.document_id = doc_id
  GROUP BY e.type;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE entities IS 'Stores extracted entities from documents, synced with Neo4j';
COMMENT ON TABLE entity_occurrences IS 'Tracks where entities appear in documents and chunks';
COMMENT ON TABLE entity_relationships IS 'Stores relationships between entities, synced with Neo4j';
COMMENT ON TABLE entity_merge_history IS 'Audit trail for entity resolution merges';
COMMENT ON VIEW graph_statistics IS 'Overview statistics for the knowledge graph';
