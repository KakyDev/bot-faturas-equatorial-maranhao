import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { includesAny, normalizeText } from "../src/utils/text";

describe("text utils", () => {
  it("normalizes accents, whitespace and casing", () => {
    assert.equal(normalizeText("  Referência   de FÁTURA  "), "referencia de fatura");
  });

  it("matches normalized terms", () => {
    assert.equal(includesAny("Informe seu E-MAIL cadastrado", ["email"]), true);
  });
});
