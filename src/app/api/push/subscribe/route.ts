import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { user_id, subscription } = await req.json();
  if (!user_id || !subscription) {
    return NextResponse.json({ error: "Missing user_id or subscription" }, { status: 400 });
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id, subscription_json: JSON.stringify(subscription), updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }
  await supabase.from("push_subscriptions").delete().eq("user_id", user_id);
  return NextResponse.json({ ok: true });
}
