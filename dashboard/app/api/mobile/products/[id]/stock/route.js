import { jsonError, updateMobileProductStock } from "../../../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const product = await updateMobileProductStock(request, id);
    return Response.json({ product });
  } catch (error) {
    return jsonError(error.message || "Stock non mis a jour.", 400);
  }
}
