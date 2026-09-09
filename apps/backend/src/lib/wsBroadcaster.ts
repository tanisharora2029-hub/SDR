import { WebSocket } from "ws";
import { logger } from "./logger.js";

export interface WsClient extends WebSocket {
  organizationId?: string;
  isAlive?: boolean;
}

class WebSocketBroadcaster {
  private clients = new Set<WsClient>();

  registerClient(ws: WsClient) {
    this.clients.add(ws);
    ws.isAlive = true;

    if (typeof ws.on === "function") {
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "PING") {
            ws.send(JSON.stringify({ type: "PONG" }));
          } else if ((msg.type === "SUBSCRIBE" || msg.type === "SUBSCRIBE_ORG") && msg.organizationId) {
            ws.organizationId = msg.organizationId;
            logger.info(`[WS] Client subscribed to organization: ${msg.organizationId}`);
            ws.send(JSON.stringify({ type: "SUBSCRIBED", organizationId: msg.organizationId }));
          }
        } catch {
          // ignore malformed payloads
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", (err: any) => {
        logger.warn(`[WS] Client error: ${err.message}`);
        this.clients.delete(ws);
      });
    }
  }

  broadcastToOrganization(organizationId: string, event: { type: string; payload: any }) {
    const data = JSON.stringify(event);
    let sentCount = 0;

    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        // Send if client explicitly subscribed to this org, or if client has not subscribed yet (development/fallback)
        if (!ws.organizationId || ws.organizationId === organizationId) {
          try {
            ws.send(data);
            sentCount++;
          } catch (err: any) {
            logger.warn(`[WS] Failed to send event to client: ${err.message}`);
          }
        }
      }
    }
    logger.info(`[WS] Broadcast ${event.type} to ${sentCount} client(s) in org ${organizationId}`);
  }
}

export const wsBroadcaster = new WebSocketBroadcaster();
export const broadcastToOrganization = (orgId: string, event: { type: string; payload: any }) =>
  wsBroadcaster.broadcastToOrganization(orgId, event);

export const registerWsClient = (ws: any, orgId?: string) => {
  ws.organizationId = orgId;
  wsBroadcaster.registerClient(ws);
  return () => {
    (wsBroadcaster as any).clients.delete(ws);
  };
};
