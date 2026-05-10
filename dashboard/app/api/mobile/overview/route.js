import { getMobileOverview, jsonError } from "../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const overview = await getMobileOverview(request);
    return Response.json(overview);
  } catch (error) {
    return jsonError(error.message || "Vue mobile indisponible.", 401);
  }
}
