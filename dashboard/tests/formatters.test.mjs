import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatCfa,
  normalizeCustomerPhone,
  handoffKey,
  formatCustomerPhone,
  getSellerEvolutionInstance,
} from "../app/lib/actions/formatters.js";

test("normalizeCustomerPhone keeps digits only", () => {
  assert.equal(normalizeCustomerPhone("+225 07-08-12-34"), "22507081234");
  assert.equal(normalizeCustomerPhone("(225) 07081234"), "22507081234");
  assert.equal(normalizeCustomerPhone(""), "");
  assert.equal(normalizeCustomerPhone(null), "");
});

test("handoffKey uses normalized phone or raw trimmed value", () => {
  assert.equal(handoffKey("+225 07081234"), "22507081234");
  assert.equal(handoffKey("  client-abc "), "client-abc");
});

test("formatCustomerPhone prefixes +225 correctly", () => {
  assert.equal(formatCustomerPhone("22507081234"), "+22507081234");
  assert.equal(formatCustomerPhone("07081234"), "+07081234");
  assert.equal(formatCustomerPhone(""), "");
});

test("formatCfa renders fr-FR with F suffix", () => {
  const nbsp = "\u202f";
  assert.equal(formatCfa("1500"), `1${nbsp}500 F`);
  assert.equal(formatCfa(0), "0 F");
  assert.equal(formatCfa(""), "0 F");
});

test("getSellerEvolutionInstance prefers evolution_instance", () => {
  assert.equal(getSellerEvolutionInstance({ evolution_instance: "inst-a", slug: "slug-b" }), "inst-a");
  assert.equal(getSellerEvolutionInstance({ slug: "slug-b" }), "slug-b");
  assert.equal(getSellerEvolutionInstance({}), "");
  assert.equal(getSellerEvolutionInstance(null), "");
});