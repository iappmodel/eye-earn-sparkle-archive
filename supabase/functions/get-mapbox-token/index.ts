import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors.headers });
  }

  try {
    const token = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    
    if (!token) {
      console.error('[GetMapboxToken] Token not configured');
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[GetMapboxToken] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
