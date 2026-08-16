import { test } from "node:test";
import assert from "node:assert/strict";

import { formatPrice, normalizeMoneyInput, normalizeStockInput } from "../lib/product-utils.js";

test("normalizeMoneyInput strips everything but digits", () => {
  assert.equal(normalizeMoneyInput("1 500 F"), "1500");
  assert.equal(normalizeMoneyInput("abc"), "");
  assert.equal(normalizeMoneyInput(""), "");
  assert.equal(normalizeMoneyInput(null), "");
  assert.equal(normalizeMoneyInput("12,500.50"), "1250050");
});

test("formatPrice renders fr-FR with FCFA suffix", () => {
  const nbsp = "\u202f";
  assert.equal(formatPrice("1500"), `1${nbsp}500 FCFA`);
  assert.equal(formatPrice(0), "0 FCFA");
  assert.equal(formatPrice(""), "0 FCFA");
  assert.equal(formatPrice("12500"), `12${nbsp}500 FCFA`);
});

test("normalizeStockInput keeps digits and defaults to 1", () => {
  assert.equal(normalizeStockInput("3"), "3");
  assert.equal(normalizeStockInput("a2b"), "2");
  assert.equal(normalizeStockInput(""), "1");
  assert.equal(normalizeStockInput(null), "1");
  assert.equal(normalizeStockInput("0"), "0");
});