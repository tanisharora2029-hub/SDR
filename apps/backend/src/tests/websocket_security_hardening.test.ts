import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { wsBroadcaster, broadcastToOrganization, registerWsClient } from "../lib/wsBroadcaster.js";
import { signToken } from "../lib/jwt.js";

describe("WebSocket Security & Multi-Tenant Isolation Suite", () => {
  const orgA = "org-alpha-111";
  const orgB = "org-bravo-222";

  let clientAEvents: any[] = [];
  let clientBEvents: any[] = [];
  let unauthEvents: any[] = [];

  let mockWsA: any;
  let mockWsB: any;
  let mockWsUnauth: any;

  let unregisterA: () => void;
  let unregisterB: () => void;
  let unregisterUnauth: () => void;

  beforeEach(() => {
    clientAEvents = [];
    clientBEvents = [];
    unauthEvents = [];

    mockWsA = {
      readyState: 1, // WebSocket.OPEN
      send: (data: string) => clientAEvents.push(JSON.parse(data)),
      on: () => {},
      close: () => {}
    };

    mockWsB = {
      readyState: 1, // WebSocket.OPEN
      send: (data: string) => clientBEvents.push(JSON.parse(data)),
      on: () => {},
      close: () => {}
    };

    mockWsUnauth = {
      readyState: 1, // WebSocket.OPEN
      send: (data: string) => unauthEvents.push(JSON.parse(data)),
      on: () => {},
      close: () => {}
    };

    unregisterA = registerWsClient(mockWsA, orgA);
    unregisterB = registerWsClient(mockWsB, orgB);
    unregisterUnauth = registerWsClient(mockWsUnauth); // undefined organizationId
  });

  afterEach(() => {
    unregisterA?.();
    unregisterB?.();
    unregisterUnauth?.();
  });

  it("1. Broadcast to Org A delivers to Org A socket and strictly ignores Org B socket", () => {
    broadcastToOrganization(orgA, {
      type: "MESSAGE_CREATED",
      payload: { messageId: "msg-alpha-99", content: "Confidential deal communication for Org A" }
    });

    expect(clientAEvents.length).toBe(1);
    expect(clientAEvents[0].type).toBe("MESSAGE_CREATED");
    expect(clientAEvents[0].payload.messageId).toBe("msg-alpha-99");

    // STRICT ISOLATION ASSERTION: Org B must receive zero events
    expect(clientBEvents.length).toBe(0);
  });

  it("2. Sockets with undefined/unauthenticated organizationId NEVER receive broadcast events", () => {
    broadcastToOrganization(orgA, {
      type: "LEAD_CREATED",
      payload: { leadId: "lead-alpha-001" }
    });

    broadcastToOrganization(orgB, {
      type: "LEAD_CREATED",
      payload: { leadId: "lead-bravo-002" }
    });

    // Unauthenticated socket must receive ZERO broadcasts across both organizations
    expect(unauthEvents.length).toBe(0);
    expect(clientAEvents.length).toBe(1);
    expect(clientBEvents.length).toBe(1);
  });

  it("3. Authenticates client during handshake if valid JWT token is provided in URL", () => {
    const validToken = signToken({
      userId: "user-alpha-1",
      email: "rep@alpha.com",
      organizationId: orgA,
      role: "OWNER"
    });

    const mockHandshakeWs: any = {
      readyState: 1,
      send: () => {},
      on: () => {},
      close: () => {}
    };

    const mockReq = {
      url: `/ws?token=${validToken}`
    };

    wsBroadcaster.registerClient(mockHandshakeWs, mockReq);

    expect(mockHandshakeWs.isAuthenticated).toBe(true);
    expect(mockHandshakeWs.organizationId).toBe(orgA);
    expect(mockHandshakeWs.userId).toBe("user-alpha-1");
  });

  it("4. Rejects connection with 4401 error code if handshake JWT token is invalid", () => {
    let closedCode: number | null = null;
    let errorMessageSent: any = null;

    const mockFailingWs: any = {
      readyState: 1,
      send: (raw: string) => {
        errorMessageSent = JSON.parse(raw);
      },
      on: () => {},
      close: (code: number) => {
        closedCode = code;
      }
    };

    const mockReq = {
      url: "/ws?token=invalid.jwt.signature"
    };

    wsBroadcaster.registerClient(mockFailingWs, mockReq);

    expect(closedCode).toBe(4401);
    expect(errorMessageSent).toBeDefined();
    expect(errorMessageSent.type).toBe("ERROR");
    expect(errorMessageSent.error).toContain("Unauthorized");
  });

  it("5. Rejects cross-tenant subscription attempt when token org differs from requested org", () => {
    const validTokenOrgA = signToken({
      userId: "user-alpha-1",
      email: "rep@alpha.com",
      organizationId: orgA,
      role: "OWNER"
    });

    let messageCallback: ((data: Buffer) => void) | null = null;
    const sentMessages: any[] = [];

    const mockSocket: any = {
      readyState: 1,
      send: (raw: string) => sentMessages.push(JSON.parse(raw)),
      on: (event: string, cb: any) => {
        if (event === "message") messageCallback = cb;
      },
      close: () => {}
    };

    wsBroadcaster.registerClient(mockSocket);

    // Client attempts to subscribe to Org B using a token belonging to Org A
    const maliciousPayload = JSON.stringify({
      type: "SUBSCRIBE_ORG",
      organizationId: orgB,
      token: validTokenOrgA
    });

    messageCallback!(Buffer.from(maliciousPayload));

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe("ERROR");
    expect(sentMessages[0].error).toContain("Forbidden");
    expect(mockSocket.organizationId).toBeUndefined();
  });
});
