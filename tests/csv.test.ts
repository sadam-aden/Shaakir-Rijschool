import { describe, expect, it } from "vitest";
import { BOM, csvCell, euros, toCsv } from "@/lib/domain/csv";

describe("CSV for Dutch Excel", () => {
  it("starts with a BOM and uses semicolons and CRLF", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}a;b\r\n1;2\r\n`);
  });
  it("quotes cells with semicolons, quotes and line breaks", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });
  it("uses a decimal comma for numbers", () => {
    expect(csvCell(12.5)).toBe("12,5");
    expect(euros(189000)).toBe("1890,00");
    expect(euros(5)).toBe("0,05");
  });
  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toContain("'=");
    expect(csvCell("+31612345678")).toBe("'+31612345678");
    expect(csvCell("normal")).toBe("normal");
  });
});
