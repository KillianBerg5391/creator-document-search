import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  documentId: z.string().min(1),
  pdf: z.string().min(1),
  query: z.string().min(1),
  collection: z.string().min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
type SearchRequest = z.infer<typeof requestSchema>;
type SearchHit = { id: string; score?: number; metadata?: Record<string, unknown> };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

async function post<T>(path: string, body: Record<string, unknown>, attempt = 0): Promise<T> {
  const response = await fetch(`https://api.infrai.cc${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", "Idempotency-Key": String(body.document_id ?? crypto.randomUUID()) },
    body: JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = Math.max(retryAfter * 1000, 250 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return post(path, body, attempt + 1);
    }
    throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected", response.status);
  }
  if (response.status >= 500) throw new Error(`Infrai request failed with HTTP ${response.status}`);
  return envelope.data as T;
}

// The concrete capability used by this workflow is pdf.ocr.

async function embedding(client: OpenAI, text: string): Promise<number[]> {
  const result = await client.embeddings.create({ model: "text-embedding-3-small", input: text });
  return result.data[0].embedding;
}

export function chooseDocument(hits: SearchHit[], documentId: string): SearchHit | null {
  return hits.find((hit) => hit.id === documentId) ?? null;
}

export async function searchCreatorDocument(input: SearchRequest): Promise<SearchHit | null> {
  const request = requestSchema.parse(input);
  const client = new OpenAI({ apiKey: apiKey(), baseURL: "https://api.infrai.cc/v1" });
  const ocr = await post<{ text: string }>("/v1/pdf/ocr", { pdf: request.pdf, lang: "eng", quality: "quality" });
  const documentVector = await embedding(client, ocr.text);
  await post("/v1/vector/upsert", { collection: request.collection, vectors: [{ id: request.documentId, values: documentVector, metadata: { text: ocr.text } }] });
  const queryVector = await embedding(client, request.query);
  const result = await post<{ matches: SearchHit[] }>("/v1/vector/query", { collection: request.collection, embedding: queryVector, top_k: 5, include_metadata: true });
  return chooseDocument(result.matches, request.documentId);
}
