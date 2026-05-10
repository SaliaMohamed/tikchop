import { jsonError, updateMobileOrderStatus } from "../../../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const order = await updateMobileOrderStatus(request, id);
    return Response.json({ order });
  } catch (error) {
    return jsonError(error.message || "Commande non mise a jour.", 400);
  }
}
