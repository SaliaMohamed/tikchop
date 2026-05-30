import {
  jsonError,
  mobileErrorStatus,
  pauseMobileBotForCustomer,
  resumeMobileBotForCustomer,
} from "../../../../../../lib/mobile-api";

export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  try {
    const { phone } = await context.params;
    const result = await pauseMobileBotForCustomer(request, phone);
    return Response.json(result);
  } catch (error) {
    return jsonError(error.message || "Pause bot non appliquee.", mobileErrorStatus(error));
  }
}

export async function DELETE(request, context) {
  try {
    const { phone } = await context.params;
    const result = await resumeMobileBotForCustomer(request, phone);
    return Response.json(result);
  } catch (error) {
    return jsonError(error.message || "Bot non reactive.", mobileErrorStatus(error));
  }
}
