import { createMobileProduct, jsonError, mobileErrorStatus } from "../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const product = await createMobileProduct(request);
    return Response.json({ product });
  } catch (error) {
    return jsonError(error.message || "Article non publie.", mobileErrorStatus(error));
  }
}
