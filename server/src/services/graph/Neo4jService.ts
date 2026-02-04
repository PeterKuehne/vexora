/**
 * Neo4j Graph Service
 * Part of RAG V2 Phase 4: Intelligence & Production
 *
 * Neo4j 5.26 LTS + neo4j-driver 6.x
 */

import neo4j from 'neo4j-driver';
import type { Driver, Session } from 'neo4j-driver';
import {
  Entity,
  Relationship,
  GraphNode,
  GraphEdge,
  GraphTraversalRequest,
  GraphTraversalResult,
  Neo4jConfig,
  DEFAULT_NEO4J_CONFIG,
} from '../../types/graph.js';

export class Neo4jService {
  private driver: Driver | null = null;
  private initialized = false;
  private config: Neo4jConfig;

  constructor(config: Partial<Neo4jConfig> & { uri: string; username: string; password: string }) {
    this.config = {
      ...DEFAULT_NEO4J_CONFIG,
      ...config,
    } as Neo4jConfig;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // neo4j-driver 6.x connection
    this.driver = neo4j.driver(
      this.config.uri,
      neo4j.auth.basic(this.config.username, this.config.password),
      {
        maxConnectionPoolSize: this.config.maxConnectionPoolSize,
        connectionAcquisitionTimeout: this.config.connectionAcquisitionTimeout,
        logging: {
          level: 'info',
          logger: (level: string, message: string) => console.log(`[Neo4j ${level}] ${message}`),
        },
      }
    );

    // Verify connection with server info
    const serverInfo = await this.driver.getServerInfo();
    console.log(`Neo4j connected: ${serverInfo.address} (${serverInfo.agent})`);

    // Create session with explicit database
    const session = this.getSession();
    try {
      await session.run('RETURN 1');
      this.initialized = true;

      // Create indexes
      await this.createIndexes(session);
    } finally {
      await session.close();
    }
  }

  /**
   * Get a session with proper database context (neo4j-driver 6.x)
   */
  private getSession(): Session {
    if (!this.driver) throw new Error('Driver not initialized');
    return this.driver.session({ database: this.config.database });
  }

  private async createIndexes(session: Session): Promise<void> {
    const indexes = [
      'CREATE INDEX entity_id IF NOT EXISTS FOR (e:Entity) ON (e.id)',
      'CREATE INDEX entity_canonical IF NOT EXISTS FOR (e:Entity) ON (e.canonicalForm)',
      'CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)',
      'CREATE INDEX document_id IF NOT EXISTS FOR (d:Document) ON (d.id)',
      'CREATE INDEX chunk_id IF NOT EXISTS FOR (c:Chunk) ON (c.id)',
    ];

    for (const index of indexes) {
      try {
        await session.run(index);
      } catch {
        // Index might already exist
        console.log(`Index creation skipped (may exist): ${index.substring(0, 50)}...`);
      }
    }
    console.log('Neo4j indexes verified');
  }

  async storeEntity(entity: Entity): Promise<void> {
    const session = this.getSession();
    try {
      // Store entity with dynamic label based on type
      await session.run(
        `
        MERGE (e:Entity:${entity.type} {id: $id})
        SET e.text = $text,
            e.canonicalForm = $canonicalForm,
            e.aliases = $aliases,
            e.confidence = $confidence,
            e.updatedAt = datetime()
        `,
        {
          id: entity.id,
          text: entity.text,
          canonicalForm: entity.canonicalForm,
          aliases: entity.aliases,
          confidence: entity.confidence,
        }
      );

      // Link to documents and chunks
      for (const occurrence of entity.occurrences) {
        await session.run(
          `
          MATCH (e:Entity {id: $entityId})
          MERGE (d:Document {id: $documentId})
          MERGE (c:Chunk {id: $chunkId})
          MERGE (e)-[:MENTIONED_IN {position: $position}]->(c)
          MERGE (c)-[:PART_OF]->(d)
          `,
          {
            entityId: entity.id,
            documentId: occurrence.documentId,
            chunkId: occurrence.chunkId,
            position: occurrence.position,
          }
        );
      }
    } finally {
      await session.close();
    }
  }

  async storeEntities(entities: Entity[]): Promise<number> {
    const session = this.getSession();
    let stored = 0;

    try {
      // Batch store entities using UNWIND for efficiency
      const entityData = entities.map((e) => ({
        id: e.id,
        type: e.type,
        text: e.text,
        canonicalForm: e.canonicalForm,
        aliases: e.aliases,
        confidence: e.confidence,
      }));

      await session.run(
        `
        UNWIND $entities AS entity
        MERGE (e:Entity {id: entity.id})
        SET e.type = entity.type,
            e.text = entity.text,
            e.canonicalForm = entity.canonicalForm,
            e.aliases = entity.aliases,
            e.confidence = entity.confidence,
            e.updatedAt = datetime()
        WITH e, entity
        CALL apoc.create.addLabels(e, [entity.type]) YIELD node
        RETURN count(node) as count
        `,
        { entities: entityData }
      );

      stored = entities.length;

      // Store occurrences in batch
      const occurrenceData = entities.flatMap((e) =>
        e.occurrences.map((o) => ({
          entityId: e.id,
          documentId: o.documentId,
          chunkId: o.chunkId,
          position: o.position,
        }))
      );

      if (occurrenceData.length > 0) {
        await session.run(
          `
          UNWIND $occurrences AS occ
          MATCH (e:Entity {id: occ.entityId})
          MERGE (d:Document {id: occ.documentId})
          MERGE (c:Chunk {id: occ.chunkId})
          MERGE (e)-[:MENTIONED_IN {position: occ.position}]->(c)
          MERGE (c)-[:PART_OF]->(d)
          `,
          { occurrences: occurrenceData }
        );
      }
    } finally {
      await session.close();
    }

    return stored;
  }

  async storeRelationship(rel: Relationship): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (source:Entity {id: $sourceId})
        MATCH (target:Entity {id: $targetId})
        MERGE (source)-[r:${rel.type} {id: $relId}]->(target)
        SET r.confidence = $confidence,
            r.evidence = $evidence,
            r.documentId = $documentId,
            r.extractionMethod = $extractionMethod,
            r.createdAt = datetime()
        `,
        {
          sourceId: rel.sourceEntityId,
          targetId: rel.targetEntityId,
          relId: rel.id,
          confidence: rel.confidence,
          evidence: rel.evidence,
          documentId: rel.documentId,
          extractionMethod: rel.extractionMethod,
        }
      );
    } finally {
      await session.close();
    }
  }

  async storeRelationships(relationships: Relationship[]): Promise<number> {
    if (relationships.length === 0) return 0;

    const session = this.getSession();
    let stored = 0;

    try {
      // Group relationships by type for batch processing
      const byType = new Map<string, Relationship[]>();
      for (const rel of relationships) {
        const group = byType.get(rel.type) || [];
        group.push(rel);
        byType.set(rel.type, group);
      }

      for (const [relType, rels] of byType) {
        const relData = rels.map((r) => ({
          sourceId: r.sourceEntityId,
          targetId: r.targetEntityId,
          relId: r.id,
          confidence: r.confidence,
          evidence: r.evidence,
          documentId: r.documentId,
          extractionMethod: r.extractionMethod,
        }));

        await session.run(
          `
          UNWIND $rels AS rel
          MATCH (source:Entity {id: rel.sourceId})
          MATCH (target:Entity {id: rel.targetId})
          MERGE (source)-[r:${relType} {id: rel.relId}]->(target)
          SET r.confidence = rel.confidence,
              r.evidence = rel.evidence,
              r.documentId = rel.documentId,
              r.extractionMethod = rel.extractionMethod,
              r.createdAt = datetime()
          `,
          { rels: relData }
        );

        stored += rels.length;
      }
    } finally {
      await session.close();
    }

    return stored;
  }

  async traverse(request: GraphTraversalRequest): Promise<GraphTraversalResult> {
    const session = this.getSession();
    try {
      let query: string;
      let params: Record<string, unknown>;

      switch (request.strategy) {
        case 'neighborhood':
          // Use APOC path expansion for neighborhood traversal
          query = `
            MATCH (start:Entity)
            WHERE start.canonicalForm IN $startEntities OR start.text IN $startEntities
            CALL apoc.path.expandConfig(start, {
              maxLevel: $maxDepth,
              limit: $maxNodes,
              uniqueness: 'NODE_GLOBAL'
              ${request.relationshipTypes ? `, relationshipFilter: '${request.relationshipTypes.join('|')}'` : ''}
            })
            YIELD path
            WITH collect(path) AS paths
            WITH apoc.coll.toSet(apoc.coll.flatten([p IN paths | nodes(p)])) AS nodes,
                 apoc.coll.toSet(apoc.coll.flatten([p IN paths | relationships(p)])) AS relationships
            RETURN nodes, relationships
          `;
          params = {
            startEntities: request.startEntities,
            maxDepth: request.maxDepth,
            maxNodes: request.maxNodes,
          };
          break;

        case 'shortest_path':
          if (request.startEntities.length < 2) {
            return { nodes: [], edges: [], chunkIds: [], naturalLanguageSummary: '' };
          }
          query = `
            MATCH (start:Entity), (end:Entity)
            WHERE start.canonicalForm = $start AND end.canonicalForm = $end
            MATCH path = shortestPath((start)-[*..${request.maxDepth}]-(end))
            RETURN nodes(path) as nodes, relationships(path) as relationships
          `;
          params = {
            start: request.startEntities[0],
            end: request.startEntities[1],
          };
          break;

        case 'community':
        default:
          query = `
            MATCH (e:Entity)-[r]-(connected)
            WHERE e.canonicalForm IN $startEntities OR e.text IN $startEntities
            RETURN e, r, connected
            LIMIT $maxNodes
          `;
          params = {
            startEntities: request.startEntities,
            maxNodes: request.maxNodes,
          };
      }

      const result = await session.run(query, params);

      // Extract nodes and edges
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const chunkIds = new Set<string>();
      const nodeIds = new Set<string>();

      for (const record of result.records) {
        const recordNodes = record.get('nodes') || [];
        const recordRels = record.get('relationships') || [];

        for (const node of recordNodes) {
          if (!nodeIds.has(node.identity.toString())) {
            nodeIds.add(node.identity.toString());
            nodes.push({
              id: node.properties.id,
              labels: node.labels,
              properties: node.properties,
            });
          }
        }

        for (const rel of recordRels) {
          edges.push({
            id: rel.properties?.id || rel.identity.toString(),
            type: rel.type,
            sourceId: rel.start.toString(),
            targetId: rel.end.toString(),
            properties: rel.properties || {},
          });
        }
      }

      // Get chunk IDs for entities
      for (const node of nodes) {
        if (node.labels.includes('Chunk')) {
          chunkIds.add(node.properties.id as string);
        }
      }

      // Generate summary
      const summary = this.generateSummary(nodes, edges);

      return {
        nodes,
        edges,
        chunkIds: Array.from(chunkIds),
        naturalLanguageSummary: summary,
      };
    } finally {
      await session.close();
    }
  }

  async findEntitiesByText(texts: string[]): Promise<Entity[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (e:Entity)
        WHERE e.canonicalForm IN $texts OR e.text IN $texts
           OR ANY(alias IN e.aliases WHERE alias IN $texts)
        RETURN e
        `,
        { texts: texts.map((t) => t.toLowerCase()) }
      );

      return result.records.map((record) => {
        const node = record.get('e');
        return {
          id: node.properties.id,
          type: node.labels.find((l: string) => l !== 'Entity'),
          text: node.properties.text,
          canonicalForm: node.properties.canonicalForm,
          aliases: node.properties.aliases || [],
          confidence: node.properties.confidence,
          occurrences: [],
          metadata: {},
        };
      });
    } finally {
      await session.close();
    }
  }

  async findEntitiesByDocument(documentId: string): Promise<Entity[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (e:Entity)-[:MENTIONED_IN]->(c:Chunk)-[:PART_OF]->(d:Document {id: $documentId})
        RETURN DISTINCT e
        `,
        { documentId }
      );

      return result.records.map((record) => {
        const node = record.get('e');
        return {
          id: node.properties.id,
          type: node.labels.find((l: string) => l !== 'Entity'),
          text: node.properties.text,
          canonicalForm: node.properties.canonicalForm,
          aliases: node.properties.aliases || [],
          confidence: node.properties.confidence,
          occurrences: [],
          metadata: {},
        };
      });
    } finally {
      await session.close();
    }
  }

  async deleteDocumentEntities(documentId: string): Promise<number> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (d:Document {id: $documentId})<-[:PART_OF]-(c:Chunk)
        MATCH (c)<-[:MENTIONED_IN]-(e:Entity)
        DETACH DELETE c
        WITH e
        WHERE NOT (e)-[:MENTIONED_IN]->()
        DETACH DELETE e
        RETURN count(e) as deleted
        `,
        { documentId }
      );

      return result.records[0]?.get('deleted')?.toNumber() || 0;
    } finally {
      await session.close();
    }
  }

  async getStats(): Promise<{
    entityCount: number;
    relationshipCount: number;
    documentCount: number;
    chunkCount: number;
    entityTypes: Record<string, number>;
  }> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (e:Entity)
        WITH count(e) as entityCount, collect(labels(e)) as allLabels
        MATCH ()-[r]->()
        WITH entityCount, allLabels, count(r) as relCount
        MATCH (d:Document)
        WITH entityCount, allLabels, relCount, count(d) as docCount
        MATCH (c:Chunk)
        RETURN entityCount, relCount, docCount, count(c) as chunkCount, allLabels
      `);

      const record = result.records[0];
      const allLabels = record?.get('allLabels') || [];

      // Count entity types
      const entityTypes: Record<string, number> = {};
      for (const labels of allLabels) {
        for (const label of labels) {
          if (label !== 'Entity') {
            entityTypes[label] = (entityTypes[label] || 0) + 1;
          }
        }
      }

      return {
        entityCount: record?.get('entityCount')?.toNumber() || 0,
        relationshipCount: record?.get('relCount')?.toNumber() || 0,
        documentCount: record?.get('docCount')?.toNumber() || 0,
        chunkCount: record?.get('chunkCount')?.toNumber() || 0,
        entityTypes,
      };
    } finally {
      await session.close();
    }
  }

  private generateSummary(nodes: GraphNode[], edges: GraphEdge[]): string {
    const entityCount = nodes.filter((n) => n.labels.includes('Entity')).length;
    const relCount = edges.length;

    const entityTypes = new Set(
      nodes.filter((n) => n.labels.includes('Entity')).flatMap((n) => n.labels)
    );
    entityTypes.delete('Entity');

    const relTypes = new Set(edges.map((e) => e.type));

    if (entityCount === 0) {
      return 'Keine Entitäten gefunden.';
    }

    return `Graph mit ${entityCount} Entitäten (${Array.from(entityTypes).join(', ')}) und ${relCount} Beziehungen (${Array.from(relTypes).join(', ')}).`;
  }

  async healthCheck(): Promise<{ healthy: boolean; version: string; address: string }> {
    try {
      if (!this.driver) {
        return { healthy: false, version: 'unknown', address: 'not connected' };
      }
      const serverInfo = await this.driver.getServerInfo();
      return {
        healthy: true,
        version: serverInfo.agent || 'unknown',
        address: serverInfo.address || 'unknown',
      };
    } catch (error) {
      return { healthy: false, version: 'error', address: 'connection failed' };
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.initialized = false;
    }
  }
}
