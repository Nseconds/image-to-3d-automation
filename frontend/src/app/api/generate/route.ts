import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { idea } = body;
    
    if (!idea) {
      return NextResponse.json({ error: 'Missing required parameter: "idea"' }, { status: 400 });
    }

    // Retrieve n8n Webhook URL from environment variables, fallback to local default
    const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/generate-3d-asset';
    
    console.log(`[API Proxy] Forwarding request to n8n: ${n8nWebhookUrl}`);
    
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ idea }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const errorText = errorBody ? JSON.stringify(errorBody) : await response.text().catch(() => 'Unknown error');
      console.error(`[API Proxy] n8n responded with status ${response.status}: ${errorText}`);
      
      return NextResponse.json(
        { error: `Pipeline orchestration failed: ${errorText}`, details: errorBody },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[API Proxy] Error forwarding request to n8n:', err);
    return NextResponse.json(
      { error: 'Internal server error occurred while connecting to n8n pipeline.', details: err.message },
      { status: 500 }
    );
  }
}
