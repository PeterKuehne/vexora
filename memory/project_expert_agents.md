---
name: Expert Agent Architecture Vision
description: Strategische Richtung - weg von Single General Agent hin zu konfigurierbaren Expert Agents mit eigenem Harness (Skills, Memory, Guardrails). Multi-Tenant-faehig fuer verschiedene Kunden.
type: project
---

## Vision: Expert Agent System (statt Single General Agent)

**Why:** Ein einzelner Agent mit 77+ Tools skaliert nicht — er muss raten welches Tool passt, hat keinen Domain-Kontext, und ist nicht pro Kunde anpassbar. Fuer ein Multi-Tenant-Produkt brauchen wir konfigurierbare Expert Agents.

**How to apply:** Bei zukuenftigen Agent-Architektur-Entscheidungen immer in Richtung Expert Agents denken. Keine hardcoded Agents — alles ueber ein Harness-Framework konfigurierbar.

### Konzept

Statt 1 General Agent + N Tools → M Expert Agents mit eigenem Harness:

| Expert Agent | Domain | Tools/Skills |
|---|---|---|
| Wissens-Agent | Firmenwissen, Dokumente | RAG, Document Search, Fachfragen |
| Buchhaltungs-Agent | Zahlen, Statistiken | Accounting-Tools, Reporting, Analyse |
| HR/Disposition-Agent | Mitarbeiter, Einsaetze | Employee, Assignment, AUeG-Compliance |
| Kreativ-Agent | Content-Erstellung | Skills (One Pager, Branding, Templates) |

### Agent Harness (pro Agent konfigurierbar)
- **Skills**: Domain-spezifische Faehigkeiten
- **Guardrails**: Was darf der Agent, was nicht
- **Memory**: Domain-spezifisches Wissen + Kontext
- **Tools**: Nur die Tools die der Agent braucht
- **System Prompt**: Domain-Expertise als Persona

### Kernanforderung: Multi-Tenant
- Agents duerfen NICHT vorgefertigt/hardcoded sein
- Jeder Kunde (Unternehmen) konfiguriert seine eigenen Expert Agents
- Agent-Harness als Framework, nicht als fertige Loesung

### Inspirationen & Learnings

**OpenClaw** (342k Stars, MIT):
- SOUL.md Pattern: Identitaet (Werte, Ton, Grenzen) getrennt von Faehigkeiten
- Heartbeat: Proaktive Checks alle 30 Min (nicht nur reaktiv)
- Gateway: Unified Control-Plane fuer alle Channels
- Memory: MEMORY.md (Langzeit) + SOUL.md (Identitaet) + Daily Logs

**Paperclip** (40k Stars, MIT):
- Multi-Agent Orchestrierung mit Org-Chart Modell
- Ticket-basierte Task-Vergabe (atomar, kein Duplicate Work)
- Ziel-Hierarchie: Mission → Goal → Task (jeder Task weiss WARUM)
- Budget-Kontrolle + Approval Gates pro Agent

**Kombination fuer Cor7ex:**
- OpenClaw = Execution Plane (Agent Runtime)
- Paperclip = Control Plane (Multi-Agent Koordination)
- Cor7ex = Beides + Enterprise-Kontext + Hive Mind

### Hyperpersonalisierung im Enterprise-Kontext
- Nicht nur reaktiv sondern **proaktiv** (Heartbeat-Pattern)
- Rolle-basiert: Dispatcher sieht andere Briefings als Buchhalter
- Unternehmenskontext: "Welche AUeV laufen aus?" statt "Welche News gibt es?"
- Agent entwickelt Verstaendnis fuer den User ueber Zeit (SOUL.md Pattern)

### Hive Mind bleibt das Fundament
- Expert Agents sind Auspraegungen des Hive Mind
- Das zentrale Nervensystem verbindet alles
- Proaktiv + reaktiv, nicht nur Chatbot

### Datum
2026-03-30 — User hat diese Richtung klar kommuniziert
