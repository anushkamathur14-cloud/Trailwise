import { liveBus, type LiveEvent } from "@/lib/live/bus";
import { workspaceFrom } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent) => {
        if (event.workspaceId !== workspaceId) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      liveBus.on("event", send);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "hello", workspaceId })}\n\n`));
      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);
      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        liveBus.off("event", send);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
