import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPdfFileName } from "../src/storage/pdfStorage";

describe("pdf storage", () => {
  it("builds a safe PDF filename using UC and reference", () => {
    assert.equal(buildPdfFileName("3024668214", "05/2026"), "3024668214_05-2026.pdf");
  });
});
