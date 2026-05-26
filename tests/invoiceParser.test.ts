import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findInvoiceOptionByReference, parseInvoiceOptions } from "../src/flow/invoiceParser";

describe("invoice parser", () => {
  it("parses reference options with amount", () => {
    const options = parseInvoiceOptions("1 - Referência: 05/2026 - Valor: R$ 63,28");

    assert.deepEqual(options, [
      {
        option: "1",
        reference: "05/2026",
        amount: "63,28"
      }
    ]);
  });

  it("finds the option matching the target reference", () => {
    const options = parseInvoiceOptions(
      "1 - Referência: 05/2026 - Valor: R$ 63,28\n2 - Referência: 04/2026 - Valor: R$ 71,10"
    );

    assert.equal(findInvoiceOptionByReference(options, "04/2026")?.option, "2");
  });
});
