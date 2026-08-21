import { sendNativeCustomerMessage } from "../../../../../lib/native-bot";

export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const { slug } = await context.params;
    const body = await request.json().catch(() => ({}));
    const clientId = String(body.client_id || body.clientId || "").trim();
    const name = String(body.name || "").trim();
    const text = String(body.text || "").trim();
    const media = body.media || null;

    if (!clientId || (!text && !media)) {
      return Response.json({ error: "Message client invalide." }, { status: 400 });
    }

    const result = await sendNativeCustomerMessage({ slug, clientId, name, text, media });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || "Message non envoye." }, { status: 400 });
  }
}