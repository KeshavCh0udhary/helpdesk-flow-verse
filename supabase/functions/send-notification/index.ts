
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'ticket_assigned' | 'ticket_updated' | 'comment_added' | 'agent_created';
  recipientEmail: string;
  recipientName: string;
  ticketId?: string;
  ticketTitle?: string;
  message?: string;
  senderName?: string;
  passwordResetLink?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notification: NotificationRequest = await req.json();
    console.log('Sending notification:', notification);

    let subject = '';
    let htmlContent = '';

    switch (notification.type) {
      case 'agent_created':
        subject = `Welcome to HelpDesk Pro - Set Up Your Account`;
        htmlContent = `
          <h2>Welcome to HelpDesk Pro!</h2>
          <p>Hello ${notification.recipientName},</p>
          <p>Your support agent account has been created. To get started, you need to set up your password.</p>
          <p><strong>Click the link below to create your password:</strong></p>
          <p><a href="${notification.passwordResetLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Set Up Password</a></p>
          <p>Once you've set up your password, you can log in to the HelpDesk Pro system and start managing support tickets.</p>
          <p><strong>Your login email:</strong> ${notification.recipientEmail}</p>
          <p>If you have any questions, please contact your system administrator.</p>
          <p>Best regards,<br>HelpDesk Pro Team</p>
        `;
        break;

      case 'ticket_assigned':
        subject = `New Ticket Assigned: ${notification.ticketTitle}`;
        htmlContent = `
          <h2>New Ticket Assigned</h2>
          <p>Hello ${notification.recipientName},</p>
          <p>A new ticket has been assigned to you:</p>
          <p><strong>Title:</strong> ${notification.ticketTitle}</p>
          <p><strong>Ticket ID:</strong> ${notification.ticketId}</p>
          <p>Please log in to your dashboard to view and respond to this ticket.</p>
          <p>Best regards,<br>HelpDesk Pro Team</p>
        `;
        break;

      case 'ticket_updated':
        subject = `Ticket Updated: ${notification.ticketTitle}`;
        htmlContent = `
          <h2>Ticket Status Updated</h2>
          <p>Hello ${notification.recipientName},</p>
          <p>Your ticket has been updated:</p>
          <p><strong>Title:</strong> ${notification.ticketTitle}</p>
          <p><strong>Ticket ID:</strong> ${notification.ticketId}</p>
          ${notification.message ? `<p><strong>Update:</strong> ${notification.message}</p>` : ''}
          <p>Please log in to your dashboard to view the latest updates.</p>
          <p>Best regards,<br>HelpDesk Pro Team</p>
        `;
        break;

      case 'comment_added':
        subject = `New Comment on Ticket: ${notification.ticketTitle}`;
        htmlContent = `
          <h2>New Comment Added</h2>
          <p>Hello ${notification.recipientName},</p>
          <p>A new comment has been added to your ticket:</p>
          <p><strong>Title:</strong> ${notification.ticketTitle}</p>
          <p><strong>Ticket ID:</strong> ${notification.ticketId}</p>
          ${notification.senderName ? `<p><strong>Comment by:</strong> ${notification.senderName}</p>` : ''}
          ${notification.message ? `<p><strong>Comment:</strong> ${notification.message}</p>` : ''}
          <p>Please log in to your dashboard to view and respond.</p>
          <p>Best regards,<br>HelpDesk Pro Team</p>
        `;
        break;

      default:
        throw new Error('Invalid notification type');
    }

    const emailResponse = await resend.emails.send({
      from: "HelpDesk Pro <onboarding@resend.dev>",
      to: [notification.recipientEmail],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, messageId: emailResponse.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
