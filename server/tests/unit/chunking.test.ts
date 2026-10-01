import { describe, it, expect } from 'vitest';
import { chunkMarkdownDocument } from '../../src/services/rules/chunking';

describe('Markdown Chunking for RAG Embeddings', () => {
  it('splits markdown text into logical chunks based on headings', () => {
    const markdown = `# Introduction
The university fosters an inclusive environment.

## Curfew Regulations
Hostel gates close at 10:00 PM on weekdays and 10:30 PM on weekends.
Late entry passes must be obtained from the warden.

## Disciplinary Action
Violations will result in parental notification.`;

    const chunks = chunkMarkdownDocument('Hostel Code', markdown);

    expect(chunks.length).toBe(3);
    expect(chunks[0].sectionLabel).toBe('Hostel Code › Introduction');
    expect(chunks[0].chunkText).toContain('inclusive environment');

    expect(chunks[1].sectionLabel).toBe('Hostel Code › Curfew Regulations');
    expect(chunks[1].chunkText).toContain('10:00 PM on weekdays');

    expect(chunks[2].sectionLabel).toBe('Hostel Code › Disciplinary Action');
    expect(chunks[2].chunkText).toContain('parental notification');
  });

  it('handles markdown without headings by providing a default label', () => {
    const rawText = 'All campus visitors must register at the main security post with government photo identification.';
    const chunks = chunkMarkdownDocument('Visitor Policy', rawText);

    expect(chunks.length).toBe(1);
    expect(chunks[0].sectionLabel).toBe('Visitor Policy › General Provisions');
    expect(chunks[0].chunkText).toBe(rawText);
  });
});
