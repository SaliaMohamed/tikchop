import { getMobileConversationMessages, jsonError, mobileErrorStatus } from "../../../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request, context) {
  try {
    const { phone } = await context.params;
    const result = await getMobileConversationMessages(request, phone);
    return Response.json(result);
  } catch (error) {
    return jsonError(error.message || "Messages indisponibles.", mobileErrorStatus(error));
  }
}