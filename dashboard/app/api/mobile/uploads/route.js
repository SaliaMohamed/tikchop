import { jsonError, uploadMobileProductImage } from "../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const image = await uploadMobileProductImage(request);
    return Response.json(image);
  } catch (error) {
    return jsonError(error.message || "Photo non envoyee.", 400);
  }
}
