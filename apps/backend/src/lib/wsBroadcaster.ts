import { WebSocket } from "ws";
import { logger } from "./logger.js";
import { verifyToken } from "./jwt.js";

export interface WsClient extends WebSocket {
  organizationId?: string;
  userId?: string;
  isAuthenticated?: boolean;
  isAlive?: boolean;
}

class WebSocketBroadcaster {
  private clients = new Set<WsClient>();

  registerClient(ws: WsClient, req?: any) {
    this.clients.add(ws);
    ws.isAlive = true;

    // Optional handshake authentication via query parameter (?token=...)
    if (req && req.url) {
      try {
        const parsedUrl = new URL(req.url, "http://localhost");
        const token = parsedUrl.searchParams.get("token");
        if (token) {
          try {
            const decoded = verifyToken(token);
            ws.organizationId = decoded.organizationId;
            ws.userId = decoded.userId;
            ws.isAuthenticated = true;
            logger.info(`[WS] Authenticated socket via handshake for organization: ${decoded.organizationId} (user: ${decoded.userId})`);
          } catch (err: any) {
            logger.warn(`[WS] Handshake token verification failed: ${err.message}`);
            if (typeof ws.send === "function") {
              try {
                ws.send(JSON.stringify({ type: "ERROR", error: "Unauthorized: Invalid or expired token" }));
              } catch {}
            }
            if (typeof ws.close === "function") {
              try {
                ws.close(4401, "Unauthorized");
              } catch {}
            }
            return;
          }
        }
      } catch {}
    }

    if (typeof ws.on === "function") {
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "PING") {
            ws.send(JSON.stringify({ type: "PONG" }));
            return;
          }

          if (msg.type === "AUTHENTICATE" || msg.type === "SUBSCRIBE" || msg.type === "SUBSCRIBE_ORG") {
            // Case 1: Token provided directly in message payload
            if (msg.token) {
              try {
                const decoded = verifyToken(msg.token);
                if (msg.organizationId && decoded.organizationId !== msg.organizationId) {
                  logger.warn(`[WS] Cross-tenant subscription attempt blocked: token org=${decoded.organizationId}, requested org=${msg.organizationId}`);
                  ws.send(JSON.stringify({ type: "ERROR", error: "Forbidden: Cannot subscribe to another organization" }));
                  return;
                }
                ws.organizationId = decoded.organizationId;
                ws.userId = decoded.userId;
                ws.isAuthenticated = true;
                logger.info(`[WS] Authenticated socket for organization: ${decoded.organizationId}`);
                ws.send(JSON.stringify({ type: "SUBSCRIBED", organizationId: ws.organizationId }));
                return;
              } catch (err: any) {
                logger.warn(`[WS] Token verification failed on message: ${err.message}`);
                ws.send(JSON.stringify({ type: "ERROR", error: "Unauthorized: Invalid or expired token" }));
                ws.close(4401, "Unauthorized");
                return;
              }
            }

            // Case 2: Already authenticated via connection handshake
            if (ws.isAuthenticated && ws.organizationId) {
              if (msg.organizationId && msg.organizationId !== ws.organizationId) {
                logger.warn(`[WS] Cross-tenant subscription attempt blocked: client org=${ws.organizationId}, requested org=${msg.organizationId}`);
                ws.send(JSON.stringify({ type: "ERROR", error: "Forbidden: Cannot subscribe to another organization" }));
                return;
              }
              ws.send(JSON.stringify({ type: "SUBSCRIBED", organizationId: ws.organizationId }));
              return;
            }

            // Case 3: Development / test environment fallback for mock subscriptions
            if (process.env.NODE_ENV !== "production" && msg.organizationId) {
              ws.organizationId = msg.organizationId;
              ws.isAuthenticated = true;
              logger.info(`[WS][DEV] Socket registered for organization: ${msg.organizationId}`);
              ws.send(JSON.stringify({ type: "SUBSCRIBED", organizationId: msg.organizationId }));
              return;
            }

            // Case 4: Production request without authentication token
            logger.warn("[WS] Unauthenticated subscription attempt rejected in production");
            ws.send(JSON.stringify({ type: "ERROR", error: "Authentication token required to subscribe" }));
            ws.close(4401, "Unauthorized");
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
    if (!organizationId) {
      logger.warn("[WS] broadcastToOrganization called with empty organizationId. Suppressing broadcast.");
      return;
    }
    const data = JSON.stringify(event);
    let sentCount = 0;

    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        // Strictly send ONLY to authenticated sockets belonging to THIS exact organization
        // NEVER broadcast to undefined, null, or mismatched organizationId
        if (ws.organizationId && ws.organizationId === organizationId) {
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
  if (orgId) {
    ws.organizationId = orgId;
    ws.isAuthenticated = true;
  }
  wsBroadcaster.registerClient(ws);
  return () => {
    (wsBroadcaster as any).clients.delete(ws);
  };
};
