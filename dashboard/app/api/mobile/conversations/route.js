import { getMobileConversations, jsonError, mobileErrorStatus } from "../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const result = await getMobileConversations(request);
    return Response.json(result);
  } catch (error) {
    return jsonError(error.message || "Conversations indisponibles.", mobileErrorStatus(error));
  }
}