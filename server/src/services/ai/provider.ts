import { GoogleGenerativeAI } from '@google/generative-ai';
import { ZodSchema } from 'zod';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProvider {
  generateJSON<T>(opts: { system: string; input: string; schema: ZodSchema<T> }): Promise<T>;
  chatStream(opts: { system: string; messages: ChatMessage[]; context?: string[] }): AsyncIterable<string>;
  chat(opts: { system: string; messages: ChatMessage[]; context?: string[] }): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * Deterministic pseudo-embedding generator for Mock Provider
 * Generates normalized 768-dimensional vectors from text hash
 */
function generateDeterministicEmbedding(text: string, dimensions = 768): number[] {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  const vector: number[] = [];
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    const val = Math.sin(hash + i * 1.61803398875);
    vector.push(val);
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq) || 1;
  return vector.map((v) => v / norm);
}

/**
 * Mock AI Provider for testing and offline development
 */
export class MockAIProvider implements AIProvider {
  async generateJSON<T>(opts: { system: string; input: string; schema: ZodSchema<T> }): Promise<T> {
    const inputLower = opts.input.toLowerCase();

    // Default mock response structure for analysis if schema matches
    const mockAnalysis = {
      summary: `Automated summary: Report regarding ${opts.input.slice(0, 40)}...`,
      category: inputLower.includes('rag') ? 'Ragging & Harassment' : 'Campus Infrastructure',
      severity_score: inputLower.includes('urgent') || inputLower.includes('danger') ? 9 : 4,
      priority: inputLower.includes('urgent') || inputLower.includes('danger') ? 'CRITICAL' : 'MEDIUM',
      urgency_signals: inputLower.includes('danger') ? ['SAFETY_THREAT'] : [],
      spam_probability: inputLower.includes('viagra') || inputLower.includes('click here') ? 0.95 : 0.05,
      anomaly_flags: inputLower.includes('test test test') ? ['REPETITIVE_TEXT'] : [],
      reasoning: 'Evaluated deterministically by Mock AI Provider based on keyword signals.',
    };

    try {
      return opts.schema.parse(mockAnalysis);
    } catch {
      // Fallback for custom schemas
      return opts.schema.parse({});
    }
  }

  async *chatStream(opts: { system: string; messages: ChatMessage[]; context?: string[] }): AsyncIterable<string> {
    const reply = await this.chat(opts);
    const tokens = reply.split(' ');
    for (const token of tokens) {
      yield token + ' ';
    }
  }

  async chat(opts: { system: string; messages: ChatMessage[]; context?: string[] }): Promise<string> {
    const lastUserMsg = opts.messages.filter((m) => m.role === 'user').pop()?.content || '';
    const lastLower = lastUserMsg.toLowerCase();

    if (opts.context && opts.context.length > 0) {
      // Check if context contains relevant information
      const hasMatch = opts.context.some((ctx) =>
        lastLower.split(' ').some((word) => word.length > 3 && ctx.toLowerCase().includes(word))
      );

      if (hasMatch) {
        return `Based on official university policy: ${opts.context[0].slice(0, 200)}...\n\nCitation: [Campus Regulations › Disciplinary Mandate].`;
      }
    }

    if (lastLower.includes('ragging') || lastLower.includes('bully')) {
      return `According to the University Anti-Ragging Code of Conduct: Any act of ragging is strictly prohibited with zero tolerance. Repercussions include immediate suspension and statutory reporting.\n\nCitation: [University Anti-Ragging Code of Conduct › Zero Tolerance Mandate]`;
    }

    if (lastLower.includes('hostel') || lastLower.includes('gate') || lastLower.includes('curfew')) {
      return `University hostel regulations stipulate standard entry timings. Please consult the Warden Office for late entry passes.\n\nCitation: [Hostel Rules & Regulations › Gate Timing]`;
    }

    return `I could not find an official campus policy directly addressing your query. If you are experiencing an unresolved issue, you can file a confidential report with the administration.\n\nCitation: [Campus Regulations › General Inquiries]`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => generateDeterministicEmbedding(t));
  }
}

/**
 * Real Gemini API Provider
 */
export class GeminiAIProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private textModel: string;
  private embedModel: string;

  constructor(apiKey: string, textModel = 'gemini-1.5-flash', embedModel = 'text-embedding-004') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.textModel = process.env.GEMINI_MODEL || textModel;
    this.embedModel = process.env.GEMINI_EMBED_MODEL || embedModel;
  }

  async generateJSON<T>(opts: { system: string; input: string; schema: ZodSchema<T> }): Promise<T> {
    const model = this.genAI.getGenerativeModel({
      model: this.textModel,
      generationConfig: { responseMimeType: 'application/json' },
      systemInstruction: opts.system,
    });

    const result = await model.generateContent(opts.input);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return opts.schema.parse(parsed);
  }

  async *chatStream(opts: { system: string; messages: ChatMessage[]; context?: string[] }): AsyncIterable<string> {
    let contextBlock = '';
    if (opts.context && opts.context.length > 0) {
      contextBlock = `\n\nOFFICIAL RULES CONTEXT:\n${opts.context.join('\n\n---\n\n')}\n\n`;
    }

    const systemWithContext = opts.system + contextBlock;
    const model = this.genAI.getGenerativeModel({
      model: this.textModel,
      systemInstruction: systemWithContext,
    });

    const history = opts.messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMsg = opts.messages[opts.messages.length - 1];
    const chatSession = model.startChat({ history });
    const responseStream = await chatSession.sendMessageStream(lastMsg.content);

    for await (const chunk of responseStream.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  async chat(opts: { system: string; messages: ChatMessage[]; context?: string[] }): Promise<string> {
    let contextBlock = '';
    if (opts.context && opts.context.length > 0) {
      contextBlock = `\n\nOFFICIAL RULES CONTEXT:\n${opts.context.join('\n\n---\n\n')}\n\n`;
    }

    const systemWithContext = opts.system + contextBlock;
    const model = this.genAI.getGenerativeModel({
      model: this.textModel,
      systemInstruction: systemWithContext,
    });

    const history = opts.messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMsg = opts.messages[opts.messages.length - 1];
    const chatSession = model.startChat({ history });
    const result = await chatSession.sendMessage(lastMsg.content);
    return result.response.text();
  }

  async embed(texts: string[]): Promise<number[][]> {
    const model = this.genAI.getGenerativeModel({ model: this.embedModel });
    const embeddings: number[][] = [];

    for (const text of texts) {
      const res = await model.embedContent(text);
      if (res.embedding?.values) {
        embeddings.push(res.embedding.values);
      } else {
        // Fallback to deterministic pseudo-vector if API returns null
        embeddings.push(generateDeterministicEmbedding(text));
      }
    }

    return embeddings;
  }
}

let activeProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (activeProvider) return activeProvider;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey && process.env.NODE_ENV !== 'test' && !process.env.USE_MOCK_AI) {
    try {
      activeProvider = new GeminiAIProvider(apiKey);
      return activeProvider;
    } catch {
      activeProvider = new MockAIProvider();
      return activeProvider;
    }
  }

  activeProvider = new MockAIProvider();
  return activeProvider;
}

export function setAIProvider(provider: AIProvider): void {
  activeProvider = provider;
}
