# Rahmenvertrag über IT-Dienstleistungen

**Vertragsnummer:** RV-2026-0471
**Datum:** 15. Januar 2026

---

## Vertragsparteien

**Auftraggeber:**
Samaritano GmbH
Musterstraße 12
70173 Stuttgart
Vertreten durch: Peter Keller, Geschäftsführer
USt-IdNr.: DE123456789

**Auftragnehmer:**
Müller IT-Solutions GmbH
Industrieweg 8
73728 Esslingen am Neckar
Vertreten durch: Dr. Thomas Müller, Geschäftsführer
USt-IdNr.: DE987654321

---

## § 1 Vertragsgegenstand

(1) Gegenstand dieses Rahmenvertrags ist die Erbringung von IT-Dienstleistungen durch den Auftragnehmer für den Auftraggeber, insbesondere:
- Wartung und Betrieb der Serverinfrastruktur (Hetzner Cloud, lokale Server)
- Datenbankadministration (PostgreSQL, Weaviate, Neo4j, Redis)
- Monitoring und Incident-Response (SLA-basiert)
- Beratung bei Architekturentscheidungen
- Schulungen für interne Mitarbeiter (max. 4 pro Jahr)

(2) Einzelne Leistungen werden über Einzelaufträge (Abrufscheine) beauftragt, die auf Basis dieses Rahmenvertrags erteilt werden.

(3) Der Auftragnehmer ist nicht exklusiv gebunden und darf Leistungen für Dritte erbringen, sofern keine Interessenkonflikte bestehen.

## § 2 Vertragslaufzeit und Kündigung

(1) Der Vertrag beginnt am **01. Februar 2026** und läuft auf unbestimmte Zeit.

(2) Der Vertrag kann von beiden Seiten mit einer Frist von **3 Monaten zum Quartalsende** ordentlich gekündigt werden.

(3) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor, wenn:
- eine Vertragspartei wesentliche Vertragspflichten trotz schriftlicher Abmahnung wiederholt verletzt
- über das Vermögen einer Vertragspartei ein Insolvenzverfahren eröffnet oder die Eröffnung mangels Masse abgelehnt wird
- eine Vertragspartei gegen die Vertraulichkeitsvereinbarung (§ 9) verstößt

(4) Kündigungen bedürfen der Schriftform. E-Mail genügt nicht.

(5) Bei Kündigung ist der Auftragnehmer verpflichtet, innerhalb von 30 Tagen eine vollständige Übergabedokumentation zu erstellen und alle Zugangsdaten zu übermitteln.

## § 3 Vergütung

(1) Die Vergütung erfolgt auf Basis der folgenden Stundensätze (netto):

| Leistungskategorie | Stundensatz |
|---|---|
| Senior Consultant | 145,00 € |
| Consultant | 115,00 € |
| Junior Consultant | 85,00 € |
| Schulung (pro Teilnehmer/Tag) | 450,00 € |

(2) Reisekosten werden nach tatsächlichem Aufwand erstattet. Bahnfahrten 2. Klasse, Pkw-Nutzung 0,30 €/km. Flugreisen bedürfen der vorherigen Genehmigung.

(3) Eine jährliche Anpassung der Stundensätze ist frühestens nach 12 Monaten Vertragslaufzeit möglich. Die Anpassung darf den Verbraucherpreisindex (VPI) des Statistischen Bundesamts nicht übersteigen und muss mit einer Frist von 3 Monaten angekündigt werden.

(4) Die Abrechnung erfolgt monatlich auf Basis der geleisteten und vom Auftraggeber freigegebenen Stunden. Rechnungen sind innerhalb von **30 Tagen netto** fällig.

(5) Das geschätzte Jahresvolumen beträgt **120.000 – 180.000 € netto**. Hieraus ergibt sich keine Abnahmeverpflichtung.

## § 4 Leistungserbringung

(1) Die Leistungserbringung erfolgt wahlweise remote oder vor Ort beim Auftraggeber. Der Auftraggeber stellt bei Vor-Ort-Einsätzen einen Arbeitsplatz und die erforderliche Infrastruktur bereit.

(2) Einzelaufträge werden mit einer Vorlaufzeit von mindestens **5 Werktagen** erteilt. Bei dringendem Bedarf (Severity 1 oder 2 gemäß § 5) kann der Auftragnehmer auch kurzfristiger angefragt werden; eine Pflicht zur sofortigen Verfügbarkeit besteht jedoch nicht.

(3) Der Auftragnehmer setzt qualifiziertes Personal ein. Schlüsselpersonen werden im Einzelauftrag benannt. Ein Austausch von Schlüsselpersonen ist nur mit Zustimmung des Auftraggebers zulässig.

(4) Der Auftragnehmer ist berechtigt, Subunternehmer einzusetzen, sofern:
- der Auftraggeber vorher schriftlich zugestimmt hat
- der Subunternehmer die Vertraulichkeitsanforderungen (§ 9) einhält
- der Auftragnehmer für die Leistung des Subunternehmers wie für eigene Leistung haftet

## § 5 Service Level Agreement (SLA)

(1) Für Incident-Response gelten folgende Reaktionszeiten:

| Severity | Beschreibung | Reaktionszeit | Lösungszeit |
|---|---|---|---|
| 1 — Kritisch | Produktionsausfall, kein Workaround | 1 Stunde | 4 Stunden |
| 2 — Hoch | Wesentliche Einschränkung, Workaround möglich | 4 Stunden | 8 Stunden |
| 3 — Mittel | Teilfunktion betroffen, geringer Impact | 1 Werktag | 3 Werktage |
| 4 — Niedrig | Kosmetisch, Verbesserungswunsch | 3 Werktage | Nach Vereinbarung |

(2) Die Servicezeiten sind Montag bis Freitag, 08:00–18:00 Uhr (MEZ/MESZ), ausgenommen gesetzliche Feiertage in Baden-Württemberg.

(3) Für Severity 1 besteht eine Rufbereitschaft außerhalb der Servicezeiten. Diese wird separat mit **50,00 €/Stunde** (Pauschale: 200,00 €/Wochenende) vergütet.

(4) Bei Nichteinhaltung der SLA hat der Auftraggeber Anspruch auf eine Gutschrift in Höhe von **5% der monatlichen Vergütung** pro Vorfall, maximal jedoch **20% der monatlichen Vergütung**.

## § 6 Datenschutz

(1) Der Auftragnehmer verarbeitet im Rahmen dieses Vertrags personenbezogene Daten im Auftrag des Auftraggebers gemäß Art. 28 DSGVO. Eine separate Auftragsverarbeitungsvereinbarung (AVV) ist als **Anlage A** beigefügt und Bestandteil dieses Vertrags.

(2) Der Auftragnehmer verpflichtet sich:
- personenbezogene Daten nur im Rahmen der dokumentierten Weisungen des Auftraggebers zu verarbeiten
- alle Mitarbeiter auf die Vertraulichkeit zu verpflichten
- geeignete technische und organisatorische Maßnahmen (TOMs) gemäß Art. 32 DSGVO zu implementieren
- den Auftraggeber unverzüglich über Datenschutzverletzungen zu informieren

(3) Die Datenverarbeitung findet ausschließlich in der EU statt. Server in Drittländern dürfen nur mit vorheriger schriftlicher Genehmigung und bei Vorliegen eines Angemessenheitsbeschlusses oder geeigneter Garantien genutzt werden.

## § 7 Haftung

(1) Die Haftung des Auftragnehmers ist bei leichter Fahrlässigkeit auf vorhersehbare, vertragstypische Schäden begrenzt und beträgt maximal **500.000 €** pro Schadensfall.

(2) Die Gesamthaftung des Auftragnehmers ist auf den **zweifachen Jahresauftragswert** begrenzt.

(3) Diese Haftungsbeschränkungen gelten nicht für:
- Schäden aus der Verletzung von Leben, Körper oder Gesundheit
- Vorsatz oder grobe Fahrlässigkeit
- Verletzungen von Datenschutzpflichten
- Verletzungen wesentlicher Vertragspflichten (Kardinalpflichten)

(4) Der Auftragnehmer unterhält eine Berufshaftpflichtversicherung mit einer Mindestdeckung von **2.000.000 €** pro Versicherungsfall.

## § 8 Geistiges Eigentum

(1) Alle im Rahmen dieses Vertrags erstellten Arbeitsergebnisse (Software, Dokumentation, Konzepte) gehen mit vollständiger Bezahlung in das Eigentum des Auftraggebers über.

(2) Der Auftragnehmer räumt dem Auftraggeber ein zeitlich und räumlich unbeschränktes, unwiderrufliches Nutzungsrecht an allen Arbeitsergebnissen ein.

(3) Vorbestehende IP-Rechte des Auftragnehmers (Bibliotheken, Frameworks, Tools) bleiben beim Auftragnehmer. Der Auftraggeber erhält ein nicht-exklusives, zeitlich unbeschränktes Nutzungsrecht an diesen Komponenten, soweit sie für die Nutzung der Arbeitsergebnisse erforderlich sind.

(4) Open-Source-Komponenten dürfen eingesetzt werden, sofern die jeweilige Lizenz mit der kommerziellen Nutzung durch den Auftraggeber kompatibel ist. Eine Liste der verwendeten Open-Source-Komponenten ist der Dokumentation beizufügen.

## § 9 Vertraulichkeit

(1) Beide Vertragsparteien verpflichten sich, alle im Rahmen der Zusammenarbeit erlangten vertraulichen Informationen der jeweils anderen Partei streng vertraulich zu behandeln und nur für die Zwecke dieses Vertrags zu verwenden.

(2) Vertrauliche Informationen umfassen insbesondere:
- Geschäftsgeheimnisse, Geschäftspläne und Strategien
- technische Informationen, Quellcode, Architekturdokumentationen
- Kunden- und Mitarbeiterdaten
- Finanzinformationen und Preiskalkulationen

(3) Die Vertraulichkeitsverpflichtung gilt nicht für Informationen, die:
- zum Zeitpunkt der Offenlegung bereits öffentlich bekannt waren
- ohne Verschulden der empfangenden Partei öffentlich bekannt werden
- der empfangenden Partei bereits vor Offenlegung bekannt waren
- von einem Dritten ohne Vertraulichkeitsverpflichtung rechtmäßig erhalten wurden
- aufgrund gesetzlicher Pflicht offengelegt werden müssen

(4) Die Vertraulichkeitsverpflichtung besteht für die Dauer des Vertrags und **3 Jahre** nach Vertragsende fort.

## § 10 Compliance und Ethik

(1) Beide Vertragsparteien verpflichten sich zur Einhaltung aller anwendbaren Gesetze, insbesondere Anti-Korruptionsgesetze, Geldwäschegesetze und Exportkontrollvorschriften.

(2) Der Auftragnehmer bestätigt, dass er über ein angemessenes Compliance-Management-System verfügt.

(3) Bei Verstößen gegen diese Klausel ist die andere Partei zur sofortigen außerordentlichen Kündigung berechtigt.

## § 11 Schlussbestimmungen

(1) Änderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform. Dies gilt auch für die Aufhebung dieses Schriftformerfordernisses.

(2) Sollten einzelne Bestimmungen dieses Vertrags unwirksam sein oder werden, so bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Die unwirksame Bestimmung ist durch eine Regelung zu ersetzen, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.

(3) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.

(4) Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag ist **Stuttgart**.

(5) Dieser Vertrag wird in zwei Originalausfertigungen erstellt, von denen jede Partei ein Exemplar erhält.

---

## Anlagen

- **Anlage A:** Auftragsverarbeitungsvereinbarung (AVV)
- **Anlage B:** Technische und organisatorische Maßnahmen (TOMs)
- **Anlage C:** Liste der Schlüsselpersonen
- **Anlage D:** Preisliste Schulungen

---

Stuttgart, den 15. Januar 2026

_________________________
Peter Keller
Geschäftsführer, Samaritano GmbH

_________________________
Dr. Thomas Müller
Geschäftsführer, Müller IT-Solutions GmbH
