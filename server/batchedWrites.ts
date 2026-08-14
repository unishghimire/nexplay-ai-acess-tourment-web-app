export const FIRESTORE_SAFE_BATCH_SIZE = 450;

export type ChunkResult = {
  completedChunks: number;
  completedItems: number;
  totalChunks: number;
};

export class ChunkProcessingError extends Error {
  constructor(message: string, readonly progress: ChunkResult, readonly cause?: unknown) {
    super(message);
    this.name = 'ChunkProcessingError';
  }
}

export function chunkItems<T>(items: readonly T[], chunkSize = FIRESTORE_SAFE_BATCH_SIZE): T[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 500) {
    throw new Error('Chunk size must be an integer between 1 and 500');
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function processInChunks<T>(
  items: readonly T[],
  processChunk: (items: readonly T[], chunkIndex: number) => Promise<void>,
  chunkSize = FIRESTORE_SAFE_BATCH_SIZE,
): Promise<ChunkResult> {
  const chunks = chunkItems(items, chunkSize);
  const progress: ChunkResult = { completedChunks: 0, completedItems: 0, totalChunks: chunks.length };

  for (const [index, chunk] of chunks.entries()) {
    try {
      await processChunk(chunk, index);
      progress.completedChunks++;
      progress.completedItems += chunk.length;
    } catch (error) {
      throw new ChunkProcessingError(`Chunk ${index + 1} of ${chunks.length} failed`, { ...progress }, error);
    }
  }
  return progress;
}

type CommittableBatch = { commit: () => Promise<unknown> };

export async function commitBatchedWrites<TBatch extends CommittableBatch>(
  createBatch: () => TBatch,
  operations: ReadonlyArray<(batch: TBatch) => void>,
): Promise<ChunkResult> {
  return processInChunks(operations, async chunk => {
    const batch = createBatch();
    chunk.forEach(operation => operation(batch));
    await batch.commit();
  });
}
