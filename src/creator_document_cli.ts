import { searchCreatorDocument } from "./creator_document_search.js";

const input = process.argv[2];
if (!input) {
  console.error("Pass a JSON request with documentId, pdf, query, and collection.");
  process.exit(1);
}

const hit = await searchCreatorDocument(JSON.parse(input));
console.log(JSON.stringify({ searchable: hit !== null, hit }));
