import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

async function requireAuthUser(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase non configure." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Session vendeur manquante." }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Session vendeur invalide." }, { status: 401 });
  }

  return authData.user;
}

function parseSubscription(body) {
  const endpoint = String(body?.endpoint || "").trim();
  const p256dh = String(body?.keys?.p256dh || "").trim();
  const auth = String(body?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    return null;
  }
  if (!/^https:\/\//i.test(endpoint)) {
    return null;
  }

  return { endpoint, p256dh, auth };
}

export async function POST(request) {
  try {
    const user = await requireAuthUser(request);
    if (user instanceof NextResponse) return user;

    const body = await request.json().catch(() => null);
    const subscription = parseSubscription(body);
    if (!subscription) {
      return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
    }

    const payload = {
      owner_user_id: user.id,
      ...subscription,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) || null,
    };

    const { error: upsertError } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" });

    if (upsertError) {
      console.error("Push subscribe error:", upsertError.message);
      return NextResponse.json({ error: "Impossible d'enregistrer l'abonnement." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await requireAuthUser(request);
    if (user instanceof NextResponse) return user;

    const body = await request.json().catch(() => null);
    const subscription = parseSubscription(body);
    if (!subscription) {
      return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("owner_user_id", user.id)
      .eq("endpoint", subscription.endpoint);

    if (error) {
      console.error("Push unsubscribe error:", error.message);
      return NextResponse.json({ error: "Impossible de retirer l'abonnement." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}