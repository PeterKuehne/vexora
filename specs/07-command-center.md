# Spec: Command Center

**Status:** Entwurf
**Abhaengigkeiten:** [02-hive-mind-orchestrator.md](./02-hive-mind-orchestrator.md), [04-memory-system.md](./04-memory-system.md), [05-heartbeat-engine.md](./05-heartbeat-engine.md)
**Bezug:** [00-cor7ex-vision.md](./00-cor7ex-vision.md) — Abschnitt "Heartbeat UI"
**Domain-Wissen:** [docs/wissen_personaldienstleister_pflege.md](../docs/wissen_personaldienstleister_pflege.md)

---

## Zusammenfassung

Das Command Center ist die **intelligente Startseite** von Cor7ex — der erste Bildschirm wenn ein Mitarbeiter morgens die Anwendung oeffnet. Statt eines statischen Dashboards mit KPI-Kacheln zeigt es **Handlungsbedarf** — personalisiert nach Rolle, angereichert mit Heartbeat-Ergebnissen und Memory.

**Kernprinzip:** Zeige nicht Zahlen, zeige was zu tun ist. Der Hive Mind denkt mit — wie ein aufmerksamer Kollege der morgens sagt "3 Dinge die du wissen solltest".

**Kein Dashboard. Ein Command Center.**

| Dashboard | Command Center |
|-----------|---------------|
| Zeigt Zahlen | Zeigt **Handlungsbedarf** |
| Passiv (lesen) | Aktiv (klicken, zuweisen, genehmigen) |
| Gleich fuer alle | **Rollenbasiert** personalisiert |
| Aktualisiert sich periodisch | **Proaktiv** (Heartbeat + Memory) |
| Statische Widgets | **Adaptiv** (lernt was du brauchst) |

---

## Warum kein Dashboard?

### Der Disponent morgens

Der Disponent ist die **zentrale Drehscheibe** des Personaldienstleisters. Er betreut 40-80 Pflegekraefte, jongliert mehrere Kunden gleichzeitig und muss taeglich Fristen, Zeiterfassungen und Einsaetze im Blick behalten.

Er braucht **nicht**:
- Balkendiagramme ueber Umsatz
- Kreisdiagramme ueber Auslastung
- 12 KPI-Kacheln die er anstarrt

Er braucht:
- "ASG-004 endet in 26 Tagen. Verlaengerung mit Klinikum Bielefeld klaeren."
- "3 Zeiterfassungen warten auf deine Genehmigung."
- "Alexander Esau erreicht in 2 Monaten die Equal-Pay-Grenze bei Test Traeger."
- [Genehmigen] [Verlaengern] [Details]

### Der Geschaeftsfuehrer

Der GF braucht nicht dieselbe Ansicht. Er braucht:
- Finanz-Ueberblick (offene Rechnungen, Faelligkeiten)
- Compliance-Status (AUeG-Risiken, Equal Pay)
- Einsatz-Ueberblick (wie viele aktiv, abgelaufene Status-Probleme)

**Gleicher Hive Mind, gleiche Datenbasis — aber die Perspektive, die Sprache, die Prioritaeten sind pro Rolle anders.** (Vision-Spec, Abschnitt "Der User")

---

## Design

### Struktur: Briefing + Action Cards + Chat

Das Command Center besteht aus drei vertikalen Bereichen:

```
┌──────────────────────────────────────────────────────────────┐
│  COMMAND CENTER                                    06:12 Uhr │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  BRIEFING (LLM-generiert, personalisiert)             │  │
│  │                                                        │  │
│  │  Guten Morgen Lisa. Hier dein Ueberblick:             │  │
│  │  3 Zeiterfassungen warten auf deine Genehmigung.      │  │
│  │  ASG-004 endet in 26 Tagen — Verlaengerung klaeren.  │  │
│  │  Alexander Esau naehert sich der Equal-Pay-Grenze     │  │
│  │  bei Test Traeger. 2 Rechnungen offen (1.812 EUR).    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ ⏱️ ZEITERFASSUNG  │  │ 💰 FINANZEN      │                 │
│  │                  │  │                  │                 │
│  │ 3 warten auf     │  │ 2 Rechnungen     │                 │
│  │ Genehmigung      │  │ offen            │                 │
│  │                  │  │ 1.812 EUR        │                 │
│  │ Sarah Mueller    │  │                  │                 │
│  │ Thomas Schmidt   │  │ Faellig:         │                 │
│  │ Julia Becker     │  │ 09.04 (459 EUR)  │                 │
│  │ [Alle genehmigen]│  │ 13.04 (1.353 EUR)│                 │
│  │ [Pruefen]        │  │ [Mahnung senden] │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ 📋 COMPLIANCE     │  │ 👥 EINSAETZE     │                 │
│  │                  │  │                  │                 │
│  │ ✅ 18-Mon: OK    │  │ 14 aktiv         │                 │
│  │ ⚠️ Equal Pay:    │  │ 4 Mitarbeiter    │                 │
│  │   EI-2026-285    │  │                  │                 │
│  │   (9 Mon. err.)  │  │ 3 enden bald:    │                 │
│  │ ✅ Drehtuer: OK  │  │ ASG-004 (26 T.)  │                 │
│  │                  │  │ ASG-001 (abgel.) │                 │
│  │ [Details]        │  │ [Alle anzeigen]  │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [Aufgabe eingeben... oder Frage stellen]              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Die drei Bereiche

#### 1. Briefing (oben)

Ein LLM-generierter Text der alle Heartbeat-Ergebnisse zu einem natuerlichen Morgen-Briefing zusammenfasst. Personalisiert durch User Memory.

- Wird beim Oeffnen generiert (1 LLM-Call)
- Nutzt Heartbeat-Ergebnisse + User Memory
- Kritische Punkte zuerst
- Erkennt Zusammenhaenge ("Klinikum X: offene Rechnungen UND Einsatz endet bald")
- Maximal 3-5 Saetze

#### 2. Action Cards (Mitte)

Kacheln die Heartbeat-Ergebnisse als **handlungsorientierte Cards** darstellen. Nicht nur Zahlen — sondern mit Kontext und Aktionen.

**Unterschied zu einem Dashboard-Widget:**

| Dashboard Widget | Action Card |
|-----------------|-------------|
| "3 Einsaetze nahe 18-Mon-Grenze" | "ASG-004 endet in 26 Tagen bei Klinikum Bielefeld. Sarah Mueller. **[Verlaengern] [Abschliessen] [Details]**" |
| "2 offene Rechnungen" | "1.812 EUR offen. 459 EUR faellig am 09.04 (Muehlenkreis Kliniken). **[Mahnung senden] [Details]**" |

Jede Card hat:
- **Icon + Titel** (Kategorie)
- **Kernaussage** (1-2 Zeilen, die wichtigste Info)
- **Details** (aufklappbar oder als Tooltip)
- **Quick Actions** (1-2 Buttons fuer sofortige Aktionen)
- **Priority-Indikator** (Farbe: rot/gelb/gruen)

#### 3. Chat-Eingabe (unten)

Die Chat-Eingabe bleibt immer sichtbar — der User kann direkt eine Frage stellen oder eine Aufgabe eingeben. Das Command Center ist der Startpunkt, der Chat ist immer erreichbar.

Klick auf eine Action Card oeffnet den Chat mit Kontext:
- Klick auf "Details" bei Compliance → Chat: "Zeige mir Details zur AUeG-Compliance"
- Klick auf "Zuweisen" → Chat: "Weise Thomas Schmidt der Fruehschicht bei Klinikum X zu"

---

## Rollenbasierte Ansichten

### Disponent / Manager

**Prioritaet:** Operative Handlungsfaehigkeit

| Card | Datenquelle (MCP Tool) | Quick Actions |
|------|------------------------|---------------|
| Zeiterfassungen genehmigen | `sama_pendingApprovals` | Alle genehmigen, Pruefen |
| AUeG-Compliance (18 Mon.) | `sama_assignmentsNearLimit` | Details, Rotation planen |
| Equal-Pay-Grenze (9 Mon.) | `sama_employeesNearEqualPay` | Details, Verguetung pruefen |
| Einsaetze die bald enden | `sama_activeAssignments` (Ende < 30 Tage) | Verlaengern, Abschliessen |
| Abgelaufene Einsaetze (ACTIVE) | `sama_activeAssignments` (Ende < heute) | Status korrigieren |
| Zertifizierungen ablaufend | `sama_certificationsExpiringSoon` | Mitarbeiter informieren |
| AUeV-Vertraege | `sama_staffingContracts` (Status pruefen) | Verlaengern, Kuendigen |

### Geschaeftsfuehrung (Admin)

**Prioritaet:** Strategischer Ueberblick + Finanzen

| Card | Datenquelle (MCP Tool) | Quick Actions |
|------|------------------------|---------------|
| Offene Rechnungen | `sama_accountMoves` (paymentState: NOT_PAID) | Mahnung senden, Details |
| Faelligkeitsbericht | `sama_agedReceivable` | Bericht anzeigen |
| Compliance-Status | `sama_assignmentsNearLimit` + `sama_employeesNearEqualPay` | Details |
| Aktive Einsaetze | `sama_activeAssignments` | Alle anzeigen |
| Abgelaufene Zertifizierungen | `sama_expiredCertifications` | Mitarbeiter kontaktieren |

### Alle Rollen

| Card | Datenquelle |
|------|------------|
| Persoenliches Briefing | LLM + Memory + Heartbeat |
| Letzte Aktivitaeten | Aus Agent-Tasks (letzte Konversationen) |

---

## Datenfluss

### Beim Oeffnen von Cor7ex

```
User oeffnet Cor7ex
    │
    ▼
Frontend: GET /api/command-center/home
    │
    ▼
Backend:
  1. Ungelesene Heartbeat-Ergebnisse laden (Rolle + User gefiltert)
  2. Quick Stats laden (parallele MCP-Calls oder cached)
  3. Letzte Aktivitaeten laden (agent_tasks, letzte 5)
  4. Wenn Heartbeat-Ergebnisse vorhanden:
     → Briefing generieren (1 LLM-Call mit Memory)
  5. Action Cards aus Heartbeat-Ergebnissen bauen
  6. Heartbeat-Ergebnisse als "delivered" markieren
    │
    ▼
Frontend rendert:
  - Briefing-Text oben
  - Action Cards als Grid
  - Chat-Eingabe unten
```

### API

```
GET /api/command-center/home
→ {
    briefing: {
      text: "Guten Morgen Lisa...",
      generatedAt: "2026-04-05T06:12:00Z"
    },
    cards: [
      {
        id: "card-1",
        type: "action",
        category: "compliance",
        icon: "⚠️",
        title: "AUeG-Compliance",
        summary: "EI-2026-285: Equal-Pay-Grenze erreicht",
        priority: "warning",
        details: { ... },
        actions: [
          { label: "Details", action: "chat", prompt: "Zeige mir Details zur Equal-Pay-Situation" },
          { label: "Rotation planen", action: "chat", prompt: "Plane eine Rotation fuer EI-2026-285" }
        ]
      },
      ...
    ],
    stats: {
      activeAssignments: 14,
      activeEmployees: 4,
      openInvoices: 2,
      openInvoicesAmount: 1812.13
    },
    recentTasks: [
      { id: "...", query: "Zeige mir alle aktiven Einsaetze", createdAt: "..." },
      ...
    ]
  }
```

---

## Action Cards im Detail

### Card-Typen

#### 1. Alert Card (Handlungsbedarf)

```
┌──────────────────────────────────────┐
│ ⚠️ EINSATZ ENDET BALD       warning  │
│                                      │
│ ASG-004 — Sarah Mueller              │
│ Universitaets-Klinikum Bielefeld     │
│ Endet am 30.04.2026 (in 26 Tagen)   │
│                                      │
│ [Verlaengern]  [Abschliessen]        │
│ [Details]                            │
└──────────────────────────────────────┘
```

#### 2. Status Card (Information)

```
┌──────────────────────────────────────┐
│ 👥 EINSAETZE                   info  │
│                                      │
│ 14 aktive Einsaetze                  │
│ 4 Mitarbeiter im Einsatz            │
│                                      │
│ Enden bald:                          │
│ • ASG-004 in 26 Tagen               │
│ • ASG-001 abgelaufen (!)            │
│                                      │
│ [Alle anzeigen]                      │
└──────────────────────────────────────┘
```

#### 3. Finance Card (Finanzen)

```
┌──────────────────────────────────────┐
│ 💰 OFFENE RECHNUNGEN        warning  │
│                                      │
│ 2 Rechnungen — 1.812,13 EUR         │
│                                      │
│ RE-2026-000001  459,24 EUR           │
│   Muehlenkreis  faellig 09.04       │
│ RE-2026-000005  1.352,89 EUR         │
│   Muehlenkreis  faellig 13.04       │
│                                      │
│ [Mahnung senden]  [Details]          │
└──────────────────────────────────────┘
```

#### 4. Compliance Card (AUeG)

```
┌──────────────────────────────────────┐
│ 📋 COMPLIANCE                  info  │
│                                      │
│ ✅ Hoechstueberlassung (18 Mon): OK │
│ ⚠️ Equal Pay: EI-2026-285 (9 Mon.) │
│ ✅ Drehtuerklausel: OK              │
│ ❌ 3 Einsaetze abgelaufen aber      │
│    noch ACTIVE                       │
│                                      │
│ [Compliance-Bericht]                 │
└──────────────────────────────────────┘
```

---

## Quick Actions

Quick Actions auf Cards loesen Chat-Konversationen aus — der Hive Mind fuehrt die Aktion durch.

| Action | Was passiert |
|--------|-------------|
| [Verlaengern] | Chat: "Verlaengere den Einsatz ASG-004 um 3 Monate" → hr-expert |
| [Abschliessen] | Chat: "Schliesse den Einsatz ASG-001 ab und setze den Status auf COMPLETED" → hr-expert |
| [Alle genehmigen] | Chat: "Genehmige alle ausstehenden Zeiterfassungen" → hr-expert |
| [Mahnung senden] | Chat: "Erstelle eine Zahlungserinnerung fuer Rechnung RE-2026-000001" → accounting-expert |
| [Details] | Chat: "Zeige mir Details zu [Thema]" → passender Expert Agent |
| [Compliance-Bericht] | Chat: "Erstelle einen vollstaendigen AUeG-Compliance-Bericht" → hr-expert |
| [Verguetung pruefen] | Chat: "Pruefe die Equal-Pay-Situation fuer Alexander Esau bei Test Traeger" → hr-expert |
| [Mitarbeiter informieren] | Chat: "Informiere [Name] dass Zertifizierung [X] bald ablaeuft" → send_notification |

**Prinzip:** Das Command Center ist der Startpunkt. Die Ausfuehrung passiert im Chat ueber den Hive Mind.

---

## Navigation

Das Command Center ersetzt den **leeren Chat-Zustand** als Home-Ansicht. Kein neuer Nav-Punkt — es IST die Startseite.

```
IconRail:
  [Bot]      ← Chat + Command Center (Home)
  [Skills]
  [Docs]
  [Agents]
  [Heartbeat]
  [Wissen]

Wenn kein Task aktiv → Command Center anzeigen
Wenn Task aktiv → Chat-Konversation anzeigen
```

Der User wechselt zwischen Command Center und Chat durch:
- **Klick auf "+ Neu"** → Command Center (kein Task selektiert)
- **Klick auf einen Task** → Chat-Konversation
- **Quick Action auf Card** → Neuer Chat mit vorgefuellter Frage

---

## Implementierung

### Phase 1: Backend API + Basis-UI

1. **API Endpoint** `GET /api/command-center/home` — Briefing + Cards + Stats
2. **CardBuilder Service** — Heartbeat-Ergebnisse → Action Cards transformieren
3. **Command Center Komponente** — Ersetzt leeren Chat-Zustand
4. **Briefing** (existiert bereits in Heartbeat Engine) — hier integrieren

### Phase 2: Action Cards + Quick Actions

1. **Card-Komponenten** — Alert, Status, Finance, Compliance Cards
2. **Quick Action → Chat** — Klick auf Button startet Chat mit Prompt
3. **Rollenbasierte Filterung** — Nur relevante Cards pro Rolle

### Phase 3: Personalisierung + Memory

1. **Memory-basierte Card-Priorisierung** — "Lisa fragt immer nach Klinikum X" → Klinikum X Card weiter oben
2. **Adaptive Cards** — Neue Card-Typen basierend auf haeufigen Fragen
3. **Card-Praeferenzen** — User kann Cards ausblenden/pinnen

---

## Dateien

### Neue Dateien:
1. `server/src/services/command-center/CommandCenterService.ts` — Home-Daten aggregieren
2. `server/src/services/command-center/CardBuilder.ts` — Heartbeat → Action Cards
3. `server/src/routes/command-center.ts` — API Endpoint
4. `src/components/CommandCenter.tsx` — Haupt-Komponente
5. `src/components/ActionCard.tsx` — Card-Komponente (Alert, Status, Finance, Compliance)

### Modifizierte Dateien:
1. `src/components/AgentTaskDetail.tsx` — Command Center statt leerer Zustand
2. `server/src/index.ts` — Route registrieren

---

## Verifikation

| Test | Erwartung |
|------|-----------|
| Cor7ex oeffnen (kein Task) | Command Center mit Briefing + Cards |
| Disponent sieht | Schicht-Cards, Compliance, Zeiterfassungen |
| GF sieht | Finanzen, Umsatz, Compliance |
| Quick Action klicken | Chat oeffnet sich mit vorgefuellter Frage |
| Heartbeat laeuft | Neue Cards erscheinen beim naechsten Oeffnen |
| Memory lernt | Cards werden nach Nutzung priorisiert |
| Kein Heartbeat-Ergebnis | "Alles im gruenen Bereich" Briefing |

---

## Generik: Branchenunabhaengig

Das Command Center ist **nicht personaldienstleister-spezifisch**. Alles was angezeigt wird kommt aus konfigurierbaren Quellen:

| Komponente | Woher kommen die Daten? | Branchenabhaengig? |
|------------|------------------------|-------------------|
| Briefing-Text | LLM + Heartbeat-Ergebnisse | Nein — Text wird generiert |
| Action Cards | Heartbeat-Definitionen (pro Tenant) | Nein — Card-Typ ist generisch |
| Quick Actions | Heartbeat-Config → Expert Agent Prompt | Nein — Prompt ist konfigurierbar |
| Rollen-Filter | UserRole (Admin/Manager/Employee) | Nein — universelle Rollen |
| Card-Icons/Prioritaet | Heartbeat-Definition (icon, priority) | Nein — frei konfigurierbar |

**Beispiel: Autohaus**

Ein Autohaus-Tenant haette andere Heartbeats und Expert Agents:

| Heartbeat | Tool | Card |
|-----------|------|------|
| Fahrzeuge > 90 Tage auf Hof | `erp_vehicleStandtime` | ⚠️ "3 Fahrzeuge stehen seit > 90 Tagen. [Preis senken] [Details]" |
| Leasing laeuft aus | `erp_leasingContracts` | 📋 "5 Leasingvertraege enden in 30 Tagen. [Kunden kontaktieren]" |
| Werkstatt-Auslastung | `erp_workshopCapacity` | 👥 "Werkstatt naechste Woche zu 95% ausgelastet. [Termine verschieben]" |

**Gleiche UI, gleiche Card-Typen, gleicher Code — andere Heartbeats und Expert Agents.**

---

## Offene Punkte

- **Push Notifications** — Spaeter: Browser-Push wenn kritische Heartbeats eintreffen
- **Card-Konfiguration durch Admin** — Welche Card-Typen welche Rolle sieht
- **Echtzeit-Updates** — Socket.io fuer Live-Aktualisierung der Cards
- **Mobile-Optimierung** — Command Center auf Handy (Disponent unterwegs)
- **Widgets** — Spaeter: Benutzerdefinierte Widgets die der User selbst zusammenstellt
