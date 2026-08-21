import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CHANNEL_NATIVE,
  CHANNEL_WHATSAPP,
  NATIVE_CLIENT_SUFFIX,
  NATIVE_DEFAULT_NAME,
  getMessageChannel,
  isNativeChannel,
  buildNativeClientKey,
  buildWhatsAppClientKey,
} from "../app/lib/actions/channels.js";

test("getMessageChannel reads explicit channel column", () => {
  assert.equal(getMessageChannel({ channel: "native" }), CHANNEL_NATIVE);
  assert.equal(getMessageChannel({ channel: "whatsapp" }), CHANNEL_WHATSAPP);
  assert.equal(getMessageChannel({ channel: "" }), CHANNEL_WHATSAPP);
  assert.equal(getMessageChannel({}), CHANNEL_WHATSAPP);
});

test("getMessageChannel infers native from @native client suffix", () => {
  assert.equal(getMessageChannel({ client: "salia : Aya : cli-123@native" }), CHANNEL_NATIVE);
  assert.equal(getMessageChannel({ client: "salia : Aya : +22507081234@s.whatsapp.net" }), CHANNEL_WHATSAPP);
  assert.equal(getMessageChannel({ client: "salia : Aya : 07081234" }), CHANNEL_WHATSAPP);
});

test("explicit column wins over client suffix inference", () => {
  assert.equal(getMessageChannel({ client: "x : y : z@native", channel: "whatsapp" }), CHANNEL_WHATSAPP);
  assert.equal(getMessageChannel({ client: "x : y : 07081234@s.whatsapp.net", channel: "native" }), CHANNEL_NATIVE);
});

test("isNativeChannel", () => {
  assert.equal(isNativeChannel(CHANNEL_NATIVE), true);
  assert.equal(isNativeChannel(CHANNEL_WHATSAPP), false);
  assert.equal(isNativeChannel(undefined), false);
});

test("buildNativeClientKey formats slug : name : id@native", () => {
  assert.equal(buildNativeClientKey("salia", "Aya", "cli-123"), `salia : Aya : cli-123${NATIVE_CLIENT_SUFFIX}`);
  assert.equal(buildNativeClientKey("salia", "", "cli-123"), `salia :  : cli-123${NATIVE_CLIENT_SUFFIX}`);
});

test("buildWhatsAppClientKey formats slug : label : phone@s.whatsapp.net", () => {
  assert.equal(buildWhatsAppClientKey("salia", "Awa", "22507081234"), "salia : Awa : 22507081234@s.whatsapp.net");
});

test("NATIVE_DEFAULT_NAME is a stable label", () => {
  assert.equal(NATIVE_DEFAULT_NAME, "Client Tikchop");
});