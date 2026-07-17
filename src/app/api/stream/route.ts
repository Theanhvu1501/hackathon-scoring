import { subscribe } from '@/lib/events';
export const dynamic = 'force-dynamic';
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: hello\ndata: {}\n\n`));
      const unsub = subscribe(({ event, data }) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      });
      const ping = setInterval(() => controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`)), 15000);
      // @ts-expect-error attach for GC on cancel
      controller._cleanup = () => { clearInterval(ping); unsub(); };
    },
    cancel() { /* controller._cleanup handled by GC of closure via unsub timer */ },
  });
  return new Response(stream, {
    headers: { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', Connection:'keep-alive' },
  });
}
