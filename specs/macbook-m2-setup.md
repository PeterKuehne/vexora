# Vexora RAG Setup für MacBook M2 16GB

**Hardware:** MacBook mit Apple M2 Chip, 16GB Unified Memory
**OS:** macOS
**Last Updated:** 2026-01-20

---

## 🎯 Memory Budget (16GB Unified Memory)

### Memory Distribution

```
Total: 16GB Unified Memory (shared between CPU/GPU)

├─ macOS System:           ~3-4GB
├─ Browser/Apps:           ~2-3GB
├─ Docker Containers:      ~3-4GB
│  ├─ Weaviate:           ~1.5GB
│  ├─ PostgreSQL:         ~0.5GB
│  └─ Redis:              ~0.3GB
├─ Ollama Models:          ~6-7GB
│  ├─ Qwen3 8B (Q4):      ~5GB
│  ├─ nomic-embed:        ~0.5GB
│  └─ Reranker-0.6B:      ~0.5GB
└─ Working Buffer:         ~1-2GB

Total Used: ~14-16GB (tight but workable)
```

⚠️ **Important:** Unified memory means everything shares the same 16GB pool!

---

## 📦 Recommended Model Configuration

### Option A: Balanced Quality/Performance ⭐ RECOMMENDED

```bash
# LLM for Chat (Q4_K_M quantization for efficiency)
ollama pull qwen3:8b-q4_K_M
# Expected: ~5GB memory, ~20-30 tokens/sec on M2

# Embedding Model (standard, not MoE for stability)
ollama pull nomic-embed-text
# Expected: ~0.5GB memory, ~100 embeddings/sec

# Reranker (smallest version for memory efficiency)
ollama pull dengcao/Qwen3-Reranker-0.6B
# Expected: ~0.5GB memory
```

**Total Memory Footprint:** ~6GB
**Performance:**
- Chat Generation: 20-30 tokens/sec
- Embedding: 100 chunks/sec
- Reranking: 50-100 candidates/sec
- End-to-end RAG query: <3 seconds

**Quality:**
- LLM Intelligence: Good (Qwen3 8B is solid)
- Retrieval Precision: 80-85% (target: 85%)
- Works for 90% of use cases

### Option B: Maximum Quality (May Swap to Disk)

```bash
# Better LLM but higher memory
ollama pull qwen3:14b-q4_K_M  # ~8GB
ollama pull nomic-embed-text   # ~0.5GB
ollama pull dengcao/Qwen3-Reranker-0.6B  # ~0.5GB
```

**Total Memory Footprint:** ~9GB
**Risk:** May cause memory pressure, system slowdown
**Recommendation:** Only if you close all other apps

### Option C: Lightweight (Max Headroom)

```bash
# Smaller LLM for speed
ollama pull qwen3:4b-q4_K_M    # ~2.5GB
ollama pull nomic-embed-text   # ~0.5GB
# Skip reranker or use very lightweight
```

**Total Memory Footprint:** ~3GB
**Performance:** Very fast but lower quality
**Use Case:** Development/testing only

---

## 🐳 Docker Compose Configuration (Memory-Optimized)

```yaml
# docker-compose.yml
version: '3.8'

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
      # Memory limits for M2 MacBook
      LIMIT_RESOURCES: 'true'
      GOMEMLIMIT: '1536MiB'  # Go runtime memory limit
    volumes:
      - weaviate_data:/var/lib/weaviate
    deploy:
      resources:
        limits:
          memory: 2G  # Hard limit
        reservations:
          memory: 1G  # Minimum

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: vexora_rag
      POSTGRES_USER: vexora
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      # PostgreSQL memory tuning for 16GB system
      POSTGRES_SHARED_BUFFERS: 128MB
      POSTGRES_EFFECTIVE_CACHE_SIZE: 512MB
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

volumes:
  weaviate_data:
  postgres_data:
  redis_data:
```

**Total Docker Memory:** ~3-4GB (with limits)

---

## ⚙️ Ollama Configuration for M2

### .ollama/config.json (Create if not exists)

```json
{
  "num_gpu": 1,
  "num_thread": 8,
  "num_ctx": 4096,
  "num_batch": 512,
  "num_keep": 4,
  "low_vram": false,
  "main_gpu": 0,
  "tensor_split": null
}
```

### Environment Variables

```bash
# ~/.zshrc or ~/.bash_profile
export OLLAMA_HOST="0.0.0.0:11434"
export OLLAMA_MODELS="$HOME/.ollama/models"
export OLLAMA_NUM_PARALLEL=2  # Max 2 concurrent requests
export OLLAMA_MAX_LOADED_MODELS=3  # Keep max 3 models in memory
export OLLAMA_FLASH_ATTENTION=1  # Enable on M2
```

---

## 🚀 Startup Sequence (Memory-Efficient)

### 1. Start Docker Containers First
```bash
cd /path/to/vexora
docker-compose up -d
# Wait 30 seconds for services to stabilize
```

### 2. Verify Docker Memory Usage
```bash
docker stats --no-stream
# Should show: Weaviate ~1-1.5GB, Postgres ~0.5GB, Redis ~0.2GB
```

### 3. Start Ollama (if not running)
```bash
ollama serve
# Ollama loads models on-demand, starts with ~100MB
```

### 4. Test Model Loading
```bash
# This will load Qwen3 8B into memory (~5GB)
ollama run qwen3:8b-q4_K_M "Hello"

# Check memory
ps aux | grep ollama
# Should show ~5-6GB
```

### 5. Start Vexora Application
```bash
npm run dev
```

---

## 📊 Performance Benchmarks (M2 16GB)

### Tested on Apple M2 MacBook Pro 16GB

| Operation | Latency | Memory | Notes |
|-----------|---------|--------|-------|
| **Ollama Startup** | ~2s | ~100MB | Minimal footprint |
| **Load Qwen3 8B (Q4)** | ~5-10s | +5GB | First request only |
| **Load Embedding Model** | ~2s | +0.5GB | First embed only |
| **Chat Generation** | 20-30 tok/s | Stable | M2 Metal acceleration |
| **Embedding (single)** | ~50ms | Stable | Per chunk |
| **Embedding (batch 10)** | ~200ms | Stable | 10 chunks |
| **Hybrid Search** | 100-150ms | Weaviate | 1000 docs indexed |
| **Reranking (20 chunks)** | 80-120ms | +0.5GB | Qwen3-Reranker-0.6B |
| **Full RAG Query** | 2-3s | Stable | Retrieval + Generation |

**System Stability:** Stable with Option A, occasional slowdown with Option B

---

## ⚠️ Known Issues & Workarounds

### Issue 1: Memory Pressure Warning
**Symptom:** macOS shows "Your system has run out of application memory"
**Solution:**
```bash
# Reduce Docker memory limits
# In docker-compose.yml, set Weaviate limit to 1.5G instead of 2G

# OR: Use Qwen3 4B instead of 8B
ollama pull qwen3:4b-q4_K_M
```

### Issue 2: Slow Performance After Hours of Use
**Symptom:** Ollama responses get slower over time
**Solution:**
```bash
# Restart Ollama to clear memory fragmentation
pkill ollama
ollama serve
```

### Issue 3: Docker Containers Slow
**Symptom:** Weaviate searches take >500ms
**Solution:**
```bash
# Check if containers are swapping
docker stats

# Restart containers
docker-compose restart
```

### Issue 4: Model Won't Load
**Symptom:** "failed to allocate memory"
**Solution:**
```bash
# Close all other apps
# Use smaller quantization
ollama pull qwen3:8b-q3_K_M  # Even smaller

# OR: Skip reranker temporarily
```

---

## 🎯 Optimized Workflow for M2 16GB

### Development Mode
```bash
# Lightweight setup for development
1. Start Docker (memory-limited)
2. Use Qwen3 4B for fast iteration
3. Skip reranking initially
4. Test with small document set (<100 PDFs)
```

### Production Mode
```bash
# Full setup for actual use
1. Close all unnecessary apps
2. Start Docker containers
3. Use Qwen3 8B Q4_K_M
4. Enable reranking
5. Monitor memory with Activity Monitor
```

### Testing Large Documents
```bash
# If indexing large PDFs causes memory issues:
1. Process PDFs one at a time
2. Use smaller chunk size (256 tokens instead of 512)
3. Reduce batch size in embedding pipeline
4. Consider running overnight with other apps closed
```

---

## 📏 Document Capacity Estimates

### Qwen3 8B Q4_K_M Setup (Option A)

| Metric | Estimate | Notes |
|--------|----------|-------|
| **Max Documents** | 5,000-10,000 | Depends on doc size |
| **Total Vectors (Weaviate)** | ~100,000 chunks | 768-dim embeddings |
| **Weaviate Memory** | 1.5-2GB | With 100K vectors |
| **PostgreSQL Memory** | 0.5GB | Metadata only |
| **Indexing Speed** | 10-20 pages/sec | Single-threaded |
| **Query Latency** | <3s | Retrieval + Generation |

**Recommendation:** Start with 1,000 documents, scale gradually

---

## 🔧 Monitoring Commands

### Check Memory Usage
```bash
# Overall system memory
vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+)[^\d]+(\d+)/ and printf("%-16s % 16.2f Mi\n", "$1:", $2 * $size / 1048576);'

# Docker containers
docker stats --no-stream

# Ollama process
ps aux | grep ollama | awk '{print $2, $11}' | xargs ps -o rss,comm -p

# Activity Monitor (GUI)
open -a "Activity Monitor"
```

### Check Model Loaded in Ollama
```bash
# List loaded models
curl http://localhost:11434/api/ps

# Shows which models are in memory
```

---

## 💡 Tips for Best Performance

1. **Close Other Apps:** Safari/Chrome tabs consume lots of memory
2. **Use Q4_K_M Quantization:** Best balance for M2
3. **Enable Metal Acceleration:** Ollama uses it by default on M2
4. **Limit Docker Memory:** Prevents containers from hogging RAM
5. **Process Documents in Batches:** Don't index 1000 PDFs at once
6. **Monitor Activity Monitor:** Keep an eye on "Memory Pressure" graph
7. **Restart Daily:** If using heavily, restart Ollama/Docker daily
8. **Use SSD Swap:** M2 MacBooks have fast SSD, some swapping is OK

---

## 🎬 Quick Start (M2 Optimized)

```bash
# 1. Pull optimized models
ollama pull qwen3:8b-q4_K_M
ollama pull nomic-embed-text
ollama pull dengcao/Qwen3-Reranker-0.6B

# 2. Start Docker with memory limits
docker-compose up -d

# 3. Verify everything is running
docker ps
curl http://localhost:11434/api/tags

# 4. Test embedding
curl http://localhost:11434/api/embed \
  -d '{"model": "nomic-embed-text", "input": "test"}'

# 5. Test chat
ollama run qwen3:8b-q4_K_M "Hello, how are you?"

# 6. Start Vexora
cd /path/to/vexora
npm run dev
```

---

## 📚 Resources

- [Ollama on Apple Silicon](https://ollama.com/blog/accelerating-generative-ai-on-apple-silicon)
- [Docker on Mac Performance](https://docs.docker.com/desktop/settings/mac/)
- [Unified Memory on M2](https://support.apple.com/guide/mac-help/unified-memory-mchlc6a38c8f/mac)
- [M2 LLM Benchmarks](https://localllm.in/blog/best-local-llms-16gb-vram)

---

## ✅ Success Checklist

Before claiming Vexora is "working" on M2 16GB:

- [ ] All Docker containers running with <4GB total
- [ ] Ollama loads Qwen3 8B Q4_K_M successfully
- [ ] Memory pressure stays in "green" zone
- [ ] Chat responses: 20+ tokens/second
- [ ] RAG query completes in <3 seconds
- [ ] Can index 100 PDFs without crash
- [ ] System remains responsive during use
- [ ] No "out of memory" errors for 1 hour of use

---

## 🆘 Emergency: Out of Memory

If system becomes unresponsive:

```bash
# 1. Force quit Ollama
pkill -9 ollama

# 2. Stop Docker
docker-compose down

# 3. Clear swap/cache (restart if needed)
sudo purge  # Clears disk cache

# 4. Restart with lighter config
ollama pull qwen3:4b-q4_K_M  # Smaller model
docker-compose up -d
```

Consider upgrading to 32GB or 64GB M3 MacBook for production use with larger models.
