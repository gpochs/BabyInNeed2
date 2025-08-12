import { Resend } from "resend";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const to = new URL(req.url).searchParams.get("to");
    if (!to || !/.+@.+\..+/.test(to)) {
      return new Response("Use ?to=you@mail.ch", { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const from = process.env.NOTIFY_FROM ?? "Baby in Need <noreply@ailiteracy.ch>";

    const r = await resend.emails.send({
      from,
      to,
      subject: "Test – Baby in Need",
      text: "Direkter Test aus Production.",
    });

    return Response.json(r);
  } catch (e: unknown) {
    console.error("debug-email:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(errorMessage, { status: 500 });
  }
}
