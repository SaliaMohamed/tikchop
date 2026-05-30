import { jsonError, mobileErrorStatus, sendMobileManualReply } from "../../../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const { phone } = await context.params;
    const result = await sendMobileManualReply(request, phone);
    return Response.json(result);
  } catch (error) {
    return jsonError(error.message || "Message vendeur non envoye.", mobileErrorStatus(error));
  }
}
