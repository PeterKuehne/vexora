# RAG V2 Specification

## Advanced Retrieval-Augmented Generation System

**Version:** 2.1
**Status:** Proposed (Validated)
**Date:** 2026-01-29
**Last Updated:** 2026-01-29
**Authors:** Development Team

---

## 1. Executive Summary

This specification outlines the upgrade from our current RAG implementation to a modern, modular RAG architecture that supports:

- **Multi-format document processing** (PDF, DOCX, PPTX, XLSX, HTML, Markdown)
- **Semantic and hierarchical chunking** for better context preservation
- **Cross-encoder reranking** for improved precision
- **Graph-based retrieval** for complex entity relationships
- **Agentic query routing** for optimal retrieval strategy selection
- **Comprehensive evaluation framework** for measuring quality
- **Observability and guardrails** for production reliability

### Current Limitations

| Area | Current State | Problem |
|------|---------------|---------|
| Formats | PDF only (unpdf) | Cannot process Office documents, presentations |
| Chunking | Fixed 500 words + 50 overlap | Breaks semantic units, loses table structure |
| Retrieval | Hybrid search, top 5 | No reranking, misses relevant chunks |
| Structure | Flat chunks | Cannot represent hierarchies or relationships |
| Reasoning | Single-hop | Fails on multi-hop questions |
| Evaluation | None | No metrics to measure improvement |
| Observability | Audit logs only | No RAG pipeline tracing |

### Target Improvements

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Format Support | 1 (PDF) | 6+ formats | Count |
| Precision@5 | ~60% (estimated) | 85%+ | Golden Dataset |
| Recall@20 | ~70% (estimated) | 90%+ | Golden Dataset |
| Multi-hop Accuracy | ~40% (estimated) | 85%+ | Golden Dataset |
| Groundedness | Unknown | 95%+ | LLM Evaluation |
| Complex Table Extraction | ~70% | 95%+ | Parser Benchmark |
| Query Latency (p95) | <500ms | <800ms | Monitoring |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAG V2 ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     1. DOCUMENT INGESTION                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │  │   Hybrid    │  │   Entity    │  │  Metadata   │                │ │
│  │  │   Parser    │  │  Extractor  │  │  Enricher   │                │ │
│  │  │ (Docling +  │  │  (spaCy +   │  │             │                │ │
│  │  │ LlamaParse) │  │    LLM)     │  │             │                │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │ │
│  └─────────┼────────────────┼────────────────┼───────────────────────┘ │
│            │                │                │                          │
│            ▼                ▼                ▼                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      2. CHUNKING LAYER                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │  │  Semantic   │  │   Table     │  │Hierarchical │                │ │
│  │  │  Chunker    │  │  Chunker    │  │  Indexer    │                │ │
│  │  │  + Late     │  │             │  │             │                │ │
│  │  │  Chunking   │  │             │  │             │                │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │ │
│  └─────────┼────────────────┼────────────────┼───────────────────────┘ │
│            │                │                │                          │
│            ▼                ▼                ▼                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      3. MULTI-INDEX STORAGE                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │  │  Weaviate   │  │    Neo4j    │  │ PostgreSQL  │                │ │
│  │  │  (Vectors)  │  │   (Graph)   │  │ (Metadata)  │                │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      4. RETRIEVAL LAYER                            │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │  │   Query     │  │   Hybrid    │  │   Graph     │                │ │
│  │  │   Router    │  │  Retriever  │  │ Refinement  │                │ │
│  │  │             │  │  (Primary)  │  │(Post-Query) │                │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │ │
│  │         │                │                │                        │ │
│  │         └────────────────┼────────────────┘                        │ │
│  │                          ▼                                         │ │
│  │                   ┌─────────────┐                                  │ │
│  │                   │  Reranker   │                                  │ │
│  │                   │(BGE/Cohere) │                                  │ │
│  │                   └──────┬──────┘                                  │ │
│  └──────────────────────────┼────────────────────────────────────────┘ │
│                             ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      5. GENERATION LAYER                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │  │  Context    │  │    LLM      │  │  Citation   │                │ │
│  │  │ Compressor  │  │  (Ollama)   │  │  Injector   │                │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      6. QUALITY LAYER                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │  │ Guardrails  │  │ Evaluation  │  │Observability│                │ │
│  │  │  (I/O)      │  │  Service    │  │  (Tracing)  │                │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Document Ingestion Layer

#### 3.1.1 Hybrid Document Parser

**Purpose:** Extract structured content from multiple document formats with fallback strategy for maximum accuracy.

**Primary Parser:** [Docling](https://github.com/DS4SD/docling) (IBM Research, Open Source)
**Fallback Parser:** [LlamaParse](https://cloud.llamaindex.ai/) (for complex tables)

**Rationale:** Based on [2025 Benchmarks](https://procycons.com/en/blogs/pdf-data-extraction-benchmark/):
- Docling: 97.9% accuracy on complex tables, best structural fidelity
- LlamaParse: Fastest (~6s), excellent table structure preservation
- No single tool is perfect; hybrid approach covers edge cases

**Parser Routing Logic:**

```typescript
interface ParserRoutingConfig {
  // Use Docling for most documents
  primary: 'docling';

  // Fallback conditions
  fallbackConditions: {
    tableHeavy: boolean;      // >50% content is tables → LlamaParse
    complexLayout: boolean;   // Multi-column, forms → LlamaParse
    doclingFailed: boolean;   // Parse error → LlamaParse
    handwritten: boolean;     // Handwritten content → OCR + LLM
  };

  // Validation
  validateOutput: boolean;    // Cross-check critical sections
}

async function parseDocument(
  file: Buffer,
  fileType: string,
  config: ParserRoutingConfig
): Promise<ParsedDocument> {
  // 1. Analyze document characteristics
  const analysis = await analyzeDocument(file, fileType);

  // 2. Select parser
  let parser: 'docling' | 'llamaparse' | 'hybrid' = 'docling';

  if (analysis.tableRatio > 0.5 || analysis.isMultiColumn) {
    parser = 'llamaparse';
  }

  // 3. Parse with primary
  try {
    const result = await parsers[parser].parse(file);

    // 4. Validate critical sections (tables)
    if (config.validateOutput && result.tables.length > 0) {
      const validated = await crossValidateTables(result, file);
      return validated;
    }

    return result;
  } catch (error) {
    // 5. Fallback on error
    if (parser === 'docling') {
      return parsers.llamaparse.parse(file);
    }
    throw error;
  }
}
```

**Supported Formats:**

| Format | Extension | Primary Parser | Fallback |
|--------|-----------|----------------|----------|
| PDF | .pdf | Docling | LlamaParse |
| Word | .docx | Docling | - |
| PowerPoint | .pptx | Docling | - |
| Excel | .xlsx | Docling | LlamaParse (tables) |
| HTML | .html | Docling | - |
| Markdown | .md | Native | - |
| Images | .png, .jpg | Docling OCR | Tesseract |

**Output Structure:**

```typescript
interface ParsedDocument {
  id: string;
  metadata: DocumentMetadata;
  structure: DocumentStructure;
  content: ContentBlock[];
  parserUsed: 'docling' | 'llamaparse' | 'hybrid';
  parsingConfidence: number;
  warnings: ParsingWarning[];
}

interface DocumentStructure {
  title: string;
  sections: Section[];
  tableOfContents: TOCEntry[];
}

interface ContentBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'table' | 'list' | 'image' | 'code';
  content: string;
  level?: number;
  parentId?: string;
  pageNumber?: number;
  boundingBox?: BoundingBox;
  tableData?: TableStructure;
  confidence: number;  // Parser confidence for this block
}

interface TableStructure {
  headers: string[];
  rows: string[][];
  caption?: string;
  extractionMethod: 'docling' | 'llamaparse' | 'validated';
}

interface ParsingWarning {
  type: 'low_confidence' | 'fallback_used' | 'validation_mismatch';
  blockId?: string;
  message: string;
}
```

**Configuration:**

```typescript
interface HybridParserConfig {
  // Docling settings
  docling: {
    ocrEnabled: boolean;
    ocrLanguages: string[];
    tableExtractionMode: 'fast' | 'accurate';
    imageExtraction: boolean;
    maxFileSize: number;
    timeout: number;
  };

  // LlamaParse settings
  llamaparse: {
    apiKey: string;
    parsingInstructions?: string;
    resultType: 'markdown' | 'text';
    skipDiagonalText: boolean;
    invalidateCache: boolean;
  };

  // Routing settings
  routing: ParserRoutingConfig;
}
```

#### 3.1.2 Entity Extractor

**Purpose:** Extract named entities and relationships for Graph RAG.

**Technology:**
- Primary: spaCy (de_core_news_lg) for German NER
- Secondary: LLM-based extraction for complex relationships
- Resolution: LLM-assisted entity deduplication

**Entity Types:**

| Category | Examples | Extraction Method |
|----------|----------|-------------------|
| PERSON | Employee names, contacts | spaCy + LLM |
| ORG | Company names, departments | spaCy + LLM |
| PROJECT | Project codes, names | Pattern + LLM |
| PRODUCT | Product names, SKUs | Pattern + LLM |
| DATE | Dates, deadlines | spaCy |
| MONEY | Amounts, budgets | spaCy |
| LOCATION | Offices, addresses | spaCy |
| DOCUMENT | Referenced documents | Pattern |
| REGULATION | Laws, policies, standards | Pattern + LLM |

**Entity Resolution (Deduplication):**

```typescript
interface EntityResolutionConfig {
  // Similarity threshold for merging
  similarityThreshold: number;  // Default: 0.85

  // Methods
  methods: {
    exactMatch: boolean;           // "Max Mustermann" === "Max Mustermann"
    fuzzyMatch: boolean;           // "Max Mustermann" ≈ "M. Mustermann"
    llmAssisted: boolean;          // LLM confirms if same entity
    contextAware: boolean;         // Use surrounding text
  };

  // LLM settings for resolution
  llm: {
    model: string;
    prompt: string;
    batchSize: number;
  };
}

async function resolveEntities(
  entities: Entity[],
  config: EntityResolutionConfig
): Promise<ResolvedEntity[]> {
  // 1. Group by exact match
  const groups = groupByExactMatch(entities);

  // 2. Fuzzy match within groups
  const fuzzyGroups = await fuzzyMatchGroups(groups, config.similarityThreshold);

  // 3. LLM-assisted resolution for ambiguous cases
  if (config.methods.llmAssisted) {
    const ambiguous = fuzzyGroups.filter(g => g.confidence < 0.9);
    const resolved = await llmResolveEntities(ambiguous, config.llm);
    return mergeResolved(fuzzyGroups, resolved);
  }

  return fuzzyGroups;
}
```

**Output:**

```typescript
interface ExtractedEntities {
  entities: ResolvedEntity[];
  relationships: Relationship[];
  resolutionStats: {
    totalExtracted: number;
    afterResolution: number;
    mergedCount: number;
    llmAssistedCount: number;
  };
}

interface ResolvedEntity {
  id: string;
  canonicalForm: string;        // Normalized name
  aliases: string[];            // All variations found
  type: EntityType;
  confidence: number;
  occurrences: Occurrence[];
  metadata: Record<string, any>;
}

interface Relationship {
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationType;
  confidence: number;
  evidence: string;
  extractionMethod: 'pattern' | 'spacy' | 'llm';
}

type RelationType =
  | 'WORKS_FOR'
  | 'MANAGES'
  | 'OWNS'
  | 'REFERENCES'
  | 'PART_OF'
  | 'RELATED_TO'
  | 'CREATED_BY'
  | 'APPROVED_BY'
  | 'REPORTS_TO'
  | 'COLLABORATES_WITH';
```

#### 3.1.3 Metadata Enricher

**Purpose:** Augment documents with derived metadata for filtering and routing.

**Enrichment Fields:**

```typescript
interface EnrichedMetadata {
  // Basic (from upload)
  filename: string;
  fileType: string;
  uploadedAt: Date;
  uploadedBy: string;

  // Derived
  language: string;
  documentType: DocumentType;
  topics: string[];
  summary: string;
  keyPhrases: string[];
  readingLevel: string;

  // Structural
  pageCount: number;
  wordCount: number;
  tableCount: number;
  imageCount: number;
  sectionCount: number;

  // Quality indicators
  parserConfidence: number;
  extractionWarnings: string[];

  // Classification (existing)
  classification: Classification;
  visibility: Visibility;
  department: string;
}

type DocumentType =
  | 'contract'
  | 'invoice'
  | 'report'
  | 'manual'
  | 'presentation'
  | 'correspondence'
  | 'policy'
  | 'specification'
  | 'meeting_notes'
  | 'other';
```

---

### 3.2 Chunking Layer

#### 3.2.1 Semantic Chunker

**Purpose:** Split text based on semantic boundaries rather than fixed token counts.

**Algorithm:**

1. Split document into sentences
2. Generate embeddings for each sentence
3. Calculate cosine similarity between consecutive sentences
4. Identify breakpoints where similarity drops below threshold
5. Group sentences into semantically coherent chunks

**Configuration:**

```typescript
interface SemanticChunkerConfig {
  embeddingModel: string;
  breakpointThresholdType: 'percentile' | 'standard_deviation' | 'interquartile';
  breakpointThresholdAmount: number;
  minChunkSize: number;
  maxChunkSize: number;
  sentenceSplitter: 'nltk' | 'spacy';
}

// Recommended defaults based on NVIDIA benchmarks
const SEMANTIC_CHUNKER_DEFAULTS: SemanticChunkerConfig = {
  embeddingModel: 'nomic-embed-text',  // Or selected from benchmark
  breakpointThresholdType: 'percentile',
  breakpointThresholdAmount: 95,
  minChunkSize: 100,   // tokens
  maxChunkSize: 1000,  // tokens
  sentenceSplitter: 'spacy',
};
```

#### 3.2.2 Late Chunking

**Purpose:** Improve retrieval for long documents with pronouns and indirect references.

**Rationale:** Based on [2025 research](https://weaviate.io/blog/chunking-strategies-for-rag):
> "Late chunking shows improved semantic memory over longer passages, sustaining high similarity scores even when contextual clues are sparse."

**Algorithm:**

1. Generate embeddings for the FULL document first (or large windows)
2. THEN chunk the document
3. Each chunk inherits contextual understanding from full-document embedding
4. Better handling of: pronouns, indirect references, cross-section context

**When to Use:**

```typescript
interface LateChunkingConfig {
  enabled: boolean;

  // Conditions for late chunking
  conditions: {
    minDocumentLength: number;      // Default: 5000 tokens
    hasHighPronounDensity: boolean; // Detected via NLP
    isReferenceHeavy: boolean;      // Legal docs, manuals
    documentTypes: DocumentType[];  // ['manual', 'policy', 'contract']
  };

  // Window size for embedding
  embeddingWindowSize: number;  // Default: 8192 tokens (model max)
  overlapTokens: number;        // Default: 512
}

function shouldUseLateChunking(
  document: ParsedDocument,
  config: LateChunkingConfig
): boolean {
  if (!config.enabled) return false;

  const tokenCount = countTokens(document.content);
  if (tokenCount < config.conditions.minDocumentLength) return false;

  if (config.conditions.documentTypes.includes(document.metadata.documentType)) {
    return true;
  }

  // Analyze pronoun density
  const pronounDensity = analyzePronounDensity(document.content);
  if (pronounDensity > 0.05) return true;  // >5% pronouns

  return false;
}
```

**Output:**

```typescript
interface SemanticChunk {
  id: string;
  documentId: string;
  content: string;
  tokenCount: number;
  sentenceCount: number;
  startPage: number;
  endPage: number;
  semanticDensity: number;
  embedding?: number[];
  chunkingMethod: 'semantic' | 'late' | 'fixed';
}
```

#### 3.2.3 Table Chunker

**Purpose:** Process tables as structured data units, not raw text.

**Strategy:**

1. Detect tables in parsed document
2. For small tables (< 20 rows): Keep as single chunk with markdown format
3. For large tables: Split by row groups, include headers in each chunk
4. Generate table summary as separate chunk
5. Create table-specific embedding using serialized representation

**Output:**

```typescript
interface TableChunk {
  id: string;
  documentId: string;
  tableId: string;
  type: 'full_table' | 'table_segment' | 'table_summary';
  content: string;
  headers: string[];
  rowRange?: [number, number];
  caption?: string;
  pageNumber: number;
  embedding?: number[];
}
```

#### 3.2.4 Hierarchical Indexer

**Purpose:** Create parent-child chunk relationships for context-aware retrieval.

**Structure:**

```
Document Level (L0)
├── Section Level (L1) - "Parent Chunks"
│   ├── Paragraph Level (L2) - "Child Chunks" (retrieved)
│   ├── Paragraph Level (L2)
│   └── Table Level (L2)
├── Section Level (L1)
│   ├── Subsection Level (L1.5)
│   │   ├── Paragraph Level (L2)
│   │   └── Paragraph Level (L2)
│   └── Paragraph Level (L2)
```

**Retrieval Strategy:**

1. Search at child level (L2) for precision
2. On match, include parent chunk (L1) for context
3. Optionally include sibling chunks for continuity

**Schema:**

```typescript
interface HierarchicalChunk {
  id: string;
  documentId: string;
  level: 0 | 1 | 2;
  parentId?: string;
  childIds: string[];
  siblingIds: string[];
  path: string;
  content: string;
  embedding?: number[];
  includeParentInContext: boolean;
  includeSiblingsInContext: boolean;
}
```

---

### 3.3 Multi-Index Storage

#### 3.3.1 Weaviate (Vector Store)

**Purpose:** Store embeddings and perform hybrid search.

**Collections:**

```typescript
// Main chunk collection
const DocumentChunksV2 = {
  name: 'DocumentChunksV2',
  properties: [
    { name: 'documentId', dataType: 'text', indexFilterable: true },
    { name: 'chunkId', dataType: 'text', indexFilterable: true },
    { name: 'content', dataType: 'text', indexSearchable: true },
    { name: 'chunkType', dataType: 'text', indexFilterable: true },
    { name: 'chunkingMethod', dataType: 'text', indexFilterable: true },
    { name: 'level', dataType: 'int', indexFilterable: true },
    { name: 'parentId', dataType: 'text', indexFilterable: true },
    { name: 'pageNumber', dataType: 'int', indexFilterable: true },
    { name: 'tokenCount', dataType: 'int' },
    { name: 'documentType', dataType: 'text', indexFilterable: true },
    { name: 'department', dataType: 'text', indexFilterable: true },
    { name: 'topics', dataType: 'text[]', indexFilterable: true },
  ],
  vectorizers: [
    {
      name: 'content_vector',
      model: 'selected-from-benchmark',  // See Section 4.1
      dimensions: 768,  // Or model-specific
    }
  ],
};

// Table-specific collection
const TableChunks = {
  name: 'TableChunks',
  properties: [
    { name: 'documentId', dataType: 'text', indexFilterable: true },
    { name: 'tableId', dataType: 'text', indexFilterable: true },
    { name: 'content', dataType: 'text', indexSearchable: true },
    { name: 'headers', dataType: 'text[]' },
    { name: 'caption', dataType: 'text', indexSearchable: true },
    { name: 'rowCount', dataType: 'int' },
    { name: 'columnCount', dataType: 'int' },
  ],
  vectorizers: [
    {
      name: 'table_vector',
      model: 'selected-from-benchmark',
      dimensions: 768,
    }
  ],
};
```

#### 3.3.2 Neo4j (Knowledge Graph)

**Purpose:** Store entities, relationships, and enable graph-based refinement.

**Important:** Graph is used for POST-QUERY REFINEMENT, not primary retrieval.

**Rationale:** Based on [Qdrant GraphRAG Guide](https://qdrant.tech/documentation/examples/graphrag-qdrant-neo4j/):
> "Graph databases can struggle with real-time queries on large datasets due to complex traversals. A hybrid approach—using dense retrieval for speed and graph refinement for post-query analysis—can provide a more practical solution."

**Node Types:**

```cypher
// Document nodes
(:Document {
  id: string,
  title: string,
  type: string,
  uploadedAt: datetime,
  department: string
})

// Entity nodes
(:Person { id: string, name: string, role?: string, aliases: [string] })
(:Organization { id: string, name: string, type?: string, aliases: [string] })
(:Project { id: string, name: string, status?: string })
(:Product { id: string, name: string, sku?: string })
(:Topic { id: string, name: string })

// Chunk nodes (for linking)
(:Chunk {
  id: string,
  documentId: string,
  preview: string
})
```

**Relationship Types:**

```cypher
// Document relationships
(d:Document)-[:CONTAINS]->(c:Chunk)
(d:Document)-[:ABOUT]->(t:Topic)
(d:Document)-[:MENTIONS]->(e:Entity)

// Entity relationships
(p:Person)-[:WORKS_FOR]->(o:Organization)
(p:Person)-[:MANAGES]->(proj:Project)
(p:Person)-[:CREATED]->(d:Document)
(p:Person)-[:REPORTS_TO]->(p2:Person)
(proj:Project)-[:USES]->(prod:Product)
(d1:Document)-[:REFERENCES]->(d2:Document)

// Chunk relationships
(c1:Chunk)-[:NEXT]->(c2:Chunk)
(c:Chunk)-[:MENTIONS]->(e:Entity)
```

**Graph Sync Strategy:**

```typescript
interface GraphSyncConfig {
  // Sync mode
  mode: 'realtime' | 'batch' | 'scheduled';

  // For batch/scheduled
  batchSize: number;
  scheduleInterval: string;  // Cron expression

  // Consistency
  retryOnFailure: boolean;
  maxRetries: number;

  // Monitoring
  alertOnSyncLag: boolean;
  maxLagMinutes: number;
}

// Recommended: Batch sync as background job
const GRAPH_SYNC_DEFAULTS: GraphSyncConfig = {
  mode: 'batch',
  batchSize: 100,
  scheduleInterval: '*/5 * * * *',  // Every 5 minutes
  retryOnFailure: true,
  maxRetries: 3,
  alertOnSyncLag: true,
  maxLagMinutes: 15,
};
```

#### 3.3.3 PostgreSQL (Metadata & RLS)

**Purpose:** Store document metadata, permissions, and audit logs.

**New/Modified Tables:**

```sql
-- Extended documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS
  document_type VARCHAR(50),
  language VARCHAR(10),
  topics TEXT[],
  summary TEXT,
  key_phrases TEXT[],
  word_count INTEGER,
  table_count INTEGER,
  section_count INTEGER,
  parsed_structure JSONB,
  parser_used VARCHAR(50),
  parser_confidence DECIMAL(3,2),
  graph_synced BOOLEAN DEFAULT FALSE,
  graph_synced_at TIMESTAMP;

-- Chunk metadata (supplements Weaviate)
CREATE TABLE chunk_metadata (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_type VARCHAR(50) NOT NULL,
  chunking_method VARCHAR(50) NOT NULL,
  level INTEGER NOT NULL,
  parent_chunk_id UUID REFERENCES chunk_metadata(id),
  page_start INTEGER,
  page_end INTEGER,
  token_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_level CHECK (level BETWEEN 0 AND 2),
  CONSTRAINT valid_chunking_method CHECK (chunking_method IN ('semantic', 'late', 'fixed', 'table'))
);

-- Entity references (links to Neo4j)
CREATE TABLE entity_references (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_text TEXT NOT NULL,
  canonical_form TEXT,
  neo4j_node_id VARCHAR(100),
  confidence DECIMAL(3,2),
  occurrence_count INTEGER DEFAULT 1,
  resolution_method VARCHAR(50)
);

-- RAG query analytics (for evaluation)
CREATE TABLE rag_query_analytics (
  id UUID PRIMARY KEY,
  query_hash VARCHAR(64),
  query_length INTEGER,
  retrieval_strategy VARCHAR(50),
  candidate_count INTEGER,
  reranked_count INTEGER,
  latency_retrieval_ms INTEGER,
  latency_rerank_ms INTEGER,
  latency_generation_ms INTEGER,
  latency_total_ms INTEGER,
  sources_returned INTEGER,
  user_feedback INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Golden dataset for evaluation
CREATE TABLE golden_dataset (
  id UUID PRIMARY KEY,
  query TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  relevant_document_ids UUID[] NOT NULL,
  relevant_chunk_ids TEXT[],
  category VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  last_evaluated_at TIMESTAMP,
  last_precision_at_5 DECIMAL(3,2),
  last_recall_at_20 DECIMAL(3,2),

  CONSTRAINT valid_category CHECK (category IN ('factual', 'comparative', 'procedural', 'relational', 'aggregative', 'multi_hop'))
);
```

---

### 3.4 Retrieval Layer

#### 3.4.1 Query Router

**Purpose:** Analyze query intent and route to optimal retrieval strategy.

**Routing Logic:**

```typescript
interface QueryAnalysis {
  queryType: QueryType;
  entities: string[];
  isMultiHop: boolean;
  requiresGraphRefinement: boolean;
  requiresTable: boolean;
  suggestedStrategy: RetrievalStrategy;
  confidence: number;
}

type QueryType =
  | 'factual'
  | 'comparative'
  | 'procedural'
  | 'relational'
  | 'aggregative'
  | 'temporal';

type RetrievalStrategy =
  | 'vector_only'
  | 'hybrid'
  | 'hybrid_with_graph_refinement'
  | 'table_focused'
  | 'multi_index';

function routeQuery(query: string): QueryAnalysis {
  // 1. Extract entities using NER
  const entities = extractEntities(query);

  // 2. Classify query type
  const queryType = classifyQueryType(query);

  // 3. Detect multi-hop indicators
  const isMultiHop = detectMultiHopIndicators(query);

  // 4. Detect table need
  const requiresTable = detectTableIndicators(query);

  // 5. Select strategy
  let strategy: RetrievalStrategy = 'hybrid';

  if (isMultiHop || entities.length > 1) {
    strategy = 'hybrid_with_graph_refinement';
  } else if (requiresTable) {
    strategy = 'table_focused';
  } else if (queryType === 'aggregative') {
    strategy = 'multi_index';
  }

  return {
    queryType,
    entities,
    isMultiHop,
    requiresGraphRefinement: strategy === 'hybrid_with_graph_refinement',
    requiresTable,
    suggestedStrategy: strategy,
    confidence: calculateConfidence(...)
  };
}
```

#### 3.4.2 Hybrid Retriever (Enhanced)

**Changes from V1:**

1. Retrieve more candidates (50 instead of 5)
2. Support filtered search by metadata
3. Return candidates to reranker (not directly to LLM)

**Interface:**

```typescript
interface HybridSearchRequest {
  query: string;
  embedding?: number[];
  limit: number;         // Default: 50
  alpha: number;         // Default: 0.5

  // Filters
  documentIds?: string[];
  documentTypes?: string[];
  departments?: string[];
  dateRange?: [Date, Date];
  topics?: string[];

  // Options
  includeParentChunks: boolean;
  searchTables: boolean;
}

interface HybridSearchResult {
  chunks: ScoredChunk[];
  tables: ScoredTableChunk[];
  totalCandidates: number;
  searchTime: number;
}

interface ScoredChunk {
  id: string;
  documentId: string;
  content: string;
  score: number;
  vectorScore: number;
  bm25Score: number;
  level: number;
  parentId?: string;
  parentContent?: string;
  metadata: ChunkMetadata;
}
```

#### 3.4.3 Graph Refinement

**Purpose:** Enrich retrieval results with graph-based context for relational queries.

**Important:** This is POST-QUERY refinement, not primary retrieval.

**Flow:**

```typescript
async function graphRefinedSearch(
  query: string,
  hybridResults: HybridSearchResult,
  queryAnalysis: QueryAnalysis
): Promise<EnrichedSearchResult> {
  // 1. Only refine if needed
  if (!queryAnalysis.requiresGraphRefinement) {
    return { ...hybridResults, graphContext: null };
  }

  // 2. Extract entities from query and top results
  const queryEntities = queryAnalysis.entities;
  const resultEntities = extractEntitiesFromChunks(hybridResults.chunks.slice(0, 10));
  const allEntities = [...new Set([...queryEntities, ...resultEntities])];

  // 3. Traverse graph from these entities
  const graphContext = await neo4jService.traverse({
    entities: allEntities,
    strategy: 'neighborhood',
    maxDepth: 2,
    maxNodes: 20,
  });

  // 4. Fetch additional chunks mentioned in graph
  const graphChunkIds = graphContext.chunkIds.filter(
    id => !hybridResults.chunks.find(c => c.id === id)
  );

  if (graphChunkIds.length > 0) {
    const graphChunks = await weaviateService.getByIds(graphChunkIds);
    hybridResults.chunks.push(...graphChunks);
  }

  // 5. Return enriched results
  return {
    ...hybridResults,
    graphContext: {
      entities: graphContext.nodes,
      relationships: graphContext.edges,
      summary: graphContext.naturalLanguageSummary,
    },
  };
}
```

#### 3.4.4 Reranker

**Purpose:** Re-score candidates using cross-encoder for higher precision.

**Technology:** BGE Reranker v2 M3 (local, no API costs)

**Interface:**

```typescript
interface RerankerConfig {
  model: 'bge-reranker-v2-m3' | 'cohere' | 'colbert';
  topK: number;
  batchSize: number;
  scoreThreshold?: number;
}

interface RerankerRequest {
  query: string;
  candidates: ScoredChunk[];
  config: RerankerConfig;
}

interface RerankerResult {
  rerankedChunks: RerankedChunk[];
  processingTime: number;
}

interface RerankedChunk extends ScoredChunk {
  rerankerScore: number;
  finalScore: number;
  rank: number;
}
```

**Implementation:**

```typescript
class RerankerService {
  private model: CrossEncoder;

  async initialize() {
    this.model = await CrossEncoder.from_pretrained('BAAI/bge-reranker-v2-m3');
  }

  async rerank(request: RerankerRequest): Promise<RerankerResult> {
    const { query, candidates, config } = request;
    const startTime = Date.now();

    const pairs = candidates.map(c => [query, c.content]);

    const scores: number[] = [];
    for (let i = 0; i < pairs.length; i += config.batchSize) {
      const batch = pairs.slice(i, i + config.batchSize);
      const batchScores = await this.model.predict(batch);
      scores.push(...batchScores);
    }

    const reranked = candidates
      .map((chunk, idx) => ({
        ...chunk,
        rerankerScore: scores[idx],
        finalScore: this.combinedScore(chunk.score, scores[idx]),
      }))
      .filter(c => !config.scoreThreshold || c.finalScore >= config.scoreThreshold)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, config.topK)
      .map((chunk, idx) => ({ ...chunk, rank: idx + 1 }));

    return {
      rerankedChunks: reranked,
      processingTime: Date.now() - startTime,
    };
  }

  private combinedScore(hybridScore: number, rerankerScore: number): number {
    return 0.3 * hybridScore + 0.7 * this.normalizeRerankerScore(rerankerScore);
  }

  private normalizeRerankerScore(score: number): number {
    return 1 / (1 + Math.exp(-score));
  }
}
```

---

### 3.5 Generation Layer

#### 3.5.1 Context Compressor

**Purpose:** Optimize context window usage by compressing less relevant parts.

**Strategies:**

1. **Extractive Compression:** Keep only sentences with high relevance
2. **Abstractive Compression:** LLM-summarize long chunks
3. **Hierarchical Compression:** Full text for top-k, summaries for rest

**Implementation:**

```typescript
interface ContextCompressorConfig {
  maxTokens: number;
  strategy: 'extractive' | 'abstractive' | 'hierarchical';
  preserveTopK: number;
}

async function compressContext(
  chunks: RerankedChunk[],
  query: string,
  config: ContextCompressorConfig
): Promise<CompressedContext> {
  const { maxTokens, strategy, preserveTopK } = config;

  let currentTokens = 0;
  const compressedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTokens = countTokens(chunk.content);

    if (i < preserveTopK || currentTokens + chunkTokens <= maxTokens) {
      compressedChunks.push(formatChunk(chunk));
      currentTokens += chunkTokens;
    } else if (strategy === 'extractive') {
      const extracted = extractRelevantSentences(chunk.content, query, 3);
      compressedChunks.push(formatChunk({ ...chunk, content: extracted }));
      currentTokens += countTokens(extracted);
    } else if (strategy === 'abstractive') {
      const summary = await summarizeChunk(chunk.content, query);
      compressedChunks.push(formatChunk({ ...chunk, content: summary }));
      currentTokens += countTokens(summary);
    }

    if (currentTokens >= maxTokens) break;
  }

  return {
    context: compressedChunks.join('\n\n'),
    totalTokens: currentTokens,
    chunksIncluded: compressedChunks.length,
  };
}
```

#### 3.5.2 Citation Injector

**Purpose:** Ensure LLM responses include proper source citations.

**System Prompt Template:**

```typescript
const RAG_SYSTEM_PROMPT_V2 = `
Sie sind ein hilfreicher KI-Assistent, der Fragen basierend auf Unternehmensdokumenten beantwortet.

KONTEXT AUS DOKUMENTEN:
{context}

{graphContext}

ANWEISUNGEN:
1. Beantworten Sie die Frage NUR basierend auf den bereitgestellten Dokumenten.
2. Zitieren Sie IMMER Ihre Quellen im Format [Quelle: Dokumentname, Seite X].
3. Wenn die Information nicht in den Dokumenten steht, sagen Sie das explizit.
4. Bei widersprüchlichen Informationen nennen Sie beide Quellen.
5. Für Tabellendaten: Geben Sie die Daten strukturiert wieder.
6. Antworten Sie auf Deutsch in einem professionellen Ton.

BEISPIEL-ZITATION:
"Laut der DSGVO-Richtlinie müssen personenbezogene Daten innerhalb von 30 Tagen gelöscht werden [Quelle: DSGVO_Policy.pdf, Seite 5]."
`;
```

---

## 4. Evaluation Framework

### 4.1 Embedding Model Benchmark

**Purpose:** Select the best embedding model for your corpus before deployment.

**Candidates:**

| Model | Dimensions | Context | German Support | Local |
|-------|------------|---------|----------------|-------|
| nomic-embed-text | 768 | 8192 | Good | Yes |
| bge-m3 | 1024 | 8192 | Excellent | Yes |
| gte-Qwen2 | 1536 | 32768 | Excellent | Yes |
| jina-embeddings-v3 | 1024 | 8192 | Good | Yes |

**Benchmark Process:**

```typescript
interface EmbeddingBenchmark {
  modelName: string;

  // Retrieval quality
  precisionAt5: number;
  precisionAt10: number;
  recallAt20: number;
  mrr: number;

  // Performance
  embeddingLatencyMs: number;
  memoryUsageMb: number;

  // Corpus-specific
  germanQueryAccuracy: number;
  technicalTermAccuracy: number;
}

async function benchmarkEmbeddingModels(
  models: string[],
  goldenDataset: GoldenQuery[],
  corpus: Document[]
): Promise<EmbeddingBenchmark[]> {
  const results: EmbeddingBenchmark[] = [];

  for (const model of models) {
    // 1. Index corpus with this model
    const index = await createIndex(corpus, model);

    // 2. Run golden queries
    const metrics = await evaluateRetrieval(index, goldenDataset);

    // 3. Measure performance
    const perf = await measurePerformance(model);

    results.push({
      modelName: model,
      ...metrics,
      ...perf,
    });
  }

  return results;
}
```

### 4.2 Golden Dataset

**Purpose:** Curated query-answer pairs for measuring RAG quality.

**Structure:**

```typescript
interface GoldenDataset {
  version: string;
  createdAt: Date;
  queries: GoldenQuery[];
  statistics: DatasetStatistics;
}

interface GoldenQuery {
  id: string;
  query: string;
  expectedAnswer: string;
  relevantDocumentIds: string[];
  relevantChunkIds: string[];

  // Categorization
  category: 'factual' | 'comparative' | 'procedural' | 'relational' | 'aggregative' | 'multi_hop';
  difficulty: 'easy' | 'medium' | 'hard';

  // For evaluation
  keyFacts: string[];           // Must be present in answer
  forbiddenContent: string[];   // Must NOT be in answer (hallucination check)

  // Metadata
  createdBy: string;
  verifiedBy?: string;
  lastUpdated: Date;
}

interface DatasetStatistics {
  totalQueries: number;
  byCategory: Record<string, number>;
  byDifficulty: Record<string, number>;
  avgRelevantDocs: number;
  avgRelevantChunks: number;
}
```

**Minimum Requirements:**

| Category | Minimum Queries | Notes |
|----------|-----------------|-------|
| factual | 20 | Simple fact lookup |
| comparative | 10 | Compare two entities |
| procedural | 15 | How-to questions |
| relational | 15 | Who/what relates to X |
| aggregative | 10 | List/count questions |
| multi_hop | 15 | Requires multiple docs |
| **Total** | **85** | Minimum for valid benchmark |

### 4.3 Retrieval Metrics

**Metrics to Track:**

```typescript
interface RetrievalMetrics {
  // Precision & Recall
  precisionAtK: Record<number, number>;  // K = 1, 3, 5, 10, 20
  recallAtK: Record<number, number>;

  // Ranking quality
  mrr: number;                    // Mean Reciprocal Rank
  ndcg: number;                   // Normalized Discounted Cumulative Gain
  map: number;                    // Mean Average Precision

  // By category
  byCategory: Record<string, {
    precisionAt5: number;
    recallAt20: number;
    mrr: number;
  }>;

  // By difficulty
  byDifficulty: Record<string, {
    precisionAt5: number;
    recallAt20: number;
  }>;
}

function calculateRetrievalMetrics(
  results: SearchResult[],
  goldenQuery: GoldenQuery
): RetrievalMetrics {
  const relevantIds = new Set(goldenQuery.relevantChunkIds);

  // Precision@K
  const precisionAtK: Record<number, number> = {};
  for (const k of [1, 3, 5, 10, 20]) {
    const topK = results.slice(0, k);
    const relevant = topK.filter(r => relevantIds.has(r.chunkId)).length;
    precisionAtK[k] = relevant / k;
  }

  // Recall@K
  const recallAtK: Record<number, number> = {};
  for (const k of [1, 3, 5, 10, 20]) {
    const topK = results.slice(0, k);
    const relevant = topK.filter(r => relevantIds.has(r.chunkId)).length;
    recallAtK[k] = relevant / relevantIds.size;
  }

  // MRR
  const firstRelevantRank = results.findIndex(r => relevantIds.has(r.chunkId)) + 1;
  const mrr = firstRelevantRank > 0 ? 1 / firstRelevantRank : 0;

  return { precisionAtK, recallAtK, mrr, ndcg: 0, map: 0, byCategory: {}, byDifficulty: {} };
}
```

### 4.4 Generation Metrics

**Metrics to Track:**

```typescript
interface GenerationMetrics {
  // Groundedness (faithfulness to context)
  groundedness: number;           // 0-1, claims supported by context

  // Answer relevance
  answerRelevance: number;        // 0-1, addresses the question

  // Completeness
  keyFactsCovered: number;        // % of expected key facts present

  // Hallucination
  hallucinationScore: number;     // 0-1, 0 = no hallucination
  forbiddenContentFound: boolean;

  // Citation quality
  citationAccuracy: number;       // % of citations that match sources
  citationCompleteness: number;   // % of claims with citations
}

async function evaluateGeneration(
  response: string,
  goldenQuery: GoldenQuery,
  usedContext: string[]
): Promise<GenerationMetrics> {
  // 1. Check groundedness via LLM
  const groundedness = await llmEvaluateGroundedness(response, usedContext);

  // 2. Check answer relevance via LLM
  const answerRelevance = await llmEvaluateRelevance(response, goldenQuery.query);

  // 3. Check key facts
  const keyFactsCovered = goldenQuery.keyFacts.filter(
    fact => response.toLowerCase().includes(fact.toLowerCase())
  ).length / goldenQuery.keyFacts.length;

  // 4. Check forbidden content (hallucination)
  const forbiddenContentFound = goldenQuery.forbiddenContent.some(
    content => response.toLowerCase().includes(content.toLowerCase())
  );

  // 5. Evaluate citations
  const citationMetrics = evaluateCitations(response, usedContext);

  return {
    groundedness,
    answerRelevance,
    keyFactsCovered,
    hallucinationScore: forbiddenContentFound ? 1 : (1 - groundedness),
    forbiddenContentFound,
    ...citationMetrics,
  };
}
```

### 4.5 Evaluation Pipeline

**Automated Evaluation:**

```typescript
interface EvaluationRun {
  id: string;
  timestamp: Date;
  version: string;  // RAG version being evaluated

  // Configuration
  config: {
    embeddingModel: string;
    rerankerEnabled: boolean;
    graphEnabled: boolean;
    chunkingStrategy: string;
  };

  // Results
  retrievalMetrics: RetrievalMetrics;
  generationMetrics: GenerationMetrics;
  latencyMetrics: LatencyMetrics;

  // Comparison
  comparisonToBaseline?: {
    retrievalImprovement: number;
    generationImprovement: number;
    latencyChange: number;
  };
}

async function runEvaluation(
  config: RAGConfig,
  goldenDataset: GoldenDataset
): Promise<EvaluationRun> {
  const results: QueryEvaluation[] = [];

  for (const query of goldenDataset.queries) {
    // 1. Run RAG pipeline
    const startTime = Date.now();
    const response = await ragService.query(query.query, config);
    const latency = Date.now() - startTime;

    // 2. Evaluate retrieval
    const retrievalMetrics = calculateRetrievalMetrics(
      response.searchResults,
      query
    );

    // 3. Evaluate generation
    const generationMetrics = await evaluateGeneration(
      response.answer,
      query,
      response.usedContext
    );

    results.push({
      queryId: query.id,
      retrievalMetrics,
      generationMetrics,
      latency,
    });
  }

  // 4. Aggregate results
  return aggregateEvaluationResults(results, config);
}
```

---

## 5. Observability & Monitoring

### 5.1 RAG Tracing

**Purpose:** End-to-end visibility into RAG pipeline execution.

**Technology Options:**
- [Langfuse](https://langfuse.com/) (Open Source, self-hosted)
- [Phoenix](https://github.com/Arize-ai/phoenix) (Open Source)
- Custom implementation

**Trace Structure:**

```typescript
interface RAGTrace {
  traceId: string;
  timestamp: Date;
  userId: string;     // Hashed, no PII
  sessionId: string;

  // Query info (no PII)
  queryLength: number;
  queryType: string;

  // Spans
  spans: RAGSpan[];

  // Outcome
  success: boolean;
  errorType?: string;

  // Metrics
  totalLatencyMs: number;
  tokensUsed: number;
}

interface RAGSpan {
  spanId: string;
  parentSpanId?: string;
  name: SpanName;
  startTime: number;
  endTime: number;

  // Span-specific data (no content, just metrics)
  metadata: SpanMetadata;

  // Status
  status: 'ok' | 'error';
  errorMessage?: string;
}

type SpanName =
  | 'query_analysis'
  | 'embedding_generation'
  | 'vector_search'
  | 'graph_traversal'
  | 'reranking'
  | 'context_compression'
  | 'llm_generation'
  | 'citation_extraction';

interface SpanMetadata {
  // Query analysis
  queryType?: string;
  entitiesFound?: number;

  // Embedding
  embeddingModel?: string;
  embeddingDimensions?: number;

  // Search
  candidatesRetrieved?: number;
  searchStrategy?: string;
  hybridAlpha?: number;

  // Reranking
  candidatesReranked?: number;
  topKReturned?: number;

  // Generation
  tokensInput?: number;
  tokensOutput?: number;
  model?: string;

  // No content/PII fields!
}
```

**Implementation:**

```typescript
class TracingService {
  private traces: Map<string, RAGTrace> = new Map();

  startTrace(userId: string, sessionId: string): string {
    const traceId = generateTraceId();
    this.traces.set(traceId, {
      traceId,
      timestamp: new Date(),
      userId: hashUserId(userId),
      sessionId,
      queryLength: 0,
      queryType: '',
      spans: [],
      success: false,
      totalLatencyMs: 0,
      tokensUsed: 0,
    });
    return traceId;
  }

  startSpan(traceId: string, name: SpanName, parentSpanId?: string): string {
    const spanId = generateSpanId();
    const trace = this.traces.get(traceId);
    if (!trace) throw new Error('Trace not found');

    trace.spans.push({
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      endTime: 0,
      metadata: {},
      status: 'ok',
    });

    return spanId;
  }

  endSpan(traceId: string, spanId: string, metadata: SpanMetadata, error?: Error): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.metadata = metadata;
    if (error) {
      span.status = 'error';
      span.errorMessage = error.message;
    }
  }

  endTrace(traceId: string, success: boolean): RAGTrace {
    const trace = this.traces.get(traceId);
    if (!trace) throw new Error('Trace not found');

    trace.success = success;
    trace.totalLatencyMs = trace.spans.reduce(
      (sum, s) => sum + (s.endTime - s.startTime), 0
    );

    // Persist to database
    this.persistTrace(trace);

    // Export to Langfuse/Phoenix if configured
    if (this.exporter) {
      this.exporter.export(trace);
    }

    this.traces.delete(traceId);
    return trace;
  }
}
```

### 5.2 Monitoring Dashboard

**Key Metrics to Display:**

```typescript
interface RAGDashboardMetrics {
  // Real-time
  currentQPS: number;           // Queries per second
  avgLatencyLast5Min: number;
  errorRateLast5Min: number;

  // Daily aggregates
  totalQueries: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;

  // Quality (from evaluation)
  avgPrecisionAt5: number;
  avgGroundedness: number;
  hallucinationRate: number;

  // By component
  componentLatencies: {
    queryAnalysis: number;
    vectorSearch: number;
    graphTraversal: number;
    reranking: number;
    generation: number;
  };

  // Trends
  latencyTrend: TimeSeriesData[];
  qualityTrend: TimeSeriesData[];
  errorTrend: TimeSeriesData[];
}
```

**Alerting Rules:**

```typescript
interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  window: string;
  severity: 'info' | 'warning' | 'critical';
  actions: AlertAction[];
}

const RAG_ALERT_RULES: AlertRule[] = [
  {
    name: 'high_latency',
    condition: 'p95_latency > threshold',
    threshold: 2000,  // ms
    window: '5m',
    severity: 'warning',
    actions: ['slack', 'email'],
  },
  {
    name: 'high_error_rate',
    condition: 'error_rate > threshold',
    threshold: 0.05,  // 5%
    window: '5m',
    severity: 'critical',
    actions: ['slack', 'email', 'pagerduty'],
  },
  {
    name: 'low_groundedness',
    condition: 'avg_groundedness < threshold',
    threshold: 0.8,
    window: '1h',
    severity: 'warning',
    actions: ['slack'],
  },
  {
    name: 'graph_sync_lag',
    condition: 'graph_sync_lag > threshold',
    threshold: 15,  // minutes
    window: '1m',
    severity: 'warning',
    actions: ['slack'],
  },
];
```

---

## 6. Guardrails

### 6.1 Input Guardrails

**Purpose:** Validate and sanitize user queries before processing.

```typescript
interface InputGuardrailsConfig {
  // Length limits
  maxQueryLength: number;        // Default: 2000 chars
  minQueryLength: number;        // Default: 3 chars

  // Language
  allowedLanguages: string[];    // Default: ['de', 'en']

  // Security
  promptInjectionDetection: boolean;
  blockedPatterns: RegExp[];

  // Rate limiting (per user)
  maxQueriesPerMinute: number;
  maxQueriesPerHour: number;
}

const INPUT_GUARDRAILS_DEFAULTS: InputGuardrailsConfig = {
  maxQueryLength: 2000,
  minQueryLength: 3,
  allowedLanguages: ['de', 'en'],
  promptInjectionDetection: true,
  blockedPatterns: [
    /ignore.*instructions/i,
    /forget.*everything/i,
    /system.*prompt/i,
    /you.*are.*now/i,
    /<script>/i,
    /\{\{.*\}\}/,  // Template injection
  ],
  maxQueriesPerMinute: 10,
  maxQueriesPerHour: 100,
};

async function validateInput(
  query: string,
  userId: string,
  config: InputGuardrailsConfig
): Promise<InputValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Length check
  if (query.length > config.maxQueryLength) {
    errors.push(`Query exceeds maximum length of ${config.maxQueryLength} characters`);
  }
  if (query.length < config.minQueryLength) {
    errors.push(`Query is too short (minimum ${config.minQueryLength} characters)`);
  }

  // 2. Language detection
  const detectedLanguage = detectLanguage(query);
  if (!config.allowedLanguages.includes(detectedLanguage)) {
    warnings.push(`Detected language '${detectedLanguage}' may affect response quality`);
  }

  // 3. Prompt injection detection
  if (config.promptInjectionDetection) {
    for (const pattern of config.blockedPatterns) {
      if (pattern.test(query)) {
        errors.push('Query contains potentially harmful patterns');
        break;
      }
    }

    // LLM-based detection for sophisticated attacks
    const injectionScore = await detectPromptInjection(query);
    if (injectionScore > 0.8) {
      errors.push('Query detected as potential prompt injection');
    } else if (injectionScore > 0.5) {
      warnings.push('Query may contain prompt injection attempts');
    }
  }

  // 4. Rate limiting
  const rateLimit = await checkRateLimit(userId, config);
  if (!rateLimit.allowed) {
    errors.push(`Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedQuery: sanitizeQuery(query),
  };
}
```

### 6.2 Output Guardrails

**Purpose:** Validate and filter LLM responses before sending to user.

```typescript
interface OutputGuardrailsConfig {
  // Length limits
  maxResponseLength: number;     // Default: 4000 tokens

  // Citation requirements
  requireCitations: boolean;     // Default: true
  minCitationCount: number;      // Default: 1

  // Quality thresholds
  groundednessThreshold: number; // Default: 0.7

  // Content filtering
  blockedContentPatterns: RegExp[];
  piiDetection: boolean;

  // Hallucination handling
  rejectOnLowGroundedness: boolean;
  addDisclaimerOnLowGroundedness: boolean;
}

const OUTPUT_GUARDRAILS_DEFAULTS: OutputGuardrailsConfig = {
  maxResponseLength: 4000,
  requireCitations: true,
  minCitationCount: 1,
  groundednessThreshold: 0.7,
  blockedContentPatterns: [
    /password.*is/i,
    /api.*key.*:/i,
    /secret.*:/i,
  ],
  piiDetection: true,
  rejectOnLowGroundedness: false,
  addDisclaimerOnLowGroundedness: true,
};

async function validateOutput(
  response: string,
  context: string[],
  config: OutputGuardrailsConfig
): Promise<OutputValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let finalResponse = response;

  // 1. Length check
  const tokenCount = countTokens(response);
  if (tokenCount > config.maxResponseLength) {
    finalResponse = truncateToTokens(response, config.maxResponseLength);
    warnings.push('Response was truncated due to length');
  }

  // 2. Citation check
  if (config.requireCitations) {
    const citations = extractCitations(response);
    if (citations.length < config.minCitationCount) {
      warnings.push('Response has fewer citations than recommended');
    }
  }

  // 3. Groundedness check
  const groundedness = await evaluateGroundedness(response, context);
  if (groundedness < config.groundednessThreshold) {
    if (config.rejectOnLowGroundedness) {
      errors.push('Response could not be adequately grounded in sources');
    } else if (config.addDisclaimerOnLowGroundedness) {
      finalResponse = addDisclaimer(finalResponse,
        'Hinweis: Diese Antwort konnte nicht vollständig durch die verfügbaren Dokumente belegt werden.'
      );
    }
  }

  // 4. Blocked content check
  for (const pattern of config.blockedContentPatterns) {
    if (pattern.test(response)) {
      finalResponse = redactPattern(finalResponse, pattern);
      warnings.push('Potentially sensitive content was redacted');
    }
  }

  // 5. PII detection
  if (config.piiDetection) {
    const piiMatches = detectPII(response);
    if (piiMatches.length > 0) {
      finalResponse = redactPII(finalResponse, piiMatches);
      warnings.push('Personal information was redacted from response');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    originalResponse: response,
    finalResponse,
    groundednessScore: groundedness,
  };
}
```

### 6.3 Guardrails Integration

```typescript
async function ragQueryWithGuardrails(
  query: string,
  userId: string,
  config: RAGConfig
): Promise<RAGResponse> {
  // 1. Input guardrails
  const inputValidation = await validateInput(query, userId, config.inputGuardrails);
  if (!inputValidation.valid) {
    return {
      success: false,
      error: inputValidation.errors.join('; '),
      warnings: inputValidation.warnings,
    };
  }

  // 2. RAG pipeline
  const ragResult = await ragService.query(
    inputValidation.sanitizedQuery,
    userId,
    config
  );

  // 3. Output guardrails
  const outputValidation = await validateOutput(
    ragResult.answer,
    ragResult.usedContext,
    config.outputGuardrails
  );

  if (!outputValidation.valid) {
    return {
      success: false,
      error: outputValidation.errors.join('; '),
      warnings: [...inputValidation.warnings, ...outputValidation.warnings],
    };
  }

  return {
    success: true,
    answer: outputValidation.finalResponse,
    sources: ragResult.sources,
    warnings: [...inputValidation.warnings, ...outputValidation.warnings],
    metrics: {
      groundedness: outputValidation.groundednessScore,
      latency: ragResult.latency,
    },
  };
}
```

---

## 7. API Specification

### 7.1 Document Endpoints (V2)

```typescript
// Upload with multi-format support
POST /api/v2/documents/upload
Content-Type: multipart/form-data
Request:
  file: Binary
  classification: string
  visibility: string
  parseOptions?: HybridParserConfig
Response:
  documentId: string
  jobId: string
  status: 'queued'

// Get parsing status
GET /api/v2/documents/:id/status
Response:
  status: 'parsing' | 'chunking' | 'indexing' | 'graphing' | 'completed' | 'failed'
  progress: number
  currentStep: string
  parserUsed?: string
  warnings?: string[]
  error?: string

// Get document structure
GET /api/v2/documents/:id/structure
Response:
  structure: DocumentStructure
  chunks: ChunkSummary[]
  entities: EntitySummary[]
  parserMetadata: ParserMetadata

// Get document graph
GET /api/v2/documents/:id/graph
Response:
  nodes: GraphNode[]
  edges: GraphEdge[]
```

### 7.2 Search Endpoints (V2)

```typescript
// Advanced search with routing
POST /api/v2/rag/search
Request:
  query: string
  strategy?: RetrievalStrategy
  hybridAlpha?: number
  limit?: number
  filters?: SearchFilters
  includeGraphRefinement?: boolean
  rerank?: boolean
Response:
  results: SearchResult[]
  queryAnalysis: QueryAnalysis
  graphContext?: GraphContext
  searchTime: number
  strategy: RetrievalStrategy

// Chat with V2 RAG
POST /api/v2/rag/chat
Request:
  messages: ChatMessage[]
  model: string
  stream: boolean
  ragOptions:
    enabled: boolean
    strategy?: RetrievalStrategy
    searchLimit?: number
    rerank?: boolean
    includeGraphRefinement?: boolean
    contextCompression?: ContextCompressorConfig
Response (streaming):
  type: 'analysis' | 'sources' | 'graph' | 'message' | 'citations' | 'done'
  data: varies by type
```

### 7.3 Evaluation Endpoints

```typescript
// Run evaluation
POST /api/v2/evaluation/run
Request:
  datasetId?: string  // Use specific dataset, or default
  config?: RAGConfig  // Test specific configuration
Response:
  runId: string
  status: 'started'

// Get evaluation results
GET /api/v2/evaluation/runs/:runId
Response:
  status: 'running' | 'completed' | 'failed'
  progress?: number
  results?: EvaluationRun

// Get evaluation history
GET /api/v2/evaluation/history
Response:
  runs: EvaluationRunSummary[]

// Manage golden dataset
GET /api/v2/evaluation/golden-dataset
POST /api/v2/evaluation/golden-dataset
PUT /api/v2/evaluation/golden-dataset/:queryId
DELETE /api/v2/evaluation/golden-dataset/:queryId
```

---

## 8. Implementation Phases

### Phase 0: Evaluation Baseline (Week 0-1) - NEW

**Goal:** Establish metrics baseline before any changes

| Task | Priority | Effort |
|------|----------|--------|
| Create Golden Dataset (85+ queries) | High | 3 days |
| Implement evaluation service | High | 2 days |
| Benchmark current V1 system | High | 1 day |
| Benchmark embedding models | High | 2 days |
| Document baseline metrics | High | 1 day |

**Deliverables:**
- Golden dataset with 85+ categorized queries
- EvaluationService with Precision@K, Recall@K, Groundedness
- Baseline report: V1 metrics
- Embedding model recommendation

**Success Criteria:**
- Golden dataset covers all 6 categories
- Baseline metrics documented
- Embedding model selected with data

### Phase 1: Reranking (Weeks 1-2)

**Goal:** Add reranking and increase candidate retrieval

| Task | Priority | Effort |
|------|----------|--------|
| Implement RerankerService (BGE) | High | 3 days |
| Increase candidate retrieval to 50 | High | 1 day |
| Add reranking to RAG pipeline | High | 2 days |
| Update API for reranking options | Medium | 1 day |
| Evaluate: Compare V1 vs V1+Reranking | High | 1 day |

**Deliverables:**
- RerankerService with BGE model
- Updated RAGService with reranking step
- Evaluation report: V1 vs V1+Reranking

**Success Criteria:**
- Precision@5 improvement ≥15%
- Latency increase <200ms

### Phase 2: Multi-Format + Hybrid Parser (Weeks 3-5)

**Goal:** Support DOCX, PPTX, XLSX, HTML, Markdown with hybrid parsing

| Task | Priority | Effort |
|------|----------|--------|
| Integrate Docling parser | High | 3 days |
| Integrate LlamaParse (fallback) | High | 2 days |
| Implement parser routing logic | High | 2 days |
| Implement format-specific handlers | High | 3 days |
| Update DocumentService | High | 2 days |
| Implement table-aware chunking | High | 3 days |
| Update upload UI for new formats | Medium | 2 days |
| Migration script for existing PDFs | Medium | 2 days |

**Deliverables:**
- HybridParserService with Docling + LlamaParse
- TableChunker for structured table handling
- Updated DocumentUpload component
- Migration documentation

**Success Criteria:**
- 6 formats supported
- Table extraction accuracy ≥95%
- Parser fallback working

### Phase 3: Semantic Chunking + Late Chunking (Weeks 6-7)

**Goal:** Replace fixed chunking with semantic boundaries

| Task | Priority | Effort |
|------|----------|--------|
| Implement SemanticChunker | High | 3 days |
| Implement LateChunker | High | 2 days |
| Implement HierarchicalIndexer | High | 4 days |
| Update Weaviate schema (V2) | High | 2 days |
| Parent-child retrieval logic | High | 2 days |
| Chunking strategy selector | Medium | 2 days |
| Evaluate: V1+Rerank vs V2 Chunking | High | 1 day |

**Deliverables:**
- SemanticChunker service
- LateChunker service
- HierarchicalIndexer service
- Updated VectorService for V2 schema
- Evaluation report: Chunking comparison

**Success Criteria:**
- Recall@20 improvement ≥10%
- Semantic coherence improved

### Phase 4: Knowledge Graph + Entity Resolution (Weeks 8-11)

**Goal:** Entity extraction and graph-based refinement

| Task | Priority | Effort |
|------|----------|--------|
| Set up Neo4j infrastructure | High | 2 days |
| Implement EntityExtractor (spaCy + LLM) | High | 4 days |
| Implement EntityResolver (deduplication) | High | 3 days |
| Implement GraphService | High | 4 days |
| Implement GraphRefinement (post-query) | High | 3 days |
| Integrate graph into RAG pipeline | High | 2 days |
| Implement graph sync service | High | 2 days |
| Graph visualization UI | Medium | 3 days |
| Evaluate: Multi-hop query accuracy | High | 2 days |

**Deliverables:**
- Neo4j deployment (Docker)
- EntityExtractor with LLM-assisted resolution
- GraphService with sync
- GraphRefinement for retrieval
- Graph explorer UI component
- Evaluation report: Multi-hop queries

**Success Criteria:**
- Multi-hop accuracy ≥80%
- Entity resolution precision ≥90%
- Graph sync lag <15 minutes

### Phase 5: Query Intelligence + Observability (Weeks 12-13)

**Goal:** Automatic query routing, tracing, and guardrails

| Task | Priority | Effort |
|------|----------|--------|
| Implement QueryRouter | High | 3 days |
| Query type classification | High | 2 days |
| Multi-hop detection | High | 2 days |
| Implement TracingService | High | 3 days |
| Integrate Langfuse/Phoenix | Medium | 2 days |
| Implement InputGuardrails | High | 2 days |
| Implement OutputGuardrails | High | 2 days |
| Monitoring dashboard | Medium | 2 days |

**Deliverables:**
- QueryRouter service
- TracingService with export
- Guardrails (input + output)
- Monitoring dashboard
- Alerting rules

**Success Criteria:**
- Query routing accuracy ≥85%
- All queries traced
- <5% false positive guardrail triggers

### Phase 6: Production Hardening (Weeks 14-15)

**Goal:** Performance, reliability, documentation

| Task | Priority | Effort |
|------|----------|--------|
| Load testing and optimization | High | 3 days |
| Caching layer (Redis) | High | 2 days |
| Error handling improvements | High | 2 days |
| Final evaluation run | High | 1 day |
| Documentation | High | 3 days |
| User training materials | Medium | 2 days |

**Deliverables:**
- Performance report
- Redis caching for embeddings/results
- Complete API documentation
- User guide
- Final evaluation report: V1 vs V2

**Success Criteria:**
- p95 latency <800ms
- Error rate <1%
- All target metrics achieved

---

## 9. Infrastructure Requirements

### 9.1 New Services

| Service | Purpose | Resources |
|---------|---------|-----------|
| Neo4j | Knowledge Graph | 4GB RAM, 20GB SSD |
| Redis | Caching | 2GB RAM (existing, expand) |
| Docling Worker | Document parsing | 4GB RAM, GPU optional |
| Langfuse | Observability | 2GB RAM, 10GB SSD (optional) |

### 9.2 Updated Docker Compose

```yaml
# docker-compose.rag-v2.yml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.15-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    deploy:
      resources:
        limits:
          memory: 4G

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          memory: 2G

  docling-worker:
    build:
      context: ./server
      dockerfile: Dockerfile.docling
    environment:
      OLLAMA_URL: http://ollama:11434
      LLAMAPARSE_API_KEY: ${LLAMAPARSE_API_KEY}
    volumes:
      - ./uploads:/app/uploads
    deploy:
      resources:
        limits:
          memory: 4G

  langfuse:
    image: langfuse/langfuse:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgresql:5432/langfuse
      NEXTAUTH_SECRET: ${LANGFUSE_SECRET}
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - postgresql

volumes:
  neo4j_data:
  neo4j_logs:
  redis_data:
```

### 9.3 Environment Variables

```env
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-secure-password

# Redis (existing, expanded config)
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=3600

# Docling
DOCLING_OCR_ENABLED=true
DOCLING_OCR_LANGUAGES=de,en
DOCLING_TABLE_MODE=accurate

# LlamaParse (fallback)
LLAMAPARSE_API_KEY=your-api-key
LLAMAPARSE_ENABLED=true

# Reranker
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
RERANKER_TOP_K=5
RERANKER_BATCH_SIZE=10

# RAG V2
RAG_DEFAULT_STRATEGY=hybrid
RAG_CANDIDATE_LIMIT=50
RAG_ENABLE_GRAPH_REFINEMENT=true
RAG_ENABLE_RERANKING=true
RAG_CONTEXT_MAX_TOKENS=4000

# Embedding (selected from benchmark)
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768

# Guardrails
GUARDRAILS_INPUT_MAX_LENGTH=2000
GUARDRAILS_OUTPUT_GROUNDEDNESS_THRESHOLD=0.7
GUARDRAILS_PROMPT_INJECTION_DETECTION=true

# Observability
LANGFUSE_PUBLIC_KEY=your-public-key
LANGFUSE_SECRET_KEY=your-secret-key
LANGFUSE_HOST=http://localhost:3000
TRACING_ENABLED=true

# Evaluation
EVALUATION_GOLDEN_DATASET_ID=default
EVALUATION_AUTO_RUN=false
```

---

## 10. Migration Strategy

### 10.1 Data Migration

1. **Documents:** Re-parse existing PDFs with Docling (background job)
2. **Chunks:** Re-chunk with semantic chunker, migrate to V2 schema
3. **Entities:** Extract entities from existing documents, populate Neo4j
4. **Permissions:** Maintain existing RLS, extend to graph

### 10.2 API Compatibility

- V1 endpoints remain functional during transition
- V2 endpoints available in parallel
- Gradual migration with feature flags
- Full V1 deprecation after 3 months

### 10.3 Rollback Plan

- Weaviate V1 collection preserved
- PostgreSQL schema backward compatible
- Feature flags for instant rollback
- Automated health checks with auto-rollback

---

## 11. Success Metrics

| Metric | Current (V1) | Phase 1 | Phase 3 | Final (V2) |
|--------|--------------|---------|---------|------------|
| Precision@5 | ~60% | 75% | 80% | **85%+** |
| Recall@20 | ~70% | 75% | 85% | **90%+** |
| Multi-hop Accuracy | ~40% | 45% | 60% | **85%+** |
| Groundedness | Unknown | 80% | 90% | **95%+** |
| Query Latency (p50) | 300ms | 350ms | 400ms | **500ms** |
| Query Latency (p95) | 500ms | 550ms | 650ms | **800ms** |
| Format Support | 1 | 1 | 6 | **6+** |
| Error Rate | Unknown | <3% | <2% | **<1%** |

---

## 12. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Neo4j complexity | High | Medium | Start simple, graph as refinement only |
| Docling parsing errors | Medium | Medium | Hybrid parser with LlamaParse fallback |
| Reranker latency | Medium | Low | Batch processing, caching |
| Entity resolution errors | Medium | Medium | LLM-assisted resolution, confidence thresholds |
| Graph sync lag | Medium | Medium | Background sync, eventual consistency |
| Breaking changes | High | Low | Feature flags, gradual rollout |
| Evaluation false positives | Medium | Medium | Human review of golden dataset |
| Guardrail false positives | Medium | Medium | Tunable thresholds, bypass for admins |

---

## 13. References

### Best Practices & Guides
- [Neo4j Advanced RAG](https://neo4j.com/blog/genai/advanced-rag-techniques/)
- [Production RAG Guide](https://medium.com/@kranthigoud975/building-production-grade-rag-systems-a-learning-series-f1878e012832)
- [RAGFlow 2025 Review](https://ragflow.io/blog/rag-review-2025-from-rag-to-context)
- [RAG Evaluation Guide - Evidently](https://www.evidentlyai.com/llm-guide/rag-evaluation)
- [RAG Evaluation Guide - Qdrant](https://qdrant.tech/blog/rag-evaluation-guide/)
- [NVIDIA Chunking Strategies](https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/)
- [Orkes RAG Best Practices](https://orkes.io/blog/rag-best-practices/)

### Tools & Libraries
- [Docling GitHub](https://github.com/DS4SD/docling)
- [LlamaParse](https://cloud.llamaindex.ai/)
- [BGE Reranker](https://huggingface.co/BAAI/bge-reranker-v2-m3)
- [GraphRAG Qdrant+Neo4j](https://qdrant.tech/documentation/examples/graphrag-qdrant-neo4j/)
- [Langfuse](https://langfuse.com/)
- [Phoenix](https://github.com/Arize-ai/phoenix)

### Benchmarks
- [PDF Parser Benchmark 2025](https://procycons.com/en/blogs/pdf-data-extraction-benchmark/)
- [Table Extraction Showdown](https://boringbot.substack.com/p/pdf-table-extraction-showdown-docling)

---

## Appendix A: File Structure

```
server/src/
├── services/
│   ├── rag/
│   │   ├── RAGServiceV2.ts
│   │   ├── QueryRouter.ts
│   │   ├── RerankerService.ts
│   │   └── ContextCompressor.ts
│   ├── parsing/
│   │   ├── HybridParserService.ts
│   │   ├── DoclingParser.ts
│   │   ├── LlamaParseParser.ts
│   │   ├── EntityExtractor.ts
│   │   ├── EntityResolver.ts
│   │   └── MetadataEnricher.ts
│   ├── chunking/
│   │   ├── SemanticChunker.ts
│   │   ├── LateChunker.ts
│   │   ├── TableChunker.ts
│   │   └── HierarchicalIndexer.ts
│   ├── graph/
│   │   ├── GraphService.ts
│   │   ├── GraphRefinement.ts
│   │   ├── GraphSyncService.ts
│   │   └── EntityResolver.ts
│   ├── evaluation/
│   │   ├── EvaluationService.ts
│   │   ├── GoldenDatasetService.ts
│   │   ├── MetricsCalculator.ts
│   │   └── EmbeddingBenchmark.ts
│   ├── observability/
│   │   ├── TracingService.ts
│   │   ├── LangfuseExporter.ts
│   │   └── MonitoringService.ts
│   ├── guardrails/
│   │   ├── InputGuardrails.ts
│   │   ├── OutputGuardrails.ts
│   │   └── PromptInjectionDetector.ts
│   └── storage/
│       ├── VectorServiceV2.ts
│       ├── Neo4jService.ts
│       └── RedisCache.ts
├── routes/
│   ├── ragV2.ts
│   └── evaluation.ts
└── types/
    ├── ragV2.ts
    ├── evaluation.ts
    └── guardrails.ts
```

---

## Appendix B: Evaluation Query Categories

| Category | Description | Example Query |
|----------|-------------|---------------|
| **factual** | Simple fact lookup | "Was ist die maximale Dateigröße für Uploads?" |
| **comparative** | Compare entities | "Vergleiche die Urlaubsregelungen für Vollzeit- und Teilzeitkräfte" |
| **procedural** | How-to questions | "Wie beantrage ich Homeoffice?" |
| **relational** | Entity relationships | "Wer ist der Abteilungsleiter von Marketing?" |
| **aggregative** | List/count questions | "Liste alle aktiven Projekte im Q1 2026" |
| **multi_hop** | Requires multiple docs | "Welche Compliance-Anforderungen gelten für das Projekt, das Max Mustermann leitet?" |

---

**Document Status:** Validated
**Last Updated:** 2026-01-29
**Next Review:** After Phase 0 completion
