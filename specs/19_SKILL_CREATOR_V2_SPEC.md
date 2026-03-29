# Spec: Skill Creator V2 — A/B Testing + Auto-Iteration

**Status:** Geplant
**Bezug:** [13_SKILLS_SPEC.md](./13_SKILLS_SPEC.md), [18_HYBRID_AGENT_ARCHITECTURE_SPEC.md](./18_HYBRID_AGENT_ARCHITECTURE_SPEC.md)
**Referenz:** Anthropic Skill Creator (Claude Code Bundled Skill)

---

## Zusammenfassung

Der Skill Creator wird von einem einfachen "erstelle und teste einzeln" Workflow zu einem vollstaendigen A/B-Testing-Framework mit automatischer Iteration aufgewertet. Kernfeature: Das neue `compare_skill` Tool fuehrt fuer jeden Test-Prompt **parallel** zwei Subagents aus (mit Skill vs. ohne Skill) und liefert einen strukturierten Vergleich inline im Chat.

---

## 1. Ist-Zustand vs. Soll-Zustand

| Aspekt | Heute | Neu (V2) |
|--------|-------|----------|
| **Testing** | `run_skill_test` einzeln (mit ODER ohne Skill) | `compare_skill` parallel (mit UND ohne gleichzeitig) |
| **Vergleich** | Agent muss manuell vergleichen | Strukturierte Vergleichstabelle automatisch |
| **Iteration** | Manuell: User muss jeden Fix anstoßen | Auto-Fix bei offensichtlichen Problemen |
| **Feedback** | Unstrukturiert im Chat | Strukturiert pro Test-Case |
| **Parallelitaet** | Sequentiell | `Promise.all` fuer beide Varianten |

---

## 2. `compare_skill` Tool

Ersetzt `run_skill_test`. Fuehrt automatisch beide Varianten parallel aus.

### Input

```typescript
{
  prompt: string;      // Realistischer Test-Prompt
  skill_slug: string;  // Slug des zu testenden Skills
  max_steps?: number;  // Default: 8
}
```

### Execution Flow

```
compare_skill(prompt, skill_slug)
  │
  ├─ Promise.all([
  │    Subagent A: ToolLoopAgent MIT Skill-Instruktionen
  │    Subagent B: ToolLoopAgent OHNE Skill (Baseline)
  │  ])
  │
  ├─ Ergebnisse sammeln:
  │    - text (Antwort)
  │    - steps (Anzahl Tool-Calls)
  │    - tokens (Input + Output)
  │    - duration (ms)
  │    - toolsUsed (welche Tools)
  │
  └─ Strukturierten Vergleich als Markdown zurueckgeben
```

### Output (Markdown)

```markdown
## A/B Vergleich: "{skill_name}"

**Test-Prompt:** "{prompt}"

| Metrik | MIT Skill | Baseline | Delta |
|--------|-----------|----------|-------|
| Steps | 5 | 3 | +2 |
| Dauer | 12.3s | 8.1s | +4.2s |
| Tokens | 2.4K | 1.8K | +0.6K |
| Tools | rag_search x3, read_chunk x2 | rag_search x2 | |

### Antwort MIT Skill:
[formatierter Output...]

### Antwort OHNE Skill (Baseline):
[unformatierter Output...]

### Auto-Bewertung:
- [Skill besser/schlechter/gleich]
- [Konkrete Unterschiede]
- [Empfehlung]
```

---

## 3. Skill Creator SKILL.md — Neuer Workflow

### Phase 1: Intent erfassen
- Was soll der Skill koennen?
- Wann soll er triggern?
- Welches Ausgabeformat?
- Brauchen wir Tests? (Objektiv messbar → ja; Subjektiv → optional)

### Phase 2: Interview & Recherche
- Edge Cases, Formate, Abhaengigkeiten klaeren
- Verfuegbare Tools pruefen
- Nicht schreiben bis alles klar ist

### Phase 3: Skill schreiben + erstellen
- SKILL.md Entwurf schreiben
- Mit frischen Augen lesen und verbessern
- `create_skill` aufrufen

### Phase 4: A/B Testing
1. **Test-Prompts definieren** mit dem User (2-3 realistische)
2. **Fuer jeden Prompt:** `compare_skill(prompt, skill_slug)` aufrufen
3. **Vergleichstabelle** wird automatisch im Chat angezeigt
4. **User-Feedback** pro Test-Case einsammeln

### Phase 5: Auto-Iteration + User-Feedback

**Auto-Fix Regeln** (Agent entscheidet selbst):
| Problem | Auto-Fix |
|---------|----------|
| Baseline besser als Skill | Analysiere Vergleich, finde Ursache, fixe |
| Skill nutzt keine Tools | "Nutze rag_search" in Instruktionen |
| Leere Antwort | maxSteps erhoehen, Instruktionen klaerer |
| Keine Quellen zitiert | Quellen-Instruktion hinzufuegen |
| Zu viele Tokens | Instruktionen straffen |

**User-Feedback noetig bei:**
- Inhaltliche Qualitaet
- Format-Praeferenzen
- Fehlende Aspekte
- Subjektive Bewertung

**Iterations-Loop:**
1. `update_skill` mit Verbesserung
2. `compare_skill` erneut (gleiche Prompts)
3. Vergleich zeigen (vorher vs. nachher)
4. Auto-Fix oder User-Feedback
5. Wiederholen bis zufrieden

### Phase 6: Beschreibungs-Optimierung
1. 10 Test-Queries generieren (5 should-trigger, 5 should-not)
2. Mit User reviewen
3. Beschreibung optimieren

---

## 4. Auto-Bewertungs-Logik

Der Agent bewertet nach jedem `compare_skill` automatisch:

```
Bewertungskriterien:
1. Hat der Skill die Antwort VERBESSERT? (ja/nein/gleich)
2. Nutzt der Skill die empfohlenen Tools?
3. Ist die Ausgabe strukturiert wie in den Instruktionen?
4. Sind Quellen zitiert (wenn relevant)?
5. Sind die Kosten (Tokens/Dauer) akzeptabel? (<50% Overhead)

Wenn >= 2 Kriterien NICHT erfuellt:
→ Auto-Fix: Analysiere Problem, update_skill, re-test

Wenn alle Kriterien erfuellt aber User-Feedback ausstehend:
→ Zeige Ergebnis, frage User
```

---

## 5. Dateien

### Modifiziert (3):
1. `server/src/services/agents/tools/run-skill-test.ts` — Komplett neu als `compare_skill`
2. `server/src/services/agents/tools/index.ts` — Tool-Registrierung
3. `server/skills/skill-creator/SKILL.md` — Komplett neu mit A/B Workflow

### Unveraendert:
- `create_skill.ts`, `update_skill.ts` — bleiben
- `SkillLoader.ts`, `SkillRegistry.ts` — keine Aenderungen
- `agent.ts`, `SubagentLoader.ts` — Subagent-Infrastruktur bleibt
- Frontend — Ergebnisse inline im Chat (Markdown)

---

## 6. Erfolgs-Kriterien

| Metrik | Ziel |
|--------|------|
| A/B Test Durchfuehrung | Ein Tool-Call → beide Varianten parallel |
| Vergleichs-Ausgabe | Strukturierte Tabelle mit Delta-Werten |
| Auto-Fix Rate | >= 50% der offensichtlichen Probleme automatisch geloest |
| Iterations-Geschwindigkeit | Fix + Re-Test in < 60s |
| User-Zufriedenheit | Skill nach 2-3 Iterationen nutzbar |
