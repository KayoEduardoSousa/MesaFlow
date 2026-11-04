import { describe, expect, it } from "vitest";
import { parsePriceToCents } from "./money";

describe("parsePriceToCents", () => {
  it("converts decimal reais to integer cents", () => {
    expect(parsePriceToCents("49.90")).toBe(4990);
  });

  it("rejects zero, negative, and non-finite prices", () => {
    expect(parsePriceToCents("0")).toBeNull();
    expect(parsePriceToCents("-1")).toBeNull();
    expect(parsePriceToCents("abc")).toBeNull();
  });
});
