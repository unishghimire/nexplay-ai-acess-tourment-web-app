import assert from "node:assert/strict";
import { ChunkProcessingError, FIRESTORE_SAFE_BATCH_SIZE, chunkItems, processInChunks } from "./batchedWrites.js";

assert.equal(chunkItems(Array.from({ length: FIRESTORE_SAFE_BATCH_SIZE - 1 }), FIRESTORE_SAFE_BATCH_SIZE).length, 1);
assert.equal(chunkItems(Array.from({ length: FIRESTORE_SAFE_BATCH_SIZE }), FIRESTORE_SAFE_BATCH_SIZE).length, 1);
assert.deepEqual(chunkItems(Array.from({ length: FIRESTORE_SAFE_BATCH_SIZE + 1 }), FIRESTORE_SAFE_BATCH_SIZE).map(chunk => chunk.length), [FIRESTORE_SAFE_BATCH_SIZE, 1]);

const writes = Array.from({ length: FIRESTORE_SAFE_BATCH_SIZE + 2 }, (_, index) => index);
const committed = new Set<number>();
let failedOnce = false;
let completedItems = 0;
try {
  await processInChunks(writes, async (chunk, index) => {
    if (index === 1 && !failedOnce) {
      failedOnce = true;
      throw new Error('temporary failure');
    }
    chunk.forEach(value => committed.add(value));
  });
} catch (error) {
  assert.ok(error instanceof ChunkProcessingError);
  completedItems = error.progress.completedItems;
  assert.equal(completedItems, FIRESTORE_SAFE_BATCH_SIZE);
}
await processInChunks(writes.slice(completedItems), async chunk => {
  chunk.forEach(value => committed.add(value));
});
assert.equal(committed.size, writes.length);

console.log('Batched write tests: 5 passed, 0 failed');
