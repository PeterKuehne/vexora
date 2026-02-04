/**
 * Entity Extractor Service
 * Part of RAG V2 Phase 4: Intelligence & Production
 *
 * Extracts entities from document chunks using:
 * 1. Pattern-based extraction (German language patterns)
 * 2. LLM-based extraction (optional, for complex cases)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Entity,
  EntityType,
  EntityOccurrence,
  Relationship,
  RelationType,
  ExtractionConfig,
  ExtractionResult,
  DEFAULT_EXTRACTION_CONFIG,
} from '../../types/graph.js';

interface ContentBlockLike {
  id?: string;
  content: string;
  type?: string;
}

export class EntityExtractor {
  private patterns: Map<EntityType, RegExp[]>;
  private config: ExtractionConfig;

  constructor(config: Partial<ExtractionConfig> = {}) {
    this.config = { ...DEFAULT_EXTRACTION_CONFIG, ...config };
    this.patterns = this.initializePatterns();
  }

  /**
   * Extract entities and relationships from document blocks
   */
  async extract(
    documentId: string,
    blocks: ContentBlockLike[]
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];

    for (const block of blocks) {
      // Pattern-based extraction
      const patternEntities = this.extractWithPatterns(documentId, block);
      entities.push(...patternEntities);

      // LLM-based extraction for complex cases
      if (this.config.useLLM) {
        const llmResult = await this.extractWithLLM(documentId, block);
        entities.push(...llmResult.entities);
        relationships.push(...llmResult.relationships);
      }
    }

    // Extract relationships from co-occurrences
    if (this.config.extractRelationships) {
      const cooccurrenceRels = this.extractCooccurrenceRelationships(entities, blocks);
      relationships.push(...cooccurrenceRels);
    }

    // Deduplicate entities (basic, before resolution)
    const deduplicatedEntities = this.basicDeduplication(entities);

    const processingTimeMs = Date.now() - startTime;

    return {
      entities: deduplicatedEntities,
      relationships,
      stats: {
        entitiesExtracted: deduplicatedEntities.length,
        relationshipsExtracted: relationships.length,
        processingTimeMs,
        methodUsed: this.config.useLLM ? 'hybrid' : 'pattern',
      },
    };
  }

  /**
   * Initialize German language patterns for entity extraction
   */
  private initializePatterns(): Map<EntityType, RegExp[]> {
    return new Map([
      [
        'PERSON',
        [
          // Titles with names (German)
          /(?:Herr|Frau|Dr\.|Prof\.|Dipl\.-Ing\.)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/g,
          // Names with job titles
          /([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)(?:\s+(?:CEO|CTO|CFO|COO|Manager|Leiter|Leiterin|Direktor|Direktorin|Geschäftsführer|Geschäftsführerin|Vorstand|Vorsitzende[r]?))/g,
          // Names in signatures
          /(?:Mit freundlichen Grüßen|Beste Grüße|Viele Grüße),?\s*\n\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/g,
        ],
      ],
      [
        'ORGANIZATION',
        [
          // German company suffixes
          /([A-ZÄÖÜ][a-zäöüß]*(?:\s+[A-ZÄÖÜ][a-zäöüß]*)*)(?:\s+(?:GmbH|AG|KG|OHG|e\.V\.|mbH|SE|KGaA|UG))/g,
          // International suffixes
          /([A-ZÄÖÜ][a-zäöüß]*(?:\s+[A-ZÄÖÜ][a-zäöüß]*)*)(?:\s+(?:Inc\.|Ltd\.|LLC|Corp\.|Corporation|Company))/g,
          // Explicit company references
          /(?:Firma|Unternehmen|Gesellschaft|Konzern|Abteilung)\s+([A-ZÄÖÜ][a-zäöüß\s&-]+)/g,
        ],
      ],
      [
        'PROJECT',
        [
          /Projekt\s+([A-ZÄÖÜ][a-zäöüß\-\s]+)/gi,
          /(?:Projektnummer|Projekt-ID|Projektname):\s*([A-Z0-9\-]+)/gi,
          /(?:Vorhaben|Initiative)\s+([A-ZÄÖÜ][a-zäöüß\-\s]+)/gi,
        ],
      ],
      [
        'PRODUCT',
        [
          /Produkt\s+([A-ZÄÖÜ][a-zäöüß\-\s]+)/gi,
          /(?:SKU|Artikelnummer|Produktnummer):\s*([A-Z0-9\-]+)/gi,
          /(?:Version|Release)\s+(\d+\.\d+(?:\.\d+)?)/gi,
        ],
      ],
      [
        'DATE',
        [
          // German date format
          /(\d{1,2}\.\d{1,2}\.\d{4})/g,
          // ISO date format
          /(\d{4}-\d{2}-\d{2})/g,
          // Month names (German)
          /((?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4})/gi,
          // Relative dates
          /(?:am|bis zum|ab dem)\s+(\d{1,2}\.\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4})/gi,
        ],
      ],
      [
        'LOCATION',
        [
          // Cities with postal codes
          /(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+)/g,
          // Explicit location references
          /(?:in|aus|nach|von)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+)?)/g,
          // Addresses
          /([A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|platz|allee))\s+\d+/gi,
        ],
      ],
      [
        'REGULATION',
        [
          // Common regulations
          /(DSGVO|GDPR|ISO\s*\d+|DIN\s*\d+|EN\s*\d+)/gi,
          // German law references
          /(?:Gesetz|Verordnung|Richtlinie|Vorschrift)\s+([A-ZÄÖÜ][a-zäöüß\s]+)/gi,
          // Paragraph references
          /(§\s*\d+(?:\s+Abs\.\s*\d+)?(?:\s+[A-Z]+)?)/g,
        ],
      ],
      [
        'TOPIC',
        [
          // Explicit topic markers
          /(?:Thema|Betreff|Subject):\s*([A-ZÄÖÜ][a-zäöüß\s,]+)/gi,
          // Keywords
          /(?:betreffend|bezüglich|hinsichtlich)\s+([A-ZÄÖÜ][a-zäöüß\s]+)/gi,
        ],
      ],
    ]);
  }

  /**
   * Extract entities using regex patterns
   */
  private extractWithPatterns(
    documentId: string,
    block: ContentBlockLike
  ): Entity[] {
    const entities: Entity[] = [];
    const text = block.content;
    const blockId = block.id || uuidv4();

    for (const [entityType, patterns] of this.patterns) {
      for (const pattern of patterns) {
        // Reset regex state
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(text)) !== null) {
          const entityText = (match[1] || match[0]).trim();

          // Skip very short or very long matches
          if (entityText.length < 2 || entityText.length > 100) continue;

          // Check if entity already exists
          const existing = entities.find(
            (e) =>
              e.type === entityType &&
              (e.text === entityText ||
                e.canonicalForm === this.normalize(entityText) ||
                e.aliases.includes(entityText))
          );

          const occurrence: EntityOccurrence = {
            documentId,
            chunkId: blockId,
            position: match.index,
            context: text.substring(
              Math.max(0, match.index - 50),
              Math.min(text.length, match.index + entityText.length + 50)
            ),
          };

          if (existing) {
            existing.occurrences.push(occurrence);
          } else {
            entities.push({
              id: uuidv4(),
              type: entityType,
              text: entityText,
              canonicalForm: this.normalize(entityText),
              aliases: [],
              confidence: 0.8,
              occurrences: [occurrence],
              metadata: { extractionMethod: 'pattern' },
            });
          }
        }
      }
    }

    return entities;
  }

  /**
   * Extract entities using LLM (Ollama)
   */
  private async extractWithLLM(
    documentId: string,
    block: ContentBlockLike
  ): Promise<{
    entities: Entity[];
    relationships: Relationship[];
  }> {
    const blockId = block.id || uuidv4();
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

    const prompt = `
Extrahiere Entitäten und Beziehungen aus folgendem deutschen Text.

Text:
${block.content.substring(0, 2000)}

Antworte NUR im JSON-Format ohne zusätzlichen Text:
{
  "entities": [
    {"type": "PERSON|ORGANIZATION|PROJECT|PRODUCT|LOCATION|DATE|REGULATION|TOPIC", "text": "...", "confidence": 0.9}
  ],
  "relationships": [
    {"source": "...", "target": "...", "type": "WORKS_FOR|MANAGES|CREATED|MENTIONS|REFERENCES|ABOUT|PART_OF|REPORTS_TO|COLLABORATES_WITH|APPROVED_BY", "evidence": "..."}
  ]
}
`;

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.llmModel,
          prompt,
          format: 'json',
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 1000,
          },
        }),
      });

      if (!response.ok) {
        console.error(`LLM extraction failed: ${response.status}`);
        return { entities: [], relationships: [] };
      }

      const result = await response.json();
      const parsed = JSON.parse(result.response);

      const entities: Entity[] = (parsed.entities || [])
        .filter((e: { confidence?: number }) => (e.confidence || 0.7) >= this.config.confidenceThreshold)
        .slice(0, this.config.maxEntitiesPerChunk)
        .map((e: { type: string; text: string; confidence?: number }) => ({
          id: uuidv4(),
          type: e.type as EntityType,
          text: e.text,
          canonicalForm: this.normalize(e.text),
          aliases: [],
          confidence: e.confidence || 0.7,
          occurrences: [
            {
              documentId,
              chunkId: blockId,
              position: block.content.indexOf(e.text),
              context: e.text,
            },
          ],
          metadata: { extractionMethod: 'llm' },
        }));

      const relationships: Relationship[] = (parsed.relationships || []).map(
        (r: { source: string; target: string; type: string; evidence: string }) => ({
          id: uuidv4(),
          sourceEntityId: '', // Will be resolved later
          targetEntityId: '',
          type: r.type as RelationType,
          confidence: 0.7,
          evidence: r.evidence,
          documentId,
          extractionMethod: 'llm' as const,
        })
      );

      return { entities, relationships };
    } catch (error) {
      console.error('LLM extraction failed:', error);
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Extract relationships from entity co-occurrences
   */
  private extractCooccurrenceRelationships(
    entities: Entity[],
    blocks: ContentBlockLike[]
  ): Relationship[] {
    const relationships: Relationship[] = [];

    // Find entities that appear in the same block
    for (const block of blocks) {
      const blockId = block.id || '';
      const blockEntities = entities.filter((e) =>
        e.occurrences.some((o) => o.chunkId === blockId)
      );

      // Create relationships for co-occurring entities
      for (let i = 0; i < blockEntities.length; i++) {
        for (let j = i + 1; j < blockEntities.length; j++) {
          const e1 = blockEntities[i];
          const e2 = blockEntities[j];

          // Infer relationship type based on entity types
          const relType = this.inferRelationshipType(e1.type, e2.type);

          if (relType) {
            relationships.push({
              id: uuidv4(),
              sourceEntityId: e1.id,
              targetEntityId: e2.id,
              type: relType,
              confidence: 0.5,
              evidence: block.content.substring(0, 200),
              documentId: e1.occurrences[0].documentId,
              extractionMethod: 'pattern',
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Infer relationship type based on entity type combinations
   */
  private inferRelationshipType(
    type1: EntityType,
    type2: EntityType
  ): RelationType | null {
    const rules: Record<string, RelationType> = {
      'PERSON-ORGANIZATION': 'WORKS_FOR',
      'PERSON-PROJECT': 'MANAGES',
      'DOCUMENT-TOPIC': 'ABOUT',
      'PROJECT-PRODUCT': 'PART_OF',
      'PERSON-PERSON': 'COLLABORATES_WITH',
      'ORGANIZATION-PROJECT': 'CREATED',
      'ORGANIZATION-PRODUCT': 'CREATED',
      'DOCUMENT-REGULATION': 'REFERENCES',
    };

    const key1 = `${type1}-${type2}`;
    const key2 = `${type2}-${type1}`;

    return rules[key1] || rules[key2] || null;
  }

  /**
   * Basic deduplication before full resolution
   */
  private basicDeduplication(entities: Entity[]): Entity[] {
    const seen = new Map<string, Entity>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.canonicalForm}`;

      if (seen.has(key)) {
        // Merge occurrences
        const existing = seen.get(key)!;
        existing.occurrences.push(...entity.occurrences);
        existing.confidence = Math.max(existing.confidence, entity.confidence);
      } else {
        seen.set(key, entity);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Normalize text for canonical form
   */
  private normalize(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\säöüß]/g, '');
  }
}
