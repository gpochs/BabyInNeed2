import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { emailTemplates } from "@/lib/emailTemplates";

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

    // Donor confirmation - CRITICAL: This must succeed
    let donorEmailSent = false;
    try {
      const donorTemplate = emailTemplates.donorConfirmation(data.item);
      const donorResult = await resend.emails.send({
        from, 
        to: email,
        subject: donorTemplate.subject,
        text: donorTemplate.text,
        html: donorTemplate.html
      });
      
      if (donorResult.error) {
        console.error("Donor email failed:", donorResult.error);
        throw new Error(`Donor email failed: ${donorResult.error.message}`);
      }
      
      donorEmailSent = true;
      console.log("Donor confirmation email sent successfully to:", email);
    } catch (emailError) {
      console.error("Critical: Failed to send donor confirmation email:", emailError);
      // If donor email fails, we should not proceed with the claim
      // Rollback the claim
      await supabaseAdmin
        .from("items")
        .update({ claimed_at: null })
        .eq("id", id);
      
      return new Response("Failed to send confirmation email. Please try again.", { status: 500 });
    }

    // Parents notification (item only) - Less critical, can fail
    if (recipients.length) {
      try {
        const parentTemplate = emailTemplates.parentNotification(data.item);
        const parentResult = await resend.emails.send({
          from, 
          to: recipients,
          subject: parentTemplate.subject,
          text: parentTemplate.text,
          html: parentTemplate.html
        });
        
        if (parentResult.error) {
          console.warn("Parent notification email failed:", parentResult.error);
        } else {
          console.log("Parent notification email sent successfully to:", recipients);
        }
      } catch (parentEmailError) {
        console.warn("Parent notification email failed:", parentEmailError);
        // Don't fail the entire request for parent notification
      }
    }

    // Log successful claim
    console.log(`Item "${data.item}" successfully claimed by ${email} at ${new Date().toISOString()}`);

    return Response.json({ 
      ok: true, 
      item: data.item,
      emailSent: donorEmailSent 
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Internal Error";
    console.error("Claim API error:", e);
    return new Response(errorMessage, { status: 500 });
  }
}
