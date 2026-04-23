/**
 * Text Chunking Utilities
 */

export interface TextChunk {
  id: string;
  text: string;
  index: number;
}

export interface MergeResult {
  mergedText: string;
  stats: {
    totalCorrections: number;
    avgConfidence: number;
  };
}

/**
 * Splits text into chunks based on a maximum length
 */
export const splitTextIntoChunks = (
  text: string,
  options: { maxChunkSize: number; preferSentenceBoundary?: boolean }
): TextChunk[] => {
  if (!text) return [];
  if (text.length <= options.maxChunkSize) {
    return [{ id: 'chunk-0', text, index: 0 }];
  }

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  const sentences = text.split(/(?<=[。！？.!?])/g);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > options.maxChunkSize) {
      if (currentChunk) {
        chunks.push({ id: `chunk-${chunkIndex++}`, text: currentChunk, index: chunkIndex - 1 });
      }
      if (sentence.length > options.maxChunkSize) {
        let remaining = sentence;
        while (remaining.length > 0) {
          chunks.push({
            id: `chunk-${chunkIndex++}`,
            text: remaining.substring(0, options.maxChunkSize),
            index: chunkIndex - 1,
          });
          remaining = remaining.substring(options.maxChunkSize);
        }
        currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push({ id: `chunk-${chunkIndex++}`, text: currentChunk, index: chunkIndex - 1 });
  }
  return chunks;
};

/**
 * Merges chunked text correction results
 */
export const mergeChunkResults = (
  originalText: string,
  _chunks: TextChunk[],
  results: any[]
): MergeResult => {
  const mergedText = results.map((r) => r.correctedText || '').join('');
  const totalCorrections = results.filter((r) => r.hasCorrections).length;
  const avgConfidence =
    results.reduce((acc, r) => acc + (r.confidence || 0), 0) / (results.length || 1);

  return {
    mergedText: mergedText || originalText,
    stats: {
      totalCorrections,
      avgConfidence,
    },
  };
};
