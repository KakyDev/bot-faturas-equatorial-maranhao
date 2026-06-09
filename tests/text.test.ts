import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { includesAny, normalizeText } from "../src/utils/text";
import { normalizePhoneNumber } from "../src/whatsapp/chat";

describe("text utils", () => {
  it("normalizes accents, whitespace and casing", () => {
    assert.equal(normalizeText("  Referência   de FÁTURA  "), "referencia de fatura");
  });

  it("matches normalized terms", () => {
    assert.equal(includesAny("Informe seu E-MAIL cadastrado", ["email"]), true);
  });

  it("normalizes phone numbers", () => {
    assert.equal(normalizePhoneNumber("+55 (98) 99999-9999"), "5598999999999");
  });
});
