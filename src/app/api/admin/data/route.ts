import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = "force-dynamic";

export async function GET() {
  const [loginsRes, outingsRes] = await Promise.all([
    supabase.from("login_log").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("outings").select("*").order("id", { ascending: false }).limit(100),
  ]);

  return NextResponse.json({
    logins: loginsRes.data || [],
    outings: outingsRes.data || [],
  });
}
