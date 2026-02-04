/**
 * Seed Golden Dataset - Creates initial test queries for RAG evaluation
 * Run with: npx tsx src/scripts/seed-golden-dataset.ts
 *
 * Part of: Spec 1 - Foundation (Phase 0)
 */

import { databaseService } from '../services/DatabaseService.js';

interface GoldenQuerySeed {
  query: string;
  expectedAnswer: string;
  relevantDocumentIds: string[];
  relevantChunkIds: string[];
  category: 'factual' | 'comparative' | 'procedural' | 'relational' | 'aggregative' | 'multi_hop';
  difficulty: 'easy' | 'medium' | 'hard';
  keyFacts: string[];
  forbiddenContent: string[];
}

// Document IDs from the system
const DOCS = {
  RANKERS_JUDGES: 'doc_1769715989649_xin5qkx10',     // RankersJudgesAndAssistants.pdf
  BIAS_KI: 'doc_1769715283931_7fumclgqd',            // Whitepaper_Bias_KI.pdf
  INSIGHT_AGENTS: 'doc_1769715116826_8dfz7w8r9',    // InsightAgents.pdf
  AMA: 'doc_1769715098552_7xjhfypgt',               // AMA.pdf
  REACT_NATIVE: 'doc_1769714778928_3u3uuk8mo',      // React Native Guide.pdf
  UI_UX: 'doc_1769714634789_g3pixfomj',             // ui-ux-design-principles.pdf
  REIFEGRAD: 'doc_1769274729492_qo9utt6ie',         // Reifegrad Modell
  KI_PRUEFKATALOG: 'doc_1769274608363_9vbyf9yxj',   // KI-Prüfkatalog
};

/**
 * Golden Dataset Queries
 *
 * Categories:
 * - factual: Direct fact retrieval (20+ queries)
 * - comparative: Compare multiple items (10+ queries)
 * - procedural: How-to questions (15+ queries)
 * - relational: Relationships between entities (15+ queries)
 * - aggregative: Summarize/aggregate info (10+ queries)
 * - multi_hop: Requires multiple retrieval steps (15+ queries)
 */
const GOLDEN_QUERIES: GoldenQuerySeed[] = [
  // ============================================
  // FACTUAL QUERIES (20+)
  // ============================================
  {
    query: 'Was ist ein Reranker im Kontext von RAG-Systemen?',
    expectedAnswer: 'Ein Reranker ist ein Modell, das die initialen Suchergebnisse eines Retrievers neu bewertet und sortiert, um die Relevanz für die Benutzeranfrage zu verbessern.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [], // Will be filled after search testing
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['Reranker', 'Relevanz', 'Sortierung', 'Retrieval'],
    forbiddenContent: [],
  },
  {
    query: 'What is the role of a judge model in LLM evaluation?',
    expectedAnswer: 'A judge model evaluates the quality of responses from other LLMs, assessing factors like accuracy, relevance, and helpfulness.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['judge', 'evaluation', 'quality', 'LLM'],
    forbiddenContent: [],
  },
  {
    query: 'Was versteht man unter Bias in KI-Systemen?',
    expectedAnswer: 'Bias in KI-Systemen bezeichnet systematische Verzerrungen in den Ergebnissen, die durch unausgewogene Trainingsdaten, fehlerhafte Algorithmen oder menschliche Vorurteile entstehen können.',
    relevantDocumentIds: [DOCS.BIAS_KI, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['Bias', 'Verzerrung', 'Trainingsdaten', 'Algorithmen'],
    forbiddenContent: [],
  },
  {
    query: 'What are Insight Agents?',
    expectedAnswer: 'Insight Agents are AI-powered systems designed to analyze data and provide actionable insights automatically.',
    relevantDocumentIds: [DOCS.INSIGHT_AGENTS],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['Insight', 'Agents', 'AI', 'analysis'],
    forbiddenContent: [],
  },
  {
    query: 'Was ist das Ziel des KI-Prüfkatalogs?',
    expectedAnswer: 'Der KI-Prüfkatalog dient als Leitfaden zur systematischen Prüfung und Bewertung von KI-Systemen hinsichtlich Qualität, Sicherheit und Compliance.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['Prüfkatalog', 'Bewertung', 'Qualität', 'Sicherheit'],
    forbiddenContent: [],
  },
  {
    query: 'What is React Native used for?',
    expectedAnswer: 'React Native is a framework for building native mobile applications using JavaScript and React, allowing developers to create apps for iOS and Android from a single codebase.',
    relevantDocumentIds: [DOCS.REACT_NATIVE],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['React Native', 'mobile', 'JavaScript', 'iOS', 'Android'],
    forbiddenContent: [],
  },
  {
    query: 'Was sind die Grundprinzipien des UI-Designs?',
    expectedAnswer: 'Die Grundprinzipien des UI-Designs umfassen Konsistenz, Feedback, Einfachheit, visuelle Hierarchie und Zugänglichkeit.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'medium',
    keyFacts: ['Konsistenz', 'Feedback', 'Hierarchie', 'Zugänglichkeit'],
    forbiddenContent: [],
  },
  {
    query: 'Was ist ein digitaler Reifegrad?',
    expectedAnswer: 'Der digitale Reifegrad beschreibt den Stand der digitalen Transformation eines Unternehmens anhand definierter Kriterien und Stufen.',
    relevantDocumentIds: [DOCS.REIFEGRAD],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['Reifegrad', 'digital', 'Transformation', 'Stufen'],
    forbiddenContent: [],
  },
  {
    query: 'How does hybrid search combine BM25 and vector search?',
    expectedAnswer: 'Hybrid search combines BM25 keyword matching with vector semantic search using a weighted fusion approach, typically controlled by an alpha parameter.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'medium',
    keyFacts: ['hybrid', 'BM25', 'vector', 'fusion', 'alpha'],
    forbiddenContent: [],
  },
  {
    query: 'Welche Arten von Bias gibt es in KI-Systemen?',
    expectedAnswer: 'Es gibt verschiedene Arten von Bias: Selection Bias, Confirmation Bias, Algorithmic Bias, Measurement Bias und historischer Bias.',
    relevantDocumentIds: [DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'medium',
    keyFacts: ['Selection Bias', 'Algorithmic Bias', 'historischer Bias'],
    forbiddenContent: [],
  },
  {
    query: 'What is the purpose of chunking in RAG systems?',
    expectedAnswer: 'Chunking divides documents into smaller pieces for better retrieval granularity, allowing the system to find and return the most relevant passages.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['chunking', 'retrieval', 'granularity', 'passages'],
    forbiddenContent: [],
  },
  {
    query: 'Was ist User Experience (UX)?',
    expectedAnswer: 'User Experience beschreibt das gesamte Erlebnis eines Nutzers bei der Interaktion mit einem Produkt oder Service, einschließlich Usability, Zugänglichkeit und emotionaler Reaktion.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['User Experience', 'Erlebnis', 'Usability', 'Interaktion'],
    forbiddenContent: [],
  },
  {
    query: 'What is semantic search?',
    expectedAnswer: 'Semantic search uses embeddings to understand the meaning of queries and documents, finding results based on conceptual similarity rather than just keyword matching.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['semantic', 'embeddings', 'meaning', 'similarity'],
    forbiddenContent: [],
  },
  {
    query: 'Welche Prüfkriterien enthält der KI-Prüfkatalog?',
    expectedAnswer: 'Der KI-Prüfkatalog enthält Kriterien zu Transparenz, Erklärbarkeit, Fairness, Robustheit, Datenschutz und Sicherheit von KI-Systemen.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'medium',
    keyFacts: ['Transparenz', 'Erklärbarkeit', 'Fairness', 'Robustheit'],
    forbiddenContent: [],
  },
  {
    query: 'What are the main components of a RAG pipeline?',
    expectedAnswer: 'A RAG pipeline consists of: document ingestion, chunking, embedding generation, vector storage, retrieval, optional reranking, and response generation.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'medium',
    keyFacts: ['ingestion', 'chunking', 'embedding', 'retrieval', 'generation'],
    forbiddenContent: [],
  },
  {
    query: 'Was ist Responsive Design?',
    expectedAnswer: 'Responsive Design ist ein Gestaltungsansatz, bei dem sich Webseiten automatisch an verschiedene Bildschirmgrößen und Geräte anpassen.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['Responsive', 'Bildschirmgrößen', 'anpassen', 'Geräte'],
    forbiddenContent: [],
  },
  {
    query: 'How do embedding models work?',
    expectedAnswer: 'Embedding models convert text into dense numerical vectors that capture semantic meaning, allowing similar concepts to have similar vector representations.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'medium',
    keyFacts: ['embedding', 'vectors', 'semantic', 'numerical'],
    forbiddenContent: [],
  },
  {
    query: 'Was bedeutet KI-Governance?',
    expectedAnswer: 'KI-Governance umfasst Richtlinien, Prozesse und Strukturen zur verantwortungsvollen Entwicklung und Nutzung von KI-Systemen in Organisationen.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG, DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'medium',
    keyFacts: ['Governance', 'Richtlinien', 'verantwortungsvoll', 'Entwicklung'],
    forbiddenContent: [],
  },
  {
    query: 'What is Mean Reciprocal Rank (MRR)?',
    expectedAnswer: 'MRR is a retrieval metric that measures the average of reciprocal ranks of the first relevant result across queries, indicating how quickly relevant results appear.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'hard',
    keyFacts: ['MRR', 'reciprocal', 'rank', 'metric', 'retrieval'],
    forbiddenContent: [],
  },
  {
    query: 'Was ist ein Wireframe im UI-Design?',
    expectedAnswer: 'Ein Wireframe ist eine schematische Darstellung einer Benutzeroberfläche, die die grundlegende Struktur und Layout ohne visuelle Details zeigt.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'factual',
    difficulty: 'easy',
    keyFacts: ['Wireframe', 'schematisch', 'Struktur', 'Layout'],
    forbiddenContent: [],
  },

  // ============================================
  // COMPARATIVE QUERIES (10+)
  // ============================================
  {
    query: 'Was ist der Unterschied zwischen UI und UX Design?',
    expectedAnswer: 'UI (User Interface) Design fokussiert auf das visuelle Erscheinungsbild und die Interaktionselemente, während UX (User Experience) Design das gesamte Nutzererlebnis und die Benutzerfreundlichkeit umfasst.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'easy',
    keyFacts: ['UI', 'UX', 'visuell', 'Nutzererlebnis'],
    forbiddenContent: [],
  },
  {
    query: 'Compare BM25 and vector search for document retrieval.',
    expectedAnswer: 'BM25 uses keyword matching and term frequency, while vector search uses semantic embeddings. BM25 is better for exact matches, vector search for conceptual similarity.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'medium',
    keyFacts: ['BM25', 'vector', 'keyword', 'semantic', 'similarity'],
    forbiddenContent: [],
  },
  {
    query: 'Wie unterscheiden sich impliziter und expliziter Bias?',
    expectedAnswer: 'Impliziter Bias wirkt unbewusst und automatisch, während expliziter Bias bewusst und absichtlich ist. Beide können KI-Systeme beeinflussen.',
    relevantDocumentIds: [DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'medium',
    keyFacts: ['implizit', 'explizit', 'unbewusst', 'bewusst'],
    forbiddenContent: [],
  },
  {
    query: 'What is the difference between a retriever and a reranker?',
    expectedAnswer: 'A retriever finds initial candidate documents from a large corpus, while a reranker refines the ranking of these candidates for better relevance.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'easy',
    keyFacts: ['retriever', 'reranker', 'candidates', 'ranking'],
    forbiddenContent: [],
  },
  {
    query: 'Vergleiche mobile und responsive Webdesign.',
    expectedAnswer: 'Mobile Design erstellt separate Versionen für mobile Geräte, während Responsive Design eine flexible Seite erstellt, die sich automatisch anpasst.',
    relevantDocumentIds: [DOCS.UI_UX, DOCS.REACT_NATIVE],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'medium',
    keyFacts: ['mobile', 'responsive', 'separate', 'flexibel'],
    forbiddenContent: [],
  },
  {
    query: 'Compare precision and recall metrics in retrieval systems.',
    expectedAnswer: 'Precision measures the fraction of retrieved documents that are relevant, while recall measures the fraction of relevant documents that are retrieved.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'medium',
    keyFacts: ['precision', 'recall', 'relevant', 'retrieved', 'fraction'],
    forbiddenContent: [],
  },
  {
    query: 'Was ist der Unterschied zwischen regelbasierter KI und Machine Learning?',
    expectedAnswer: 'Regelbasierte KI folgt vordefinierten Regeln, während Machine Learning aus Daten lernt und Muster selbst erkennt.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'easy',
    keyFacts: ['regelbasiert', 'Machine Learning', 'Regeln', 'lernt'],
    forbiddenContent: [],
  },
  {
    query: 'How do cross-encoders differ from bi-encoders?',
    expectedAnswer: 'Bi-encoders encode query and document separately for fast retrieval, while cross-encoders process them together for more accurate but slower reranking.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'hard',
    keyFacts: ['cross-encoder', 'bi-encoder', 'separate', 'together', 'accuracy'],
    forbiddenContent: [],
  },
  {
    query: 'Vergleiche die Reifegrade 1 und 5 der digitalen Transformation.',
    expectedAnswer: 'Reifegrad 1 kennzeichnet initiale, unstrukturierte Digitalisierung, während Reifegrad 5 vollständig optimierte und innovative digitale Prozesse beschreibt.',
    relevantDocumentIds: [DOCS.REIFEGRAD],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'medium',
    keyFacts: ['Reifegrad', 'initial', 'optimiert', 'digital'],
    forbiddenContent: [],
  },
  {
    query: 'What is the difference between semantic and lexical chunking?',
    expectedAnswer: 'Lexical chunking splits text at fixed boundaries like sentences or characters, while semantic chunking uses meaning to group related content together.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'comparative',
    difficulty: 'medium',
    keyFacts: ['semantic', 'lexical', 'fixed', 'meaning', 'boundaries'],
    forbiddenContent: [],
  },

  // ============================================
  // PROCEDURAL QUERIES (15+)
  // ============================================
  {
    query: 'Wie implementiert man einen Reranker in einem RAG-System?',
    expectedAnswer: 'Man lädt ein Reranker-Modell, erhält initiale Suchergebnisse vom Retriever, bewertet Query-Document-Paare mit dem Reranker und sortiert nach den neuen Scores.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['Reranker', 'laden', 'bewerten', 'sortieren'],
    forbiddenContent: [],
  },
  {
    query: 'How do you evaluate a RAG system?',
    expectedAnswer: 'Create a golden dataset with queries and relevant documents, run retrieval, measure precision/recall/MRR, optionally evaluate generation quality with groundedness checks.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['golden dataset', 'precision', 'recall', 'MRR', 'groundedness'],
    forbiddenContent: [],
  },
  {
    query: 'Wie führt man eine Bias-Analyse für KI-Systeme durch?',
    expectedAnswer: 'Man identifiziert Datenbias, analysiert Modellentscheidungen für verschiedene Gruppen, verwendet Fairness-Metriken und führt Audits durch.',
    relevantDocumentIds: [DOCS.BIAS_KI, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'hard',
    keyFacts: ['Datenbias', 'Fairness-Metriken', 'Audits', 'Gruppen'],
    forbiddenContent: [],
  },
  {
    query: 'How to set up a React Native development environment?',
    expectedAnswer: 'Install Node.js, install React Native CLI, set up Android Studio or Xcode, configure emulators, create a new project with npx react-native init.',
    relevantDocumentIds: [DOCS.REACT_NATIVE],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'easy',
    keyFacts: ['Node.js', 'CLI', 'Android Studio', 'Xcode', 'emulators'],
    forbiddenContent: [],
  },
  {
    query: 'Wie erstellt man einen Usability-Test?',
    expectedAnswer: 'Definiere Testziele, rekrutiere Testpersonen, erstelle Aufgaben-Szenarien, führe Tests durch, sammle Feedback und analysiere Ergebnisse.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['Testziele', 'Testpersonen', 'Szenarien', 'Feedback'],
    forbiddenContent: [],
  },
  {
    query: 'How do you implement hybrid search?',
    expectedAnswer: 'Combine BM25 keyword search with vector similarity search, apply weighted fusion using alpha parameter, and return merged results sorted by combined score.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['BM25', 'vector', 'fusion', 'alpha', 'combined score'],
    forbiddenContent: [],
  },
  {
    query: 'Wie bewertet man den digitalen Reifegrad eines Unternehmens?',
    expectedAnswer: 'Analysiere Prozesse, Technologie, Kultur und Strategie anhand des Reifegradmodells, bewerte jede Dimension und ermittle den Gesamtreifegrad.',
    relevantDocumentIds: [DOCS.REIFEGRAD],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['Prozesse', 'Technologie', 'Kultur', 'Dimensionen'],
    forbiddenContent: [],
  },
  {
    query: 'How to chunk documents for RAG?',
    expectedAnswer: 'Split documents by semantic boundaries, maintain context with overlap, keep chunk sizes between 200-1000 tokens, preserve metadata like page numbers.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['semantic boundaries', 'overlap', 'tokens', 'metadata'],
    forbiddenContent: [],
  },
  {
    query: 'Wie erstellt man eine Farbpalette für UI-Design?',
    expectedAnswer: 'Wähle eine Primärfarbe, erstelle komplementäre Sekundärfarben, definiere Akzentfarben, teste Kontraste für Barrierefreiheit und dokumentiere Farbcodes.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'easy',
    keyFacts: ['Primärfarbe', 'Sekundärfarben', 'Kontraste', 'Barrierefreiheit'],
    forbiddenContent: [],
  },
  {
    query: 'How do you fine-tune a reranker model?',
    expectedAnswer: 'Collect query-document pairs with relevance labels, prepare training data in the required format, train using contrastive learning, evaluate on a held-out test set.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'hard',
    keyFacts: ['fine-tune', 'relevance labels', 'contrastive learning', 'test set'],
    forbiddenContent: [],
  },
  {
    query: 'Wie implementiert man KI-Transparenz?',
    expectedAnswer: 'Dokumentiere Trainingsdaten und -prozesse, erkläre Modellentscheidungen, biete Nutzern Einblick in die Funktionsweise und veröffentliche Systemkarten.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG, DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['Dokumentation', 'Erklärung', 'Einblick', 'Systemkarten'],
    forbiddenContent: [],
  },
  {
    query: 'How to create embeddings for documents?',
    expectedAnswer: 'Load an embedding model, preprocess text by cleaning and chunking, pass text through the model to get vectors, store vectors in a vector database.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'easy',
    keyFacts: ['embedding model', 'preprocess', 'vectors', 'vector database'],
    forbiddenContent: [],
  },
  {
    query: 'Wie gestaltet man ein barrierefreies UI?',
    expectedAnswer: 'Verwende ausreichende Kontraste, biete Textalternativen für Bilder, ermögliche Tastaturnavigation, nutze semantisches HTML und teste mit Screenreadern.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['Kontraste', 'Textalternativen', 'Tastaturnavigation', 'Screenreader'],
    forbiddenContent: [],
  },
  {
    query: 'How do you measure retrieval quality?',
    expectedAnswer: 'Use metrics like Precision@K, Recall@K, MRR, and NDCG. Create a test set with known relevant documents and compute metrics against retrieved results.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'medium',
    keyFacts: ['Precision', 'Recall', 'MRR', 'NDCG', 'test set'],
    forbiddenContent: [],
  },
  {
    query: 'Wie führt man ein KI-Audit durch?',
    expectedAnswer: 'Prüfe Datenqualität und -herkunft, analysiere Modellperformance und Fairness, dokumentiere Risiken, erstelle Handlungsempfehlungen und plane regelmäßige Reviews.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'procedural',
    difficulty: 'hard',
    keyFacts: ['Datenqualität', 'Fairness', 'Risiken', 'Handlungsempfehlungen'],
    forbiddenContent: [],
  },

  // ============================================
  // RELATIONAL QUERIES (15+)
  // ============================================
  {
    query: 'Wie hängen Retriever und Reranker in einem RAG-System zusammen?',
    expectedAnswer: 'Der Retriever findet initiale Kandidaten aus dem Dokumentenkorpus, der Reranker verbessert dann deren Ranking für höhere Relevanz.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'easy',
    keyFacts: ['Retriever', 'Reranker', 'Kandidaten', 'Ranking'],
    forbiddenContent: [],
  },
  {
    query: 'What is the relationship between embeddings and vector search?',
    expectedAnswer: 'Embeddings convert text to vectors, which are then used by vector search to find similar documents based on cosine similarity or other distance metrics.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'easy',
    keyFacts: ['embeddings', 'vectors', 'similarity', 'distance'],
    forbiddenContent: [],
  },
  {
    query: 'Wie beeinflusst Datenbias die KI-Ergebnisse?',
    expectedAnswer: 'Verzerrte Trainingsdaten führen zu verzerrten Modellvorhersagen, was zu unfairen oder diskriminierenden Ergebnissen für bestimmte Gruppen führen kann.',
    relevantDocumentIds: [DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'medium',
    keyFacts: ['Datenbias', 'Trainingsdaten', 'Vorhersagen', 'diskriminierend'],
    forbiddenContent: [],
  },
  {
    query: 'How does chunk size affect retrieval quality?',
    expectedAnswer: 'Smaller chunks provide more granular retrieval but may lack context, larger chunks have more context but may include irrelevant content. Optimal size balances both.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'medium',
    keyFacts: ['chunk size', 'granular', 'context', 'balance'],
    forbiddenContent: [],
  },
  {
    query: 'Welche Rolle spielt UX-Research im Designprozess?',
    expectedAnswer: 'UX-Research informiert Designentscheidungen durch Nutzerfeedback und -verhalten, validiert Annahmen und hilft, nutzerzentrierte Produkte zu entwickeln.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'medium',
    keyFacts: ['UX-Research', 'Designentscheidungen', 'Nutzerfeedback', 'nutzerzentriert'],
    forbiddenContent: [],
  },
  {
    query: 'What role does the alpha parameter play in hybrid search?',
    expectedAnswer: 'Alpha controls the balance between BM25 and vector search: 0 means pure keyword search, 1 means pure semantic search, 0.5 is balanced.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'medium',
    keyFacts: ['alpha', 'BM25', 'vector', 'balance', '0.5'],
    forbiddenContent: [],
  },
  {
    query: 'Wie wirkt sich der digitale Reifegrad auf die Wettbewerbsfähigkeit aus?',
    expectedAnswer: 'Höherer digitaler Reifegrad ermöglicht effizientere Prozesse, bessere Kundenerfahrung und schnellere Innovation, was zu Wettbewerbsvorteilen führt.',
    relevantDocumentIds: [DOCS.REIFEGRAD],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'medium',
    keyFacts: ['Reifegrad', 'Effizienz', 'Kundenerfahrung', 'Wettbewerbsvorteile'],
    forbiddenContent: [],
  },
  {
    query: 'How does context window size relate to RAG performance?',
    expectedAnswer: 'Larger context windows allow more retrieved chunks to be included, potentially improving response quality, but may also introduce noise and increase latency.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'hard',
    keyFacts: ['context window', 'chunks', 'quality', 'noise', 'latency'],
    forbiddenContent: [],
  },
  {
    query: 'Welchen Einfluss hat KI-Ethik auf die Produktentwicklung?',
    expectedAnswer: 'KI-Ethik beeinflusst Design-Entscheidungen, erfordert Fairness-Tests, verlangt Transparenz und kann die Marktakzeptanz und regulatorische Compliance beeinflussen.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG, DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'medium',
    keyFacts: ['KI-Ethik', 'Fairness', 'Transparenz', 'Compliance'],
    forbiddenContent: [],
  },
  {
    query: 'What is the connection between retrieval and generation in RAG?',
    expectedAnswer: 'Retrieval provides relevant context documents that the generation model uses to produce grounded, accurate responses based on the retrieved information.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'easy',
    keyFacts: ['retrieval', 'generation', 'context', 'grounded'],
    forbiddenContent: [],
  },
  {
    query: 'Wie beeinflusst Typografie die Lesbarkeit?',
    expectedAnswer: 'Schriftart, -größe, Zeilenabstand und Kontrast bestimmen die Lesbarkeit. Optimale Typografie reduziert Augenbelastung und verbessert das Leseverständnis.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'easy',
    keyFacts: ['Typografie', 'Schriftart', 'Zeilenabstand', 'Lesbarkeit'],
    forbiddenContent: [],
  },
  {
    query: 'How does document structure affect chunking strategy?',
    expectedAnswer: 'Well-structured documents with clear headings enable semantic chunking that preserves context, while unstructured documents may require fixed-size chunking.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'medium',
    keyFacts: ['structure', 'headings', 'semantic chunking', 'fixed-size'],
    forbiddenContent: [],
  },
  {
    query: 'Welche Verbindung besteht zwischen Datenschutz und KI-Systemen?',
    expectedAnswer: 'KI-Systeme verarbeiten oft personenbezogene Daten, weshalb DSGVO-Compliance, Datenanonymisierung und Einwilligungsmanagement wichtig sind.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'medium',
    keyFacts: ['Datenschutz', 'DSGVO', 'personenbezogene Daten', 'Anonymisierung'],
    forbiddenContent: [],
  },
  {
    query: 'What is the relationship between query understanding and retrieval success?',
    expectedAnswer: 'Better query understanding through query expansion or reformulation leads to more relevant retrieval results by capturing user intent more accurately.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'hard',
    keyFacts: ['query understanding', 'expansion', 'reformulation', 'intent'],
    forbiddenContent: [],
  },
  {
    query: 'Wie hängen Prototyping und finales Design zusammen?',
    expectedAnswer: 'Prototypen ermöglichen frühe Tests und Iterationen, deren Erkenntnisse in das finale Design einfließen und kostspielige späte Änderungen vermeiden.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'relational',
    difficulty: 'easy',
    keyFacts: ['Prototypen', 'Tests', 'Iterationen', 'finales Design'],
    forbiddenContent: [],
  },

  // ============================================
  // AGGREGATIVE QUERIES (10+)
  // ============================================
  {
    query: 'Fasse die wichtigsten KI-Prüfkriterien zusammen.',
    expectedAnswer: 'Die wichtigsten Kriterien sind: Transparenz, Erklärbarkeit, Fairness, Robustheit, Datenschutz, Sicherheit, Verlässlichkeit und menschliche Aufsicht.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'medium',
    keyFacts: ['Transparenz', 'Erklärbarkeit', 'Fairness', 'Robustheit', 'Sicherheit'],
    forbiddenContent: [],
  },
  {
    query: 'Summarize the main challenges in RAG systems.',
    expectedAnswer: 'Key challenges include: chunking strategy, retrieval accuracy, context window limitations, hallucination prevention, latency, and evaluation methodology.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'medium',
    keyFacts: ['chunking', 'retrieval', 'context window', 'hallucination', 'evaluation'],
    forbiddenContent: [],
  },
  {
    query: 'Was sind die Hauptursachen für Bias in KI?',
    expectedAnswer: 'Hauptursachen sind: verzerrte Trainingsdaten, unrepräsentative Stichproben, historische Vorurteile, Algorithmen-Design und menschliche Entscheidungen im Entwicklungsprozess.',
    relevantDocumentIds: [DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'medium',
    keyFacts: ['Trainingsdaten', 'Stichproben', 'Vorurteile', 'Algorithmen'],
    forbiddenContent: [],
  },
  {
    query: 'List the key UI design principles.',
    expectedAnswer: 'Key principles: consistency, feedback, simplicity, visual hierarchy, accessibility, user control, error prevention, and flexibility.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'easy',
    keyFacts: ['consistency', 'feedback', 'simplicity', 'hierarchy', 'accessibility'],
    forbiddenContent: [],
  },
  {
    query: 'Welche Stufen umfasst das digitale Reifegradmodell?',
    expectedAnswer: 'Das Modell umfasst typischerweise 5 Stufen: Initial, Wiederholbar, Definiert, Gesteuert und Optimierend, mit zunehmender Digitalisierungsreife.',
    relevantDocumentIds: [DOCS.REIFEGRAD],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'medium',
    keyFacts: ['Initial', 'Wiederholbar', 'Definiert', 'Gesteuert', 'Optimierend'],
    forbiddenContent: [],
  },
  {
    query: 'What are the main retrieval evaluation metrics?',
    expectedAnswer: 'Main metrics: Precision@K, Recall@K, Mean Reciprocal Rank (MRR), Normalized Discounted Cumulative Gain (NDCG), and F1 Score.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'medium',
    keyFacts: ['Precision', 'Recall', 'MRR', 'NDCG', 'F1'],
    forbiddenContent: [],
  },
  {
    query: 'Fasse die UX-Design-Phasen zusammen.',
    expectedAnswer: 'Die Hauptphasen sind: Research, Definition, Ideation, Prototyping, Testing und Implementation, oft in iterativen Zyklen durchgeführt.',
    relevantDocumentIds: [DOCS.UI_UX],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'easy',
    keyFacts: ['Research', 'Definition', 'Ideation', 'Prototyping', 'Testing'],
    forbiddenContent: [],
  },
  {
    query: 'Summarize the types of document chunking strategies.',
    expectedAnswer: 'Main strategies: fixed-size chunking, sentence-based, paragraph-based, semantic chunking, recursive chunking, and document-structure-aware chunking.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'medium',
    keyFacts: ['fixed-size', 'sentence', 'paragraph', 'semantic', 'recursive'],
    forbiddenContent: [],
  },
  {
    query: 'Welche Maßnahmen helfen gegen KI-Bias?',
    expectedAnswer: 'Wichtige Maßnahmen: diverse Trainingsdaten, Bias-Audits, Fairness-Metriken, Debiasing-Techniken, Transparenz und diverse Entwicklerteams.',
    relevantDocumentIds: [DOCS.BIAS_KI, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'medium',
    keyFacts: ['diverse Daten', 'Audits', 'Fairness', 'Debiasing', 'Transparenz'],
    forbiddenContent: [],
  },
  {
    query: 'List the components of a modern RAG architecture.',
    expectedAnswer: 'Components: document loader, text splitter/chunker, embedding model, vector store, retriever, optional reranker, prompt template, and LLM generator.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'aggregative',
    difficulty: 'medium',
    keyFacts: ['chunker', 'embedding', 'vector store', 'retriever', 'reranker', 'LLM'],
    forbiddenContent: [],
  },

  // ============================================
  // MULTI-HOP QUERIES (15+)
  // ============================================
  {
    query: 'Wie kann ein Reranker die Bias-Problematik in RAG-Systemen verschärfen?',
    expectedAnswer: 'Ein Reranker kann bestehende Bias verstärken, wenn er auf verzerrten Daten trainiert wurde, indem er systematisch bestimmte Dokumente bevorzugt oder benachteiligt.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES, DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['Reranker', 'Bias', 'verstärken', 'verzerrte Daten'],
    forbiddenContent: [],
  },
  {
    query: 'How can UI/UX principles improve RAG system usability?',
    expectedAnswer: 'Clear feedback on search progress, intuitive result presentation, source highlighting, error messages, and consistent interaction patterns enhance RAG usability.',
    relevantDocumentIds: [DOCS.UI_UX, DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['feedback', 'result presentation', 'source highlighting', 'usability'],
    forbiddenContent: [],
  },
  {
    query: 'Welche KI-Prüfkriterien sind besonders relevant für RAG-Systeme?',
    expectedAnswer: 'Besonders relevant sind: Erklärbarkeit (Quellenangaben), Robustheit (gegen adversariale Queries), Fairness (unvoreingenommene Retrieval) und Datenschutz.',
    relevantDocumentIds: [DOCS.KI_PRUEFKATALOG, DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['Erklärbarkeit', 'Robustheit', 'Fairness', 'Quellenangaben'],
    forbiddenContent: [],
  },
  {
    query: 'How does digital maturity affect the implementation of AI systems?',
    expectedAnswer: 'Higher digital maturity enables better data infrastructure, skilled teams, and change management capabilities needed for successful AI implementation.',
    relevantDocumentIds: [DOCS.REIFEGRAD, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'medium',
    keyFacts: ['digital maturity', 'data infrastructure', 'AI implementation'],
    forbiddenContent: [],
  },
  {
    query: 'Wie beeinflusst UX-Design die Akzeptanz von KI-Systemen?',
    expectedAnswer: 'Gutes UX-Design erhöht Vertrauen durch Transparenz, ermöglicht Verständnis der KI-Entscheidungen und reduziert Nutzerangst vor der Technologie.',
    relevantDocumentIds: [DOCS.UI_UX, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'medium',
    keyFacts: ['UX-Design', 'Vertrauen', 'Transparenz', 'Akzeptanz'],
    forbiddenContent: [],
  },
  {
    query: 'What role does retrieval quality play in preventing AI hallucinations?',
    expectedAnswer: 'High-quality retrieval provides accurate, relevant context that grounds the LLM response, reducing hallucinations by giving the model factual information to reference.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['retrieval quality', 'context', 'hallucinations', 'grounded'],
    forbiddenContent: [],
  },
  {
    query: 'Wie können Bias-Prüfungen in den digitalen Reifegradprozess integriert werden?',
    expectedAnswer: 'Bias-Prüfungen sollten als Qualitätskriterium in höhere Reifegrade aufgenommen werden, mit regelmäßigen Audits als Teil des KI-Governance-Frameworks.',
    relevantDocumentIds: [DOCS.BIAS_KI, DOCS.REIFEGRAD],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['Bias-Prüfungen', 'Reifegrade', 'Audits', 'Governance'],
    forbiddenContent: [],
  },
  {
    query: 'How can React Native apps integrate with RAG systems?',
    expectedAnswer: 'React Native apps can call RAG API endpoints for search functionality, display retrieved results in mobile-optimized UI, and handle streaming responses for generation.',
    relevantDocumentIds: [DOCS.REACT_NATIVE, DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'medium',
    keyFacts: ['React Native', 'API endpoints', 'mobile UI', 'streaming'],
    forbiddenContent: [],
  },
  {
    query: 'Welche Designprinzipien sind wichtig für KI-Erklärbarkeit in der UI?',
    expectedAnswer: 'Wichtig sind: Quellenangaben prominent anzeigen, Konfidenzwerte visualisieren, interaktive Erklärungen bieten und klare Feedback-Mechanismen implementieren.',
    relevantDocumentIds: [DOCS.UI_UX, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['Quellenangaben', 'Konfidenzwerte', 'Erklärungen', 'Feedback'],
    forbiddenContent: [],
  },
  {
    query: 'How does semantic chunking relate to embedding quality?',
    expectedAnswer: 'Semantic chunking creates coherent text segments that produce better embeddings, as the embedding model can capture complete concepts rather than fragmented text.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['semantic chunking', 'coherent', 'embeddings', 'complete concepts'],
    forbiddenContent: [],
  },
  {
    query: 'Wie können Reifegradmodelle zur Bewertung von KI-Governance genutzt werden?',
    expectedAnswer: 'Reifegradmodelle können KI-Governance-Dimensionen wie Strategie, Prozesse, Verantwortlichkeiten und Compliance bewerten und Verbesserungspfade aufzeigen.',
    relevantDocumentIds: [DOCS.REIFEGRAD, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['Reifegradmodelle', 'KI-Governance', 'Dimensionen', 'Verbesserungspfade'],
    forbiddenContent: [],
  },
  {
    query: 'What is the impact of bias on RAG system evaluation metrics?',
    expectedAnswer: 'Bias can skew evaluation if the golden dataset lacks diversity, leading to misleadingly high metrics for majority cases while missing poor performance on underrepresented queries.',
    relevantDocumentIds: [DOCS.BIAS_KI, DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['bias', 'evaluation', 'golden dataset', 'diversity', 'underrepresented'],
    forbiddenContent: [],
  },
  {
    query: 'Wie verbessert gute Informationsarchitektur die RAG-Retrieval-Qualität?',
    expectedAnswer: 'Klare Dokumentstruktur ermöglicht bessere Chunking-Strategien, konsistente Metadaten verbessern Filterung, und gute Navigation hilft bei der Quellenverifikation.',
    relevantDocumentIds: [DOCS.UI_UX, DOCS.RANKERS_JUDGES],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['Informationsarchitektur', 'Dokumentstruktur', 'Chunking', 'Metadaten'],
    forbiddenContent: [],
  },
  {
    query: 'How do judge models help ensure AI fairness?',
    expectedAnswer: 'Judge models can evaluate responses for bias indicators, compare treatment across demographic groups, and provide fairness scores as part of automated quality checks.',
    relevantDocumentIds: [DOCS.RANKERS_JUDGES, DOCS.BIAS_KI],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['judge models', 'fairness', 'bias indicators', 'demographic groups'],
    forbiddenContent: [],
  },
  {
    query: 'Welche Rolle spielt User Research bei der Entwicklung von KI-Prüfkriterien?',
    expectedAnswer: 'User Research identifiziert reale Nutzerbedürfnisse und -ängste, die in Prüfkriterien für Vertrauen, Transparenz und Usability von KI-Systemen einfließen sollten.',
    relevantDocumentIds: [DOCS.UI_UX, DOCS.KI_PRUEFKATALOG],
    relevantChunkIds: [],
    category: 'multi_hop',
    difficulty: 'hard',
    keyFacts: ['User Research', 'Nutzerbedürfnisse', 'Prüfkriterien', 'Vertrauen'],
    forbiddenContent: [],
  },
];

async function seedGoldenDataset() {
  console.log('🌱 Seeding Golden Dataset...\n');

  try {
    // Check current count
    const countResult = await databaseService.query('SELECT COUNT(*) FROM golden_dataset');
    const currentCount = parseInt(countResult.rows[0].count, 10);

    if (currentCount > 0) {
      console.log(`⚠️  Golden dataset already has ${currentCount} queries.`);
      console.log('   Use --force to overwrite or skip seeding.\n');

      const args = process.argv.slice(2);
      if (!args.includes('--force')) {
        console.log('Exiting without changes. Run with --force to overwrite.');
        process.exit(0);
      }

      console.log('   --force detected, clearing existing queries...');
      await databaseService.query('DELETE FROM golden_dataset');
    }

    // Insert queries
    let inserted = 0;
    const byCategory: Record<string, number> = {};

    for (const query of GOLDEN_QUERIES) {
      try {
        await databaseService.query(
          `INSERT INTO golden_dataset
           (query, expected_answer, relevant_document_ids, relevant_chunk_ids,
            category, difficulty, key_facts, forbidden_content)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            query.query,
            query.expectedAnswer,
            query.relevantDocumentIds,
            query.relevantChunkIds,
            query.category,
            query.difficulty,
            query.keyFacts,
            query.forbiddenContent,
          ]
        );

        inserted++;
        byCategory[query.category] = (byCategory[query.category] || 0) + 1;
      } catch (error) {
        console.error(`Failed to insert query: "${query.query.substring(0, 50)}..."`, error);
      }
    }

    console.log(`\n✅ Inserted ${inserted} queries into golden_dataset\n`);
    console.log('📊 By category:');
    for (const [category, count] of Object.entries(byCategory)) {
      console.log(`   ${category}: ${count}`);
    }

    // Show statistics
    const stats = await databaseService.query(`
      SELECT
        category,
        COUNT(*) as count,
        COUNT(CASE WHEN difficulty = 'easy' THEN 1 END) as easy,
        COUNT(CASE WHEN difficulty = 'medium' THEN 1 END) as medium,
        COUNT(CASE WHEN difficulty = 'hard' THEN 1 END) as hard
      FROM golden_dataset
      GROUP BY category
      ORDER BY category
    `);

    console.log('\n📈 Detailed statistics:');
    console.log('Category          | Total | Easy | Medium | Hard');
    console.log('------------------|-------|------|--------|-----');
    for (const row of stats.rows) {
      console.log(
        `${row.category.padEnd(17)} | ${String(row.count).padStart(5)} | ${String(row.easy).padStart(4)} | ${String(row.medium).padStart(6)} | ${String(row.hard).padStart(4)}`
      );
    }

  } catch (error) {
    console.error('❌ Failed to seed golden dataset:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run
seedGoldenDataset();
