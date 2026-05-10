import { readLatestReport } from "@/lib/reportFiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        const payload = await readLatestReport();
        if (payload) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }
      };

      await send();
      const interval = setInterval(send, 4000);

      return () => clearInterval(interval);
    },
    cancel() {
      return;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive"
    }
  });
}
