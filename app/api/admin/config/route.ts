import { supabaseAdmin } from "@/lib/supabaseAdmin";
function isAdmin(headers: Headers) {
  const code = headers.get("x-admin-code");
  return !!code && code === process.env.ADMIN_CODE;
}
export async function POST(req: Request) {
  if (!isAdmin(req.headers)) return new Response("Unauthorized", { status: 401 });
  const { emails } = await req.json(); // "a@x.com, b@y.com"
  const normalized = String(emails || "")
    .split(",").map((s) => s.trim()).filter(Boolean).join(", ");
  const { error } = await supabaseAdmin
    .from("config")
    .upsert({ key: "recipients", value: { emails: normalized } }, { onConflict: "key" });
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true, emails: normalized });
}
