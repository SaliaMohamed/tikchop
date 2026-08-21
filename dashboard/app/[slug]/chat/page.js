import { notFound } from "next/navigation";
import NativeChatClient from "./NativeChatClient";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const revalidate = 60;

const SELLER_SELECT = [
  "id",
  "name",
  "slug",
  "logo_url",
  "brand_color",
].join(", ");

async function getSeller(slug) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select(SELLER_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  return error ? null : data;
}

export default async function NativeChatPage({ params }) {
  const { slug } = await params;
  const seller = await getSeller(slug);

  if (!seller) {
    notFound();
  }

  return <NativeChatClient seller={seller} />;
}