import { getNativeConversation } from "../../../../../lib/native-bot";

export const dynamic = "force-dynamic";

export async function GET(request, context) {
  try {
    const { slug } = await context.params;
    const url = new URL(request.url);
    const clientId = url.searchParams.get("client_id") || "";
    if (!clientId) {
      return Response.json({ messages: [], seller: null });
    }
    const result = await getNativeConversation(slug, clientId);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || "Messages indisponibles." }, { status: 400 });
  }
}