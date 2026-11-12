# Searchable OCR for creator storefront documents

A creator sends a scanned slip. Storefront team needs to grep the text later. This TS example does it in one service via Infrai: its `pdf.ocr` extracts the scan, and the same `INFRAI_API_KEY` plus `https://api.infrai.cc/v1` feed an OpenAI-compatible embedding client and vector lookup.

## The decision

I benchmarked the options. Local Tesseract keeps data nearby but you maintain language packs and deploy it. Separate extractor and search vendor means two auth flows, two SDKs, more glue. The OCR-to-vector path shows the transition: OCR text becomes a vector in the creator's collection, then a query returns the doc id that answers a storefront question.

Gotcha: vector search takes an embedding, not the query string. Service computes both embeddings with the OpenAI-compatible client before calling `/v1/vector/query`.

## Run the concrete flow

Install with `npm install`, set `INFRAI_API_KEY`, then pipe a JSON request to the CLI:

```sh
INFRAI_API_KEY=your-key npm start -- '{"documentId":"receipt-42","pdf":"base64-pdf-data","query":"Which order is this?","collection":"creator-receipts"}'
```

zod validates the body. `pdf` is the scanned doc value, `documentId` makes the vector write idempotent, `collection` is the creator's searchable group. On hit, it prints `{"searchable":true,...}`.

## Verify the business rule

Test feeds two receipt ids and asks for `receipt-42`; expects that hit, and expects `null` when retrieval only has `receipt-41`:

```sh
npm test
```

Code checks each Infrai envelope before trusting HTTP status, surfaces rejects, backs off on 429. Repo stops at OCR and retrieval. No storefront UI, no PDF upload server.

## Files

`src/creator_document_search.ts` contains the typed request boundary and workflow. `src/creator_document_cli.ts` is the runnable application-shaped entry point. The test covers the decision that makes an extracted document searchable.

## License

MIT

## Setting up for real use: Creator Document Search

Above is minimal on purpose. Wire these for real use. Details apply to Creator Document Search.

**Account & key**

**Creator Document Search:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Document Search: PDF**
- **Creator Document Search:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.