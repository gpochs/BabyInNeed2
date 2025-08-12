import { supabaseAdmin } from "@/lib/supabaseAdmin";
function isAdmin(headers: Headers) {
  const code = headers.get("x-admin-code");
  return !!code && code === process.env.ADMIN_CODE;
}
export async function POST(req: Request) {
  if (!isAdmin(req.headers)) return new Response("Unauthorized", { status: 401 });
  const { item, url, price, size, notes } = await req.json();
  if (!item || !String(item).trim()) return new Response("Bad Request", { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("items").insert({ item, url, price, size, notes }).select("*").single();
  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}
export async function DELETE(req: Request) {
  if (!isAdmin(req.headers)) return new Response("Unauthorized", { status: 401 });
  const { id } = await req.json();
  if (!id) return new Response("Bad Request", { status: 400 });
  const { error } = await supabaseAdmin.from("items").delete().eq("id", id);
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}
