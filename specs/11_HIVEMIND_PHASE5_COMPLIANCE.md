# Phase 5: Knowledge Enhancement + Compliance

**Zeitraum:** Wochen 15-18
**Abhängigkeiten:** Phase 2-3 (Agent Framework + Skills)
**Ziel:** SQL-Query-Fähigkeit für quantitative Daten, automatische Kontext-Injection, Knowledge Graph Visualisierung, DSGVO/AI-Act Compliance.

---

## 5.1 Automatische Kontext-Injection

### ContextService

```
server/src/services/context/
  ContextService.ts       ← Kontext-Verwaltung + Injection
  ContextBuilder.ts       ← Baut Kontext aus verschiedenen Quellen zusammen
  types.ts
```

**Zweck:** Bei jeder Agent-Konversation wird automatisch Unternehmenskontext injiziert, ohne dass der User prompten muss.

**Kontext-Ebenen:**
1. **Tenant-Kontext** (global): Unternehmensbeschreibung, Werte, Kommunikationsrichtlinien
2. **Abteilungs-Kontext** (department): Abteilungsspezifische Infos, Prozesse, Ansprechpartner
3. **User-Kontext** (persönlich): Rolle, kürzliche Aktivitäten, häufig genutzte Dokumente
4. **Skill-Kontext** (pro Skill): Vordefinierte Anweisungen aus Skill-Definition

**Speicherung:**
- Kontext-Definitionen in PostgreSQL (`context_definitions` Tabelle)
- Aktive Kontexte in Redis gecached (TTL: 1 Stunde)
- Admin-UI zum Bearbeiten der Kontext-Templates

**Injection:**
- `ContextBuilder.build(userId, department, skillId?)` → gibt System-Prompt-Ergänzung zurück
- Wird von `AgentExecutor` vor dem ersten LLM-Call aufgerufen
- Max-Länge konfigurierbar (Default: 2000 Token)

### Datenbank

```sql
CREATE TABLE context_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  scope TEXT NOT NULL CHECK (scope IN ('tenant', 'department', 'role')),
  scope_value TEXT,  -- z.B. Department-Name oder Role-Name
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5.2 SQL-Query Enhancement

Erweiterung des `sql_query` Tools aus Phase 2:

### Schema Discovery
- Agent kann verfügbare Tabellen und Spalten abfragen
- `DESCRIBE`-ähnliche Funktion die Tabellen-Schema zurückgibt
- Nur Tabellen/Spalten die für die User-Rolle freigeschaltet sind

### Vordefinierte Query-Templates
- Häufige Analysen als Templates: Dokumenten-Statistik, Upload-Trends, Abteilungsvergleiche
- Agent kann Template-Name als Shortcut nutzen statt rohem SQL

### Ergebnis-Formatierung
- JSON-Tabellen für Frontend-Rendering
- Optional: Chart-Daten-Format für Dashboard-Visualisierung
- Automatische Aggregation (SUM, AVG, COUNT) Vorschläge durch Agent

---

## 5.3 Knowledge Graph Visualisierung

### Backend

Neuer Endpoint `GET /api/graph/explore`:
- **Query-Params:** `entity`, `depth` (1-3), `types[]`, `documentId`
- **Response:** Nodes (Entitäten) + Edges (Beziehungen) im Graph-Format
- Nutzt bestehenden `GraphService` + Neo4j
- Permission-Filtering: Nur Entitäten aus zugänglichen Dokumenten

### Frontend

- Neue Komponente `KnowledgeGraphExplorer`
- Bibliothek: `react-force-graph-2d` (leichtgewichtig, WebGL)
- Features:
  - Interaktive Node-Auswahl → zeigt Entitäts-Details
  - Click auf Node → zeigt verknüpfte Dokumente
  - Zoom/Pan, Node-Dragging
  - Farbcodierung nach Entitäts-Typ
  - Filter nach Typ, Zeitraum, Dokument
- Eingebettet in RAG-Sidebar oder eigene Seite `/knowledge-graph`

---

## 5.4 DSGVO Compliance

### Data Retention Policies

```sql
CREATE TABLE data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  table_name TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  delete_strategy TEXT DEFAULT 'soft' CHECK (delete_strategy IN ('soft', 'hard', 'anonymize')),
  is_active BOOLEAN DEFAULT TRUE,
  last_cleanup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Automatische Bereinigung (Cron-Job):**
- Täglicher Job prüft Retention-Policies
- Löscht/anonymisiert Daten älter als `retention_days`
- Default-Policies:
  - `agent_steps`: 90 Tage
  - `channel_messages`: 180 Tage
  - `api_usage_log`: 365 Tage
  - `audit_logs`: 730 Tage (2 Jahre, gesetzliche Aufbewahrung)

### Right to Erasure (Art. 17 DSGVO)

Admin-Endpoint: `DELETE /api/admin/users/:id/data`
- Löscht alle personenbezogenen Daten eines Users:
  - Konversationen + Messages
  - Agent-Tasks + Steps
  - Channel-Messages
  - API-Usage-Logs
  - Audit-Logs werden anonymisiert (user_id → NULL, email → "gelöscht")
  - Dokumente die dem User gehören werden je nach Policy gelöscht oder Ownership transferiert
- Erstellt Löschprotokoll für Nachweis

### Data Export (Art. 20 DSGVO)

Admin-Endpoint: `GET /api/admin/users/:id/export`
- Exportiert alle Daten eines Users als JSON:
  - Profil-Daten
  - Konversationen + Messages
  - Hochgeladene Dokumente (Metadaten)
  - Agent-Tasks + Ergebnisse
  - Audit-Trail

### Consent Tracking

```sql
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  consent_type TEXT NOT NULL,  -- 'pii_processing', 'cloud_llm', 'data_retention'
  granted BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
```

- Bei erstem Login: Consent-Dialog für Cloud-LLM-Nutzung und Datenverarbeitung
- Consent kann jederzeit widerrufen werden
- Ohne Cloud-LLM-Consent: Nur lokale Modelle verfügbar

---

## 5.5 AI Act Compliance

### Transparenz

Jede Agent-Antwort enthält Metadaten:
```json
{
  "content": "...",
  "metadata": {
    "model": "anthropic:claude-sonnet-4-6",
    "provider": "anthropic",
    "tools_used": ["rag_search", "sql_query"],
    "total_steps": 3,
    "pii_masked": true,
    "confidence": 0.85,
    "generated_at": "2026-03-20T12:00:00Z"
  }
}
```

Frontend zeigt: "Generiert von Claude Sonnet 4.6 | 3 Schritte | 2 Tools genutzt"

### Human Oversight

```sql
ALTER TABLE agent_tasks ADD COLUMN risk_level TEXT DEFAULT 'low'
  CHECK (risk_level IN ('low', 'medium', 'high'));
ALTER TABLE agent_tasks ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE agent_tasks ADD COLUMN approved_by UUID REFERENCES users(id);
ALTER TABLE agent_tasks ADD COLUMN approved_at TIMESTAMPTZ;
```

- Skills können `requires_approval: true` setzen
- High-Risk Tasks (z.B. Dokument erstellen, externe Kommunikation) pausieren vor Ausführung
- Manager/Admin muss approven bevor Agent weiterarbeitet
- Approval-Workflow via Web-UI und Slack-Notification

### Risk Classification

Skills werden nach Risiko klassifiziert:
- **Low:** Nur lesende Operationen (rag_search, graph_query, read_chunk)
- **Medium:** Daten analysieren und zusammenfassen (sql_query)
- **High:** Daten erstellen oder modifizieren (create_document, send_notification)

Risk-Level wird automatisch aus den verwendeten Tools abgeleitet.

---

## Dateien-Übersicht

### Neue Dateien
| Datei | Zweck |
|-------|-------|
| `server/src/services/context/ContextService.ts` | Kontext-Verwaltung |
| `server/src/services/context/ContextBuilder.ts` | Kontext-Builder |
| `server/src/services/compliance/RetentionService.ts` | Data Retention |
| `server/src/services/compliance/DataExportService.ts` | DSGVO Export |
| `server/src/services/compliance/ConsentService.ts` | Consent Tracking |
| `server/src/routes/graph.ts` | Graph-API |
| `server/src/routes/compliance.ts` | Compliance-Endpoints |
| `server/src/migrations/013_compliance.sql` | DB-Schema |
| `src/components/KnowledgeGraphExplorer.tsx` | Graph-Visualisierung |
| `src/components/ConsentDialog.tsx` | Consent-Dialog |
| `src/pages/AdminCompliancePage.tsx` | Compliance-Dashboard |

### Neue Dependencies
- `react-force-graph-2d` (Frontend)
- `node-cron` (Backend, für Retention Jobs)

---

## Verifikation

1. **Kontext-Injection:** Agent-Antwort enthält Unternehmens-Kontext ohne expliziten Prompt
2. **SQL-Query:** Agent kann "Wie viele Dokumente pro Abteilung?" beantworten
3. **Graph-Viz:** Knowledge Graph wird interaktiv dargestellt
4. **Data Retention:** Alte Daten werden nach Policy-Ablauf gelöscht
5. **Right to Erasure:** User-Daten vollständig löschbar
6. **Data Export:** Kompletter JSON-Export eines Users
7. **Consent:** Ohne Consent nur lokale Modelle verfügbar
8. **Transparenz:** Agent-Antworten zeigen Model + Tools Metadata
9. **Approval:** High-Risk Task pausiert bis Manager approvet
