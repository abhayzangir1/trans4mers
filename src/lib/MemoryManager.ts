import { ai } from './genkit';
import { prisma } from './db';

export class MemoryManager {
  /**
   * Generates embeddings and strictly stores them using raw SQL
   * because Prisma cannot natively insert into Unsupported("vector") columns.
   */
  static async storeMemory(content: string): Promise<void> {
    if (!content || content.trim().length === 0) {
      throw new Error('Memory content cannot be empty');
    }

    // Explicit Embedding Generation using Genkit Vertex AI
    const embeddingResponse = await ai.embed({
      embedder: 'vertexai/text-embedding-004',
      content: content,
    });

    const embedding = embeddingResponse[0]?.embedding;
    if (!embedding || embedding.length !== 768) {
      throw new Error('Failed to generate 768-dimensional embedding');
    }

    // Raw Vector Insert
    // Must cast the array string to vector explicitly
    const embeddingVectorStr = `[${embedding.join(',')}]`;

    await prisma.$executeRaw`
      INSERT INTO "MemoryBank" ("id", "content", "embedding", "createdAt")
      VALUES (
        gen_random_uuid(),
        ${content},
        ${embeddingVectorStr}::vector,
        NOW()
      )
    `;
  }

  /**
   * Retrieves semantically similar memories.
   */
  static async searchMemory(query: string, limit: number = 5): Promise<{ id: string; content: string }[]> {
    const embeddingResponse = await ai.embed({
      embedder: 'vertexai/text-embedding-004',
      content: query,
    });

    const embedding = embeddingResponse[0]?.embedding;
    if (!embedding) throw new Error('Search embedding generation failed');
    const embeddingVectorStr = `[${embedding.join(',')}]`;

    interface MemoryRow {
      id: string;
      content: string;
    }

    const results = await prisma.$queryRaw`
      SELECT id, content
      FROM "MemoryBank"
      ORDER BY "embedding" <-> ${embeddingVectorStr}::vector
      LIMIT ${limit}
    ` as MemoryRow[];

    return results.map(row => ({
      id: row.id,
      content: row.content,
    }));
  }
}
