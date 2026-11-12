import test from "node:test";
import assert from "node:assert/strict";
import { chooseDocument } from "../src/creator_document_search.js";

test("a storefront document is selected only when retrieval returns its id", () => {
  const hit = chooseDocument([
    { id: "receipt-42", score: 0.94, metadata: { text: "Order 42" } },
    { id: "receipt-41", score: 0.91 }
  ], "receipt-42");
  assert.equal(hit?.id, "receipt-42");
  assert.equal(chooseDocument([{ id: "receipt-41" }], "receipt-42"), null);
});
