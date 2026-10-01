import { prisma } from '../../lib/prisma';
import { getAIProvider } from '../ai/provider';

export interface RuleChunkItem {
  sectionLabel: string;
  chunkText: string;
}

/**
 * Splits a markdown document into structured chunks based on markdown headings
 */
export function chunkMarkdownDocument(title: string, markdown: string): RuleChunkItem[] {
  const lines = markdown.split('\n');
  const chunks: RuleChunkItem[] = [];

  let currentHeading = 'General Provisions';
  let currentBuffer: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      if (currentBuffer.length > 0) {
        const text = currentBuffer.join('\n').trim();
        if (text) {
          chunks.push({
            sectionLabel: `${title} › ${currentHeading}`,
            chunkText: text,
          });
        }
        currentBuffer = [];
      }
      currentHeading = headingMatch[2].trim();
    } else {
      currentBuffer.push(line);
    }
  }

  if (currentBuffer.length > 0) {
    const text = currentBuffer.join('\n').trim();
    if (text) {
      chunks.push({
        sectionLabel: `${title} › ${currentHeading}`,
        chunkText: text,
      });
    }
  }

  // Fallback if no headings existed
  if (chunks.length === 0 && markdown.trim()) {
    chunks.push({
      sectionLabel: `${title} › Full Document`,
      chunkText: markdown.trim(),
    });
  }

  return chunks;
}

/**
 * Ingests and chunks a rule document in the database
 */
export async function ingestRuleChunks(ruleId: string, title: string, markdown: string, version: number) {
  const chunks = chunkMarkdownDocument(title, markdown);

  // Remove existing chunks for this rule
  await prisma.ruleChunk.deleteMany({
    where: { ruleId },
  });

  // Create new chunks
  const createdChunks = await Promise.all(
    chunks.map((c) =>
      prisma.ruleChunk.create({
        data: {
          ruleId,
          version,
          sectionLabel: c.sectionLabel,
          chunkText: c.chunkText,
        },
      })
    )
  );

  return createdChunks;
}
