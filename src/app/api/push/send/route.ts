import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { target_user_id, title, body } = await req.json();
  if (!target_user_id || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("subscription_json")
    .eq("user_id", target_user_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  let subscription: PushSubscription;
  try {
    subscription = JSON.parse(data.subscription_json);
  } catch {
    return NextResponse.json({ error: "Invalid subscription JSON" }, { status: 500 });
  }

  try {
    await webpush.sendNotification(subscription as any, JSON.stringify({ title, body, icon: "/favicon.ico" }));
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await supabase.from("push_subscriptions").delete().eq("user_id", target_user_id);
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
