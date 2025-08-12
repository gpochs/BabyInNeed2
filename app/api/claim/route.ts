import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { id, email } = await req.json();
    if (!id || !email || !/.+@.+\..+/.test(email)) return new Response("Bad Request", { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("items")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", id)
      .is("claimed_at", null)
      .select("id,item,claimed_at")
      .single();

    if (error) return new Response(error.message, { status: 500 });
    if (!data) return new Response("Already claimed", { status: 409 });

    // load parents' emails from config (fallback to env)
    const conf = await supabaseAdmin.from("config").select("value").eq("key", "recipients").maybeSingle();
    const configured = (conf.data?.value?.emails as string | undefined) ?? "";
    const parents = configured.split(",").map((s) => s.trim()).filter(Boolean);
    const fallback = (process.env.RECIPIENTS_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const recipients = parents.length ? parents : fallback;

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const from = process.env.NOTIFY_FROM ?? "Baby in Need <onboarding@resend.dev>";

    // Donor confirmation
    await resend.emails.send({
      from, to: email,
      subject: "Reservierung bestätigt – Baby in Need",
      text: `Danke fürs Schenken! Du hast "${data.item}" reserviert.`
    });

    // Parents notification (item only)
    if (recipients.length) {
      await resend.emails.send({
        from, to: recipients,
        subject: "Neues Geschenk reserviert – Baby in Need",
        text: `Soeben wurde "${data.item}" reserviert.`
      });
    }

    return Response.json({ ok: true, item: data.item });
  } catch (e: any) {
    return new Response(e?.message ?? "Internal Error", { status: 500 });
  }
}
