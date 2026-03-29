---
name: Cor7ex Vision - EU Cowork Clone
description: Cor7ex is building a EU-compliant Claude Cowork alternative — enterprise agent platform with Skills, Connectors, RAG knowledge base, and Hive Mind collaboration
type: project
---

Cor7ex baut eine **EU-konforme Alternative zu Claude Cowork** auf. Unternehmensdaten dürfen nicht an US-Server (Anthropic) gesendet werden (DSGVO/Schrems II).

**Why:** Deutsche Unternehmen können Claude Cowork nicht für interne Daten nutzen. Cor7ex löst das mit EU-Hosting (Hetzner) und lokalen/EU-Cloud-Modellen.

**How to apply:** Bei Architekturentscheidungen immer Claude Cowork als Referenz-Implementierung analysieren. Features und Patterns von Anthropic übernehmen, aber für EU-Compliance und lokale Modelle adaptieren. Der Hive Mind-Gedanke (Wissen teilen, Skills teilen, Team-Kollaboration) ist zentral.

**Kernfeatures (Cowork-Parität):**
- Agent-Chat mit Tool-Use (RAG, APIs, Connectors)
- Skills: erstellen, teilen, teamweit nutzen (Skill Creator)
- Wissensdatenbank (RAG) als Unternehmenskontext
- Connectors für externe APIs/Enterprise-Software
- Hive Mind: Team-Kollaboration, geteiltes Wissen

**Aktuelle Herausforderung (2026-03-28):** Lokale Modelle (Ollama/Qwen) unterstützen kein `toolChoice` — Agent entscheidet selbst ob Tools genutzt werden, was zu Halluzination statt RAG-Nutzung führt. Architektur muss modellunabhängig funktionieren.
