# Tech Stack Versions & Best Practices 2026

**Last Updated:** 2026-01-20
**Purpose:** Current versions and breaking changes for Vexora Hybrid RAG implementation

---

## 🚨 CRITICAL CORRECTIONS TO SPEC

### ❌ **jina-reranker-v2-base-multilingual NOT AVAILABLE in Ollama**
The spec mentions jina-reranker, but this model is **NOT available in Ollama**. Jina reranker only available via Jina API.

### ✅ **Use Qwen3-Reranker instead**
- **Model:** Qwen3-Reranker (Alibaba)
- **Sizes:** 0.6B, 4B, 8B parameters
- **Languages:** 100+ languages
- **Ollama:** Available via community models

**Installation:**
```bash
ollama pull dengcao/Qwen3-Reranker-4B:Q5_K_M
```

---

## Vector Database: Weaviate

### Current Version
- **Latest:** v1.34.8 (Released: January 12, 2026)
- **Docker Image:** `semitechnologies/weaviate:1.34.8`
- **Minimum Required:** v1.27+ for Client v4 compatibility

### Breaking Changes in 1.34
1. **Default Filter Strategy Changed:**
   - Old: `SWEEPING`
   - New: `ACORN`
   - Impact: New collections will use ACORN by default
   - Action: Explicitly set filter strategy if you need SWEEPING

2. **Client v4 NOT Backward Compatible:**
   - weaviate-client v4 requires Weaviate server 1.27.0+
   - Cannot use with older server versions
   - Action: Use matching client/server versions

3. **RAFT Snapshot Storage Change:**
   - Affects: Multi-node instances (1.28.13+, 1.29.5+, 1.30.2+)
   - Issue: Cannot downgrade to v1.27.x < 1.27.26
   - Action: Plan upgrades carefully, test in staging

### Features in 1.34
- 30+ new monitoring metrics for observability
- Improved performance for hybrid search
- Better ACORN filter performance

### Docker Compose Setup
```yaml
services:
  weaviate:
    image: semitechnologies/weaviate:1.34.8
    ports:
      - "8080:8080"
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'none'
      ENABLE_MODULES: 'text2vec-ollama,generative-ollama'
    volumes:
      - weaviate_data:/var/lib/weaviate
```

**Sources:**
- [Weaviate Releases](https://github.com/weaviate/weaviate/releases)
- [Release Notes](https://docs.weaviate.io/weaviate/release-notes)
- [Weaviate 1.34 Release Blog](https://weaviate.io/blog/weaviate-1-34-release)

---

## LlamaIndex (TypeScript)

### Current Version
- **NPM Package:** `llamaindex`
- **Latest:** v0.12.0 (Published: 2 months ago)
- **Package Name:** `llamaindex` (main package)

### Installation
```bash
npm install llamaindex
```

### Additional Packages Needed
```bash
npm install @llamaindex/openai @llamaindex/workflow zod
```

### TypeScript Configuration
LlamaIndex.TS requires specific `tsconfig.json` settings:
- Module resolution configuration
- Web Stream API support
- Proper type definitions

### Architecture Notes
- Built specifically for TypeScript with excellent type safety
- Modular architecture with provider packages
- Supports async/await APIs
- Works in Node.js, browser, and serverless environments

### Best Practices 2026
1. Use provider-specific packages (e.g., `@llamaindex/openai`)
2. Prefer async/await over callbacks
3. Enable strict TypeScript checking
4. Use Zod for runtime validation

**Sources:**
- [LlamaIndex npm](https://www.npmjs.com/package/llamaindex)
- [LlamaIndex.TS Docs](https://developers.llamaindex.ai/typescript/framework/)
- [GitHub Repository](https://github.com/run-llama/LlamaIndexTS)

---

## PostgreSQL with pgvector

### Current Version
- **pgvector:** v0.8.1
- **PostgreSQL:** 13+ required (recommend 16+)

### Installation Options

#### 1. Docker (Recommended for Development)
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: vexora_rag
      POSTGRES_USER: vexora
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

#### 2. From Source (Linux/macOS)
```bash
git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

#### 3. Package Managers
- **Debian/Ubuntu:** PostgreSQL APT Repository
- **RHEL/CentOS:** PostgreSQL Yum Repository
```bash
# RPM-based
sudo dnf install pgvector_16  # Replace 16 with your PG version
```

### Enabling Extension
```sql
CREATE EXTENSION vector;
```

**Important:** The extension is called `vector`, not `pgvector`!

### Features in 0.8.1
- Supports PostgreSQL 13+
- Improved performance for vector operations
- Better indexing strategies
- HNSW and IVFFlat index support

**Sources:**
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Neon pgvector Docs](https://neon.com/docs/extensions/pgvector)
- [pgvector 2026 Guide](https://www.instaclustr.com/education/vector-database/pgvector-key-features-tutorial-and-pros-and-cons-2026-guide/)

---

## PDF Processing Library

### ❌ Avoid: pdf-parse
- **Status:** Unmaintained
- **Issues:** No TypeScript support, outdated

### ✅ Recommended: unpdf
- **Status:** Modern, actively maintained
- **Version:** Latest (check npm)
- **Why:** Built for TypeScript, ESM, async/await

### Installation
```bash
npm install unpdf
```

### Features
- Pure TypeScript with excellent type definitions
- Works in Node.js, browser, and serverless
- Switches between fast and detailed parsing automatically
- Based on Mozilla's PDF.js
- Async/await APIs (no callbacks)
- Modern ESM modules

### Alternative: pdf-ts
```bash
npm install pdf-ts
```
- TypeScript-focused
- Uses PDF.js for extraction
- Simpler API than unpdf

### Comparison
| Feature | unpdf | pdf-parse | pdf-ts |
|---------|-------|-----------|--------|
| TypeScript | ✅ Native | ❌ No | ✅ Native |
| Maintained | ✅ Yes | ❌ No | ✅ Yes |
| ESM | ✅ Yes | ❌ No | ✅ Yes |
| Async/Await | ✅ Yes | ⚠️ Partial | ✅ Yes |
| Serverless | ✅ Yes | ❌ No | ✅ Yes |

**Sources:**
- [7 PDF Parsing Libraries for Node.js](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025)
- [unpdf GitHub](https://github.com/unjs/unpdf)
- [pdf-ts GitHub](https://github.com/axflow/pdf-ts)

---

## Ollama Models

### Embedding Model: nomic-embed-text

**Version:** Latest available via Ollama
**Requirements:** Ollama 0.1.26+

#### Installation
```bash
ollama pull nomic-embed-text
```

#### Features
- Large context length encoder
- 768-dimensional embeddings
- Outperforms OpenAI text-embedding-ada-002 and text-embedding-3-small
- Multilingual support

#### API Usage
```bash
curl http://localhost:11434/api/embed \
  -d '{
    "model": "nomic-embed-text",
    "input": "Your text here"
  }'
```

**Sources:**
- [Ollama nomic-embed-text](https://ollama.com/library/nomic-embed-text)
- [Best Embedding Models 2026](https://elephas.app/blog/best-embedding-models)

---

### Reranking Model: Qwen3-Reranker ⭐

**⚠️ Important:** Original spec mentioned jina-reranker, but it's NOT available in Ollama!

#### Available Models
```bash
# Recommended for balance of speed/accuracy
ollama pull dengcao/Qwen3-Reranker-4B:Q5_K_M

# Lightweight option
ollama pull dengcao/Qwen3-Reranker-0.6B

# Maximum accuracy
ollama pull dengcao/Qwen3-Reranker-8B
```

#### Features
- Alibaba's state-of-the-art reranker
- 100+ languages supported
- Sizes: 0.6B, 4B, 8B parameters
- Quantized versions available (Q5_K_M for efficiency)

#### Usage Notes
- Ollama doesn't have native reranking API yet (as of 2026)
- Requires custom implementation using generation endpoint
- Send query + candidate pairs to model
- Parse relevance scores from output

#### Implementation Strategy
```typescript
// Pseudo-code for reranking with Qwen3-Reranker
async function rerank(query: string, candidates: string[]) {
  const results = [];
  for (const candidate of candidates) {
    const prompt = `Query: ${query}\nDocument: ${candidate}\nRelevance (0-1):`;
    const response = await ollama.generate({
      model: 'dengcao/Qwen3-Reranker-4B:Q5_K_M',
      prompt
    });
    results.push({ candidate, score: parseScore(response) });
  }
  return results.sort((a, b) => b.score - a.score);
}
```

**Alternative:** Use Jina Reranker API (requires internet, not local)

**Sources:**
- [Qwen3 Reranker on Ollama Guide](https://apidog.com/blog/qwen-3-embedding-reranker-ollama/)
- [Reranking with Qwen3 Tutorial](https://medium.com/@rosgluk/reranking-documents-with-ollama-and-qwen3-reranker-model-in-go-6dc9c2fb5f0b)
- [Ollama Reranker Discussion](https://github.com/ollama/ollama/issues/4510)

---

## Redis

### Current Version
- **Latest Stable:** Redis 7.x
- **Docker Image:** `redis:7-alpine` (recommended for production)

### Docker Compose Setup
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
```

### Node.js Client
```bash
npm install ioredis
```

**ioredis** is the recommended Redis client for Node.js (better TypeScript support than `redis` package).

---

## Summary: Updated Tech Stack

| Component | Recommended Version | Notes |
|-----------|-------------------|-------|
| **Weaviate** | 1.34.8 | Breaking: ACORN filter default |
| **LlamaIndex** | 0.12.0 | Use `llamaindex` npm package |
| **PostgreSQL** | 16+ | With pgvector 0.8.1 |
| **pgvector** | 0.8.1 | CREATE EXTENSION vector; |
| **Redis** | 7.x Alpine | Use ioredis client |
| **PDF Library** | unpdf | NOT pdf-parse (unmaintained) |
| **Embedding** | nomic-embed-text | Via Ollama |
| **Reranker** | Qwen3-Reranker-4B | NOT jina-reranker (unavailable) |

---

## Action Items for Implementation

1. ✅ **Update Spec:** Replace jina-reranker with Qwen3-Reranker
2. ✅ **Use unpdf:** Replace pdf-parse with unpdf in dependencies
3. ⚠️ **Test Weaviate 1.34:** Verify ACORN filter behavior
4. ⚠️ **Custom Reranker:** Implement reranking logic (no native Ollama API)
5. ✅ **Docker Images:** Use exact versions in docker-compose.yml

---

## Breaking Changes Checklist

- [ ] Weaviate Client v4 requires server 1.27+
- [ ] ACORN filter strategy is new default (may affect queries)
- [ ] unpdf has different API than pdf-parse (migration needed)
- [ ] Qwen3-Reranker requires custom implementation (no standard API)
- [ ] LlamaIndex 0.12.0 may have breaking changes from earlier versions

---

## Resources

### Documentation
- [Weaviate Docs](https://docs.weaviate.io)
- [LlamaIndex TypeScript Docs](https://developers.llamaindex.ai/typescript/framework/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Ollama Models](https://ollama.com/search?c=embedding)

### Community
- [Weaviate Forum](https://forum.weaviate.io/)
- [LlamaIndex Discord](https://discord.gg/llamaindex)
- [Ollama GitHub Issues](https://github.com/ollama/ollama/issues)
