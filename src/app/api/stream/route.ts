import { subscribe } from '@/lib/events';
export const dynamic = 'force-dynamic';
export async function GET() {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup(); // controller already closed (client gone) — tear down
        }
      };
      send('hello', {});
      const unsub = subscribe(({ event, data }) => send(event, data));
      const ping = setInterval(() => send('ping', {}), 15000);
      cleanup = () => { clearInterval(ping); unsub(); };
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, {
    headers: { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', Connection:'keep-alive' },
  });
}
