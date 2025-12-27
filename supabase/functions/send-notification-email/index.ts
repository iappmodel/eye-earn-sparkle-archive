import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationEmailRequest {
  userId: string;
  type: 'engagement' | 'promotion' | 'system';
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { userId, type, title, body, data }: NotificationEmailRequest = await req.json();

    console.log('Processing notification for user:', userId);

    // Fetch user's notification preferences
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Check if category is enabled
    const categories = preferences?.categories || ['earnings', 'system', 'engagement', 'promotions'];
    const typeToCategory: Record<string, string> = {
      'engagement': 'engagement',
      'promotion': 'promotions',
      'system': 'system',
    };
    
    if (!categories.includes(typeToCategory[type])) {
      console.log('Category disabled for user, skipping notification');
      return new Response(JSON.stringify({ skipped: true, reason: 'category_disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Insert notification into database
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        data: data || {},
      })
      .select()
      .single();

    if (notifError) {
      console.error('Error inserting notification:', notifError);
      throw new Error('Failed to create notification');
    }

    console.log('Notification created:', notification.id);

    // Send email if enabled and RESEND_API_KEY is configured
    if (preferences?.email_enabled && resendApiKey) {
      // Get user email from auth
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email;

      if (userEmail) {
        console.log('Sending email to:', userEmail);

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
              h1 { margin: 0; font-size: 24px; }
              p { margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${title}</h1>
              </div>
              <div class="content">
                <p>${body || 'You have a new notification from the app.'}</p>
                <p>Log in to your account to see more details.</p>
              </div>
              <div class="footer">
                <p>You're receiving this email because you have email notifications enabled.</p>
                <p>Update your preferences in the app settings.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'notifications@resend.dev',
              to: [userEmail],
              subject: title,
              html: emailHtml,
            }),
          });

          if (emailResponse.ok) {
            console.log('Email sent successfully');
          } else {
            const errorText = await emailResponse.text();
            console.error('Email send failed:', errorText);
          }
        } catch (emailError) {
          console.error('Email error:', emailError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notification }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-notification-email:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
