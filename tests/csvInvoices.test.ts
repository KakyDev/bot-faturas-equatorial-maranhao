import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseInvoiceTargetsCsv } from "../src/input/csvInvoices";

describe("CSV invoice targets", () => {
  it("parses semicolon separated invoice targets", () => {
    const targets = parseInvoiceTargetsCsv(
      "TARGET_UC;TARGET_REFERENCE\n47279046;03/2026\n46775660;03/2026",
      "csvs/equatorial_1.csv"
    );

    assert.deepEqual(targets, [
      {
        uc: "47279046",
        reference: "03/2026",
        sourceFile: "csvs/equatorial_1.csv",
        lineNumber: 2
      },
      {
        uc: "46775660",
        reference: "03/2026",
        sourceFile: "csvs/equatorial_1.csv",
        lineNumber: 3
      }
    ]);
  });

  it("requires TARGET_UC and TARGET_REFERENCE headers", () => {
    assert.throws(
      () => parseInvoiceTargetsCsv("UC;REFERENCIA\n47279046;03/2026", "invalid.csv"),
      /Cabecalho esperado/
    );
  });
});
