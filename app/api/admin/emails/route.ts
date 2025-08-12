import { Resend } from "resend";
import { emailTemplates } from "@/lib/emailTemplates";

export async function POST(req: Request) {
  try {
    // Check admin authorization
    const adminCode = req.headers.get("x-admin-code");
    if (!adminCode || adminCode !== 'baby2025') {
      return new Response("Unauthorized", { status: 401 });
    }

    const { action, email, itemName } = await req.json();
    
    if (action === "test") {
      // Send test email
      if (!email || !itemName) {
        return new Response("Missing email or itemName", { status: 400 });
      }

      const resend = new Resend(process.env.RESEND_API_KEY!);
      const from = process.env.NOTIFY_FROM ?? "Baby in Need <noreply@ailiteracy.ch>";
      
      try {
        const testTemplate = emailTemplates.donorConfirmation(itemName);
        const result = await resend.emails.send({
          from,
          to: email,
          subject: `TEST: ${testTemplate.subject}`,
          text: `TEST E-MAIL\n\n${testTemplate.text}`,
          html: testTemplate.html.replace("<title>", "<title>TEST: ")
        });

        if (result.error) {
          return Response.json({ 
            success: false, 
            error: result.error.message 
          });
        }

        return Response.json({ 
          success: true, 
          message: "Test email sent successfully",
          emailId: result.data?.id 
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return Response.json({ 
          success: false, 
          error: errorMessage 
        });
      }
    }

    if (action === "status") {
      // Check email service status
      const resend = new Resend(process.env.RESEND_API_KEY!);
      
      try {
        // Try to get API key info (this will fail if key is invalid)
        const domains = await resend.domains.list();
        return Response.json({ 
          success: true, 
          service: "Resend",
          domains: Array.isArray(domains.data) ? domains.data.length : 0,
          apiKeyValid: true
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return Response.json({ 
          success: false, 
          service: "Resend",
          error: errorMessage,
          apiKeyValid: false
        });
      }
    }

    return new Response("Invalid action", { status: 400 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(errorMessage, { status: 500 });
  }
}

