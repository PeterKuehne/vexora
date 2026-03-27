# Spec: Wissensspeicher — Das Gedächtnis des Unternehmens

**Status:** RAG-Pipeline produktionsreif, Wissensrückfluss fehlt
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — Säule 1: "Alles was das Unternehmen weiß, an einem Ort"

---

## Zusammenfassung

Der Wissensspeicher ist die zentrale Wissensquelle für Menschen und Agenten. Aktuell nimmt er nur manuell hochgeladene Dokumente auf. Die Vision erfordert, dass auch **Ergebnisse aus Agent-Konversationen** zurückfließen — das Unternehmen baut organisch sein eigenes Gedächtnis auf.

Die bestehende RAG-Pipeline (Hybrid-Suche, Reranking, Graph RAG, Berechtigungen) ist solide und bleibt unverändert. Diese Spec beschreibt die fehlenden Erweiterungen.

---

## 1. Bestehende RAG-Pipeline (unverändert)

### 1.1 Dokument-Verarbeitung

```
Upload (PDF/DOCX/PPTX/XLSX/HTML/MD/TXT, max 150MB)
    │
    ▼
Docling Parser → Content-Blöcke + Metadaten
    │
    ▼
Chunking (Semantisch + Fixed Hybrid, Hierarchisch)
    │  Level 0: Dokument
    │  Level 1: Section
    │  Level 2: Paragraph
    ▼
Embedding (nomic-embed-text-v2-moe, 384 dim) → Weaviate V2
    │
    ▼
Entity Extraction → Neo4j (Personen, Orgs, Konzepte, Beziehungen)
```

### 1.2 Such-Pipeline

```
User-Query
    │
    ▼
Query Intelligence (Typ-Klassifikation, Rewriting)
    │
    ▼
Hybrid Search (BM25 70% + Vector 30%, hybridAlpha=0.3)
    │
    ▼
Document Expansion (Top-3 Dokumente, alle Chunks laden)
    │
    ▼
Reranking (BGE-reranker-v2-m3)
    │
    ▼
Top-5 Ergebnisse → Agent/LLM Synthese
```

### 1.3 Konfiguration

| Setting | Wert | Zweck |
|---|---|---|
| `hybridAlpha` | 0.3 | 70% Keyword, 30% Semantic — optimiert für deutsche Texte |
| `searchThreshold` | 0.1 | Niedrig, damit Reranker genug Kandidaten bekommt |
| `RERANKER_TOP_K` | 5 | Max Ergebnisse nach Reranking |
| `MIN_CHUNK_SIZE` | 100 chars | Minimale Chunk-Größe |
| `MAX_CHUNK_SIZE` | 1000 chars | Maximale Chunk-Größe |
| Embedding-Model | nomic-embed-text-v2-moe | 384 Dimensionen, multilingual |
| Reranker | BGE-reranker-v2-m3 | Multilingual, produktionsreif |

### 1.4 Berechtigungen (RLS)

| Classification | Employee | Manager | Admin |
|---|---|---|---|
| `public` | ✅ | ✅ | ✅ |
| `internal` | ✅ | ✅ | ✅ |
| `confidential` | ❌ | ✅ | ✅ |
| `restricted` | ❌ | ❌ | ✅ |

Zusätzlich: Visibility (`only_me`, `department`, `all_users`, `specific_users`), Owner-Rechte, Audit-Logging.

**Status:** ✅ Vollständig implementiert und produktionsreif

---

## 2. Wissensrückfluss — Was fehlt

### 2.1 Problem

Der Wissensspeicher nimmt nur manuell hochgeladene Dateien auf. Ergebnisse aus Agent-Konversationen (Reports, Analysen, Strategiepapiere) gehen verloren — sie existieren nur in der Konversation.

Die Vision sagt: *"Jede Konversation, jedes erarbeitete Ergebnis kann zurück in den Wissensspeicher fließen."*

### 2.2 Zwei Wege Ergebnisse zu speichern

**Weg 1: Über Skills (bereits entschieden in Skills-Spec)**

Relevante Skills haben als letzten Schritt:
```markdown
Frage den User: "Soll ich das Ergebnis im Wissensspeicher ablegen?"
- Wenn ja: Nutze `create_document` mit dem Ergebnis
- Wenn nein: Beende ohne zu speichern
```

**Weg 2: Manuell aus der Konversation**

Ein Button in der Agent-Antwort: **"Im Wissensspeicher ablegen"**. Der User klickt, das Ergebnis wird als Dokument gespeichert. Funktioniert auch ohne Skill — für jede beliebige Agent-Antwort.

### 2.3 Dokument-Herkunft

Aktuell gibt es nur Upload-Dokumente. Agent-erstellte Dokumente müssen als solche erkennbar sein.

**Neues Feld:** `source_type` in der `documents` Tabelle:

| Wert | Bedeutung |
|---|---|
| `upload` | Mensch hat Datei hochgeladen (bisheriges Verhalten) |
| `agent` | Agent hat Dokument aus Konversation erstellt |

**Neues Feld:** `source_task_id` — Link zurück zur Agent-Konversation die das Ergebnis erzeugt hat. Nur gesetzt bei `source_type = 'agent'`.

### 2.4 Implementierung

**DB-Migration:**
```sql
ALTER TABLE documents ADD COLUMN source_type VARCHAR(20) DEFAULT 'upload';
ALTER TABLE documents ADD COLUMN source_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL;
```

**Änderung `create_document` Tool:**
- Setzt `source_type = 'agent'`
- Setzt `source_task_id` aus dem aktuellen Task-Kontext

**Neuer Button im Frontend (`AgentTaskDetail.tsx`):**
- Unter jeder Agent-Antwort (nicht-running): dezenter Link "Im Wissensspeicher ablegen"
- Klick → Dialog: Titel eingeben, Kategorie wählen, Classification setzen
- Speichert via `create_document` API mit `source_type = 'agent'` und `source_task_id`

**Anzeige in Dokument-Liste:**
- Agent-erstellte Dokumente bekommen ein kleines Icon (Bot-Symbol)
- Klick auf "Quelle" → öffnet die Konversation die das Ergebnis erzeugt hat

---

## 3. Was NICHT geändert wird

| Bereich | Grund |
|---|---|
| **RAG-Pipeline** | Funktioniert, bewährt, keine Änderung nötig |
| **Chunking** | Hierarchisch + Semantisch ist State-of-the-Art |
| **Hybrid-Suche** | hybridAlpha=0.3 optimiert für deutsche Texte |
| **Reranking** | BGE-reranker-v2-m3 produktionsreif |
| **Graph RAG** | Entity-Extraction + Neo4j funktioniert |
| **Berechtigungen** | RLS mit 4 Classification-Stufen komplett |
| **Dokument-Preview** | Nice-to-have, niedrige Priorität |
| **Web-Content** | Zukunft (Enterprise-Anbindungen) |
| **E-Mail/Collaboration** | Zukunft (Enterprise-Anbindungen) |
| **Manuelle Notizen** | Kein akuter Bedarf |

---

## 4. Was bereits implementiert ist

| Feature | Status | Datei(en) |
|---|---|---|
| Dokument-Upload (Multi-Format) | ✅ | routes/documents.ts |
| Docling Parser | ✅ | services/ParserService.ts |
| Hierarchisches Chunking (V2) | ✅ | services/ChunkingPipeline.ts |
| Embeddings (Weaviate V2) | ✅ | services/rag/VectorServiceV2.ts |
| Hybrid Search (BM25 + Vector) | ✅ | services/rag/RAGService.ts |
| Document Expansion | ✅ | services/rag/RAGService.ts |
| Reranking (BGE-v2-m3) | ✅ | services/RerankerService.ts |
| Graph RAG (Neo4j) | ✅ | services/rag/GraphService.ts |
| RLS + Berechtigungen | ✅ | PostgreSQL Policies |
| Query Intelligence | ✅ | services/rag/QueryRouter.ts |
| Guardrails (Input/Output) | ✅ | services/rag/Guardrails.ts |
| PII Guard (Presidio) | ✅ | services/llm/PIIGuard.ts |
| `create_document` Tool | ✅ | agents/tools/create-document.ts |
| Frontend (Upload, Liste, Filter) | ✅ | pages/DocumentsPage.tsx |
| Audit-Logging | ✅ | audit_logs Tabelle |
| Dokument-Herkunft (`source_type`) | ❌ | Nicht implementiert |
| Rücklink zur Konversation | ❌ | Nicht implementiert |
| "Im Wissensspeicher ablegen" Button | ❌ | Nicht implementiert |

## 5. Was implementiert werden muss

| Feature | Priorität | Aufwand | Beschreibung |
|---|---|---|---|
| **`source_type` + `source_task_id`** | Hoch | Klein | DB-Migration, 2 Felder |
| **`create_document` erweitern** | Hoch | Klein | `source_type='agent'` + Task-ID setzen |
| **"Im Wissensspeicher ablegen" Button** | Hoch | Mittel | Button in AgentTaskDetail, Dialog, API-Call |
| **Agent-Dokument Icon in Liste** | Mittel | Klein | Bot-Symbol bei `source_type='agent'` |
| **"Quelle anzeigen" Link** | Mittel | Klein | Öffnet Konversation bei Klick |

### Implementierungs-Reihenfolge

1. DB-Migration: `source_type` + `source_task_id` hinzufügen
2. `create_document` Tool: `source_type='agent'` + Task-ID aus Kontext setzen
3. Frontend: "Im Wissensspeicher ablegen" Button unter Agent-Antworten
4. Frontend: Agent-Dokument Icon + Quell-Link in Dokument-Liste

---

## 6. Verifikation

1. **Skill-Rückfluss:** Research-Report Skill → Agent fragt am Ende "Speichern?" → User sagt ja → Dokument erscheint im Wissensspeicher mit `source_type='agent'`
2. **Manueller Rückfluss:** User liest Agent-Antwort → klickt "Im Wissensspeicher ablegen" → gibt Titel/Kategorie ein → Dokument wird gespeichert
3. **Herkunft sichtbar:** In Dokument-Liste: Agent-erstellte Dokumente haben Bot-Icon
4. **Quell-Link:** Klick auf "Quelle" bei Agent-Dokument → öffnet die Konversation
5. **Berechtigungen:** Agent-erstellte Dokumente erben Classification-Level aus Dialog
6. **Durchsuchbar:** Agent-erstelltes Dokument → wird gechunkt + embedded → via RAG-Suche findbar
7. **Bestehende Pipeline unverändert:** Upload-Dokumente funktionieren wie bisher
