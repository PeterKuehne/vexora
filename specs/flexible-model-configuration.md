# Flexible Model Configuration System

**Purpose:** Allow users to easily switch between different models without code changes
**Last Updated:** 2026-01-20

---

## 🎯 Design Principle

Vexora must be **model-agnostic** and support easy upgrades from:
- MacBook M2 16GB → Workstation with 64GB VRAM
- Local Ollama → Cloud API providers (future)
- Small models (8B) → Large models (70B+)
- Different embedding dimensions (768 → 8192)

**No hardcoded model names in application code!**

---

## 📋 Configuration Architecture

### 1. Model Profiles (Presets)

Users can choose from predefined profiles or create custom:

```typescript
// config/model-profiles.ts
interface ModelProfile {
  id: string;
  name: string;
  description: string;
  hardware: string;  // "M2 16GB", "64GB Workstation", etc.

  llm: {
    model: string;           // "qwen3:8b-q4_K_M"
    provider: string;        // "ollama", "openai", "anthropic"
    contextWindow: number;   // 128000
    maxTokens?: number;      // Optional generation limit
  };

  embedding: {
    model: string;           // "nomic-embed-text"
    provider: string;        // "ollama", "openai", "voyage"
    dimensions: number;      // 768, 1024, 8192, etc.
    maxBatchSize: number;    // 100
  };

  reranker?: {
    model: string;           // "dengcao/Qwen3-Reranker-0.6B"
    provider: string;        // "ollama", "cohere"
    enabled: boolean;
  };

  performance: {
    maxConcurrentRequests: number;  // 2 for M2, 10 for workstation
    chunkSize: number;              // 512 tokens
    chunkOverlap: number;           // 50 tokens
    retrievalTopK: number;          // 5
  };
}

// Predefined profiles
const PROFILES: ModelProfile[] = [
  {
    id: "m2-16gb-balanced",
    name: "MacBook M2 16GB (Balanced)",
    description: "Optimized for Apple M2 with 16GB unified memory",
    hardware: "M2 16GB",
    llm: {
      model: "qwen3:8b-q4_K_M",
      provider: "ollama",
      contextWindow: 128000
    },
    embedding: {
      model: "nomic-embed-text",
      provider: "ollama",
      dimensions: 768,
      maxBatchSize: 100
    },
    reranker: {
      model: "dengcao/Qwen3-Reranker-0.6B",
      provider: "ollama",
      enabled: true
    },
    performance: {
      maxConcurrentRequests: 2,
      chunkSize: 512,
      chunkOverlap: 50,
      retrievalTopK: 5
    }
  },

  {
    id: "workstation-64gb-quality",
    name: "Workstation 64GB (High Quality)",
    description: "For high-end workstations with 64GB+ VRAM",
    hardware: "64GB+ VRAM",
    llm: {
      model: "qwen3:32b",
      provider: "ollama",
      contextWindow: 128000
    },
    embedding: {
      model: "qwen3-embedding:8b",
      provider: "ollama",
      dimensions: 8192,  // Higher dimensions!
      maxBatchSize: 50   // Smaller batches due to size
    },
    reranker: {
      model: "dengcao/Qwen3-Reranker-4B",
      provider: "ollama",
      enabled: true
    },
    performance: {
      maxConcurrentRequests: 10,
      chunkSize: 512,
      chunkOverlap: 50,
      retrievalTopK: 10  // More context
    }
  },

  {
    id: "cloud-hybrid",
    name: "Cloud Hybrid (API)",
    description: "Local LLM with cloud embeddings for best quality",
    hardware: "Any + Internet",
    llm: {
      model: "qwen3:32b",
      provider: "ollama",
      contextWindow: 128000
    },
    embedding: {
      model: "voyage-3.5-lite",
      provider: "voyage",  // API
      dimensions: 512,
      maxBatchSize: 100
    },
    reranker: {
      model: "rerank-v4",
      provider: "cohere",  // API
      enabled: true
    },
    performance: {
      maxConcurrentRequests: 5,
      chunkSize: 512,
      chunkOverlap: 50,
      retrievalTopK: 5
    }
  },

  {
    id: "custom",
    name: "Custom Configuration",
    description: "Manually configured by user",
    hardware: "User-defined",
    // User fills in all fields
  }
];
```

---

## 🔧 Dynamic Model Detection

### Auto-discover Available Models

```typescript
// services/ModelDiscovery.ts

interface AvailableModel {
  name: string;
  provider: string;
  size: string;          // "8B", "32B", etc.
  quantization?: string; // "Q4_K_M", "Q8_0", etc.
  family: string;        // "qwen3", "llama", "mistral"
  type: "llm" | "embedding" | "reranker";
}

class ModelDiscoveryService {
  /**
   * Fetch available models from Ollama
   */
  async discoverOllamaModels(): Promise<AvailableModel[]> {
    const response = await fetch('http://localhost:11434/api/tags');
    const { models } = await response.json();

    return models.map(m => ({
      name: m.name,
      provider: 'ollama',
      size: this.extractSize(m.name),
      quantization: this.extractQuantization(m.name),
      family: this.extractFamily(m.name),
      type: this.detectType(m.name)
    }));
  }

  /**
   * Check if a model is loaded in memory
   */
  async isModelLoaded(modelName: string): Promise<boolean> {
    const response = await fetch('http://localhost:11434/api/ps');
    const { models } = await response.json();
    return models.some(m => m.name === modelName);
  }

  /**
   * Get model info (context window, dimensions, etc.)
   */
  async getModelInfo(modelName: string): Promise<ModelInfo> {
    const response = await fetch('http://localhost:11434/api/show', {
      method: 'POST',
      body: JSON.stringify({ name: modelName })
    });
    return response.json();
  }

  private extractSize(name: string): string {
    // "qwen3:8b-q4_K_M" → "8B"
    const match = name.match(/(\d+(?:\.\d+)?)[bB]/);
    return match ? match[1] + 'B' : 'Unknown';
  }

  private extractQuantization(name: string): string | undefined {
    // "qwen3:8b-q4_K_M" → "Q4_K_M"
    const match = name.match(/-(q\d+_[a-z0-9_]+)/i);
    return match ? match[1].toUpperCase() : undefined;
  }

  private extractFamily(name: string): string {
    // "qwen3:8b" → "qwen3"
    return name.split(':')[0].toLowerCase();
  }

  private detectType(name: string): "llm" | "embedding" | "reranker" {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('embed')) return 'embedding';
    if (lowerName.includes('rerank')) return 'reranker';
    return 'llm';
  }
}
```

---

## 🎨 User Interface for Model Selection

### Settings UI Extension

```
Settings → RAG Configuration → Model Profiles

┌─────────────────────────────────────────────────┐
│ Model Configuration                             │
├─────────────────────────────────────────────────┤
│                                                 │
│ Profile: [MacBook M2 16GB (Balanced) ▼]        │
│          ☐ Custom Configuration                 │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ LLM Model                               │   │
│ ├─────────────────────────────────────────┤   │
│ │ Provider: [Ollama ▼]                    │   │
│ │ Model:    [qwen3:8b-q4_K_M ▼]          │   │
│ │           Available: qwen3:8b-q4_K_M ✓  │   │
│ │                     qwen3:14b-q4_K_M    │   │
│ │                     qwen3:32b           │   │
│ │ Status:   🟢 Loaded (5.2GB)            │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Embedding Model                         │   │
│ ├─────────────────────────────────────────┤   │
│ │ Provider: [Ollama ▼]                    │   │
│ │ Model:    [nomic-embed-text ▼]         │   │
│ │ Dims:     768                           │   │
│ │ Status:   🟢 Loaded (0.5GB)            │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Reranker (Optional)                     │   │
│ ├─────────────────────────────────────────┤   │
│ │ ☑ Enable Reranking                      │   │
│ │ Provider: [Ollama ▼]                    │   │
│ │ Model:    [Qwen3-Reranker-0.6B ▼]      │   │
│ │ Status:   ⚪ Not loaded                 │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Performance Settings                    │   │
│ ├─────────────────────────────────────────┤   │
│ │ Chunk Size:      [512 ▼] tokens        │   │
│ │ Chunk Overlap:   [50 ▼] tokens         │   │
│ │ Retrieval Top-K: [5 ▼] chunks          │   │
│ │ Max Concurrent:  [2 ▼] requests        │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Total Memory: ~6GB / 16GB (38%)                │
│                                                 │
│ [Test Configuration] [Save] [Reset to Default] │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Migration Strategy for Different Embedding Dimensions

### Challenge: Changing Embedding Models

If user switches from 768-dim to 8192-dim embeddings, all existing vectors become invalid.

### Solution: Vector Store Versioning

```typescript
interface VectorStoreSchema {
  version: number;
  embeddingModel: string;
  dimensions: number;
  createdAt: string;
  documentCount: number;
}

class VectorStoreManager {
  /**
   * Check if embedding model has changed
   */
  async checkCompatibility(newModel: string, newDims: number): Promise<boolean> {
    const currentSchema = await this.getCurrentSchema();

    if (currentSchema.dimensions !== newDims) {
      return false;  // Incompatible!
    }

    return true;
  }

  /**
   * Handle model change with different dimensions
   */
  async handleModelChange(newModel: string, newDims: number): Promise<void> {
    const compatible = await this.checkCompatibility(newModel, newDims);

    if (!compatible) {
      // User decision required
      const action = await this.promptUser({
        title: "Embedding Model Change Detected",
        message: `New model has ${newDims} dimensions, but existing vectors have ${currentSchema.dimensions} dimensions.`,
        options: [
          "Re-index all documents (recommended)",
          "Keep old vectors (may cause issues)",
          "Cancel"
        ]
      });

      if (action === 0) {
        await this.reindexAllDocuments(newModel, newDims);
      }
    }

    // Update schema
    await this.updateSchema({ embeddingModel: newModel, dimensions: newDims });
  }

  /**
   * Re-index all documents with new embedding model
   */
  async reindexAllDocuments(model: string, dims: number): Promise<void> {
    // 1. Create new Weaviate collection with new dimensions
    await this.createCollection(`documents_${dims}d`, dims);

    // 2. Get all documents from PostgreSQL
    const documents = await this.getAllDocuments();

    // 3. Re-embed and re-index
    for (const doc of documents) {
      await this.reindexDocument(doc.id, model);
    }

    // 4. Switch to new collection
    await this.switchActiveCollection(`documents_${dims}d`);

    // 5. Delete old collection (after confirmation)
    await this.deleteOldCollection();
  }
}
```

---

## 📝 Configuration Storage

### Backend: PostgreSQL

```sql
-- Store model configuration
CREATE TABLE model_configurations (
  id SERIAL PRIMARY KEY,
  profile_id VARCHAR(50) NOT NULL,
  profile_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT false,

  -- LLM settings
  llm_model VARCHAR(100) NOT NULL,
  llm_provider VARCHAR(50) NOT NULL,
  llm_context_window INTEGER,

  -- Embedding settings
  embedding_model VARCHAR(100) NOT NULL,
  embedding_provider VARCHAR(50) NOT NULL,
  embedding_dimensions INTEGER NOT NULL,

  -- Reranker settings
  reranker_model VARCHAR(100),
  reranker_provider VARCHAR(50),
  reranker_enabled BOOLEAN DEFAULT true,

  -- Performance settings
  chunk_size INTEGER DEFAULT 512,
  chunk_overlap INTEGER DEFAULT 50,
  retrieval_top_k INTEGER DEFAULT 5,
  max_concurrent_requests INTEGER DEFAULT 2,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track which embedding version each document was indexed with
CREATE TABLE document_embeddings (
  document_id UUID REFERENCES documents(id),
  embedding_model VARCHAR(100) NOT NULL,
  embedding_dimensions INTEGER NOT NULL,
  indexed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (document_id, embedding_model)
);
```

### Frontend: Settings Context Extension

```typescript
// src/contexts/RAGConfigContext.tsx

interface RAGConfig {
  activeProfile: string;
  profiles: ModelProfile[];
  currentModels: {
    llm: AvailableModel;
    embedding: AvailableModel;
    reranker?: AvailableModel;
  };
  performance: PerformanceSettings;
}

const RAGConfigContext = createContext<RAGConfig | null>(null);

export function RAGConfigProvider({ children }) {
  const [config, setConfig] = useState<RAGConfig>(loadFromLocalStorage());

  // Auto-discover models on mount
  useEffect(() => {
    discoverAvailableModels();
  }, []);

  // Save to localStorage + backend
  useEffect(() => {
    saveToLocalStorage(config);
    saveToBackend(config);
  }, [config]);

  return (
    <RAGConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </RAGConfigContext.Provider>
  );
}
```

---

## 🧪 Testing Different Configurations

### Test Suite Button in UI

```
Settings → RAG Configuration → [Test Configuration]

Runs:
1. ✓ Check if models are available
2. ✓ Load models into memory
3. ✓ Test embedding (sample text)
4. ✓ Test LLM generation (sample prompt)
5. ✓ Test reranker (if enabled)
6. ✓ Measure latency
7. ✓ Estimate memory usage

Results:
┌─────────────────────────────────────┐
│ Configuration Test Results          │
├─────────────────────────────────────┤
│ LLM:       ✓ qwen3:8b-q4_K_M       │
│            27 tokens/sec            │
│            Memory: 5.2GB            │
│                                     │
│ Embedding: ✓ nomic-embed-text      │
│            120 chunks/sec           │
│            Memory: 0.5GB            │
│                                     │
│ Reranker:  ✓ Qwen3-Reranker-0.6B   │
│            85ms for 20 candidates   │
│            Memory: 0.5GB            │
│                                     │
│ Total Memory: 6.2GB / 16GB (39%)    │
│ Expected RAG Latency: 2.8s          │
│                                     │
│ ✓ Configuration is valid            │
└─────────────────────────────────────┘
```

---

## 📊 Upgrade Paths

### Example: M2 16GB → Workstation 64GB

```typescript
// User clicks "Upgrade to High Quality Profile"

const upgradeSteps = [
  {
    step: 1,
    action: "Pull new models",
    commands: [
      "ollama pull qwen3:32b",
      "ollama pull qwen3-embedding:8b",
      "ollama pull dengcao/Qwen3-Reranker-4B"
    ]
  },
  {
    step: 2,
    action: "Re-index documents with new embedding model",
    warning: "This will take ~30 minutes for 1000 documents",
    skippable: false
  },
  {
    step: 3,
    action: "Switch to new profile",
    immediate: true
  },
  {
    step: 4,
    action: "Test new configuration",
    automatic: true
  }
];
```

---

## 🎯 API Design: Model-Agnostic Endpoints

### Current Design ✓ (Already model-agnostic)

```typescript
// POST /api/rag/chat
{
  "messages": [...],
  "ragConfig": {
    "enabled": true,
    // No model specified - uses active profile!
  }
}

// Internally, backend reads from active configuration:
const config = await getActiveModelConfiguration();
const llmResponse = await generate({
  model: config.llm_model,
  provider: config.llm_provider,
  messages: [...]
});
```

### No Code Changes Needed When Changing Models! ✓

---

## ✅ Summary: What Makes Vexora Flexible

1. **Profile System:** Pre-configured + Custom profiles
2. **Auto-Discovery:** Detects available Ollama models
3. **Dynamic Switching:** Change models without code changes
4. **Dimension Handling:** Automatic re-indexing when embedding dims change
5. **UI Transparency:** Shows current models, memory usage, status
6. **Test Suite:** Validate configuration before use
7. **Upgrade Paths:** Guided upgrades to better hardware
8. **API Design:** Backend uses config, not hardcoded models

---

## 🔧 Implementation Requirements

### What Needs to be Built:

1. **ModelProfile Interface & Storage** (PostgreSQL + Settings)
2. **ModelDiscoveryService** (Auto-detect Ollama models)
3. **VectorStoreManager** (Handle dimension changes)
4. **Settings UI Extensions** (Profile selector, test button)
5. **Configuration API** (`GET/PUT /api/rag/config`)
6. **Migration System** (Re-index on model change)

### What Stays Simple:

- Core RAG logic doesn't change
- Just reads from active configuration
- Models are referenced by config, not hardcoded

---

## 📚 User Documentation

### Quick Start Guide

```markdown
# Changing Models in Vexora

## Option 1: Use a Preset Profile
1. Go to Settings → RAG Configuration
2. Select profile: "Workstation 64GB (High Quality)"
3. Click "Test Configuration"
4. If test passes, click "Apply"
5. System will re-index documents if needed

## Option 2: Custom Configuration
1. Go to Settings → RAG Configuration
2. Check "Custom Configuration"
3. Select your models from dropdowns
4. Adjust performance settings
5. Click "Test Configuration"
6. Save when ready

## Upgrading Your Setup

When you get better hardware:
1. Pull new models: `ollama pull qwen3:32b`
2. Switch profile in Vexora
3. Re-index documents (automatic)
4. Enjoy better quality!
```

---

## 🎬 Example: User Journey

**Day 1:** User installs Vexora on M2 16GB
- Selects "M2 16GB Balanced" profile
- Uses Qwen3 8B + nomic-embed-text
- Everything works great

**Month 6:** User gets workstation with RTX 4090 (64GB)
- Pulls Qwen3 70B: `ollama pull qwen3:70b`
- Opens Settings → Changes profile to "Workstation 64GB"
- Vexora detects dimension change (768 → 8192)
- Prompts: "Re-index 5,000 documents? (~2 hours)"
- User confirms, goes for coffee
- Returns to ultra-high-quality RAG system

**No code touched. No config files edited. Just works.** ✨
