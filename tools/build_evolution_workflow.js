const fs = require('fs');
const crypto = require('crypto');

const inputJson = fs.readFileSync('n8n-workflows/tikchop_sales_bot_v2.json', 'utf8').replace(/^\uFEFF/, '');
const src = JSON.parse(inputJson);

src.name = 'Tikchop Sales Bot V2 - Evolution API';
src.active = false;
src.id = 'tkchopEvobd8516ea';
delete src.createdAt;
delete src.updatedAt;

const originalFanout = src.connections['WAHA Webhook (Global)']?.main?.[1] || [];

function replaceDeep(value) {
  if (typeof value === 'string') {
    return value.replaceAll('WAHA Webhook (Global)', 'Normalize Evolution Payload');
  }
  if (Array.isArray(value)) {
    return value.map(replaceDeep);
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = replaceDeep(value[key]);
    }
  }
  return value;
}

replaceDeep(src);

const webhook = src.nodes.find(
  (node) =>
    node.name === 'WAHA Webhook (Global)' ||
    (node.name === 'Normalize Evolution Payload' && node.type === 'n8n-nodes-base.webhook'),
);

webhook.name = 'Evolution Webhook';
webhook.webhookId = 'tikchop-evolution-webhook';
webhook.parameters.httpMethod = 'POST';
webhook.parameters.path = 'tikchop-evolution-whatsapp';
webhook.parameters.responseMode = 'onReceived';
webhook.position = [-960, 240];

src.nodes.push({
  parameters: {
    jsCode: `const input = $input.first().json;
const body = input.body || input;
const query = input.query || {};
const data = body.data || body.message || {};
const key = data.key || {};
const event = body.event || '';

if (event && !['MESSAGES_UPSERT', 'messages.upsert'].includes(event)) {
  return [];
}

if (key.fromMe) {
  return [];
}

const msg = data.message || data;
const instanceName = body.instance || body.instanceName || query.seller || 'unknown';
const remoteJid = key.remoteJid || data.remoteJid || data.chatId || body.remoteJid || body.chatId || '';
const messageId = key.id || data.id || body.id || \`\${Date.now()}\`;
const pushName = data.pushName || body.pushName || 'Client';

const text =
  msg.conversation ||
  msg.extendedTextMessage?.text ||
  msg.imageMessage?.caption ||
  msg.videoMessage?.caption ||
  data.messageText ||
  body.text ||
  '';

const mimetype =
  msg.imageMessage?.mimetype ||
  msg.audioMessage?.mimetype ||
  msg.videoMessage?.mimetype ||
  msg.documentMessage?.mimetype ||
  '';

if (!text && !mimetype) {
  return [];
}

const payload = {
  id: messageId,
  from: remoteJid,
  body: text,
  hasMedia: false,
  media: { mimetype, url: '' },
  _data: { notifyName: pushName },
};

return [{
  json: {
    source: 'evolution',
    event,
    instanceName,
    seller: query.seller || instanceName,
    query,
    payload,
    body: {
      session: instanceName,
      payload,
      event: body.event,
      instance: instanceName,
    },
    raw: body,
  }
}];`,
  },
  id: crypto.randomUUID(),
  name: 'Normalize Evolution Payload',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-740, 240],
});

for (const name of ['Start Typing', 'Send Seen', 'Send Seen1', 'Start Typing2', 'Send Seen2', 'Start Typing1']) {
  const node = src.nodes.find((candidate) => candidate.name === name);
  if (node) {
    node.type = 'n8n-nodes-base.noOp';
    node.typeVersion = 1;
    node.parameters = {};
    delete node.credentials;
  }
}

const send = src.nodes.find((node) => node.name === 'Envoyer RÃ©ponse');
if (send) {
  send.type = 'n8n-nodes-base.httpRequest';
  send.typeVersion = 4.2;
  send.parameters = {
    method: 'POST',
    url: "=https://evolution-tikchop.76.13.59.214.sslip.io/message/sendText/{{ $('Normalize Evolution Payload').item.json.instanceName }}",
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: 'apikey',
          value: '={{ $vars.EVOLUTION_API_KEY }}',
        },
      ],
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody:
      "={{ { number: $('Normalize Evolution Payload').item.json.body.payload.from, text: ($json.output || '').replace('[SEND_BROCHURE]', '').trim() } }}",
    options: {},
  };
  delete send.credentials;
}

const fusion = src.nodes.find((node) => node.name === 'Fusion Pro');
if (fusion) {
  fusion.parameters.jsCode = fusion.parameters.jsCode.replace(
    ".replace('@c.us', '')",
    ".replace('@c.us', '').replace('@s.whatsapp.net', '')",
  );
}

delete src.connections['WAHA Webhook (Global)'];
delete src.connections['Normalize Evolution Payload'];
src.connections['Evolution Webhook'] = {
  main: [[{ node: 'Normalize Evolution Payload', type: 'main', index: 0 }]],
};
src.connections['Normalize Evolution Payload'] = {
  main: [originalFanout],
};

fs.writeFileSync('n8n-workflows/tikchop_sales_bot_evolution.json', `${JSON.stringify(src, null, 2)}\n`);
