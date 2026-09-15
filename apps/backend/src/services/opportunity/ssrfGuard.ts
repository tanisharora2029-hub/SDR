import { URL } from "node:url";
import dns from "node:dns/promises";

export class SsrfGuard {
  private static readonly BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "instance-data",
    "metadata"
  ]);

  /**
   * Normalizes input URL and performs strict safety validation.
   * Throws Error if URL is invalid, malicious, or points to internal infrastructure.
   */
  public static validateAndNormalizeUrl(rawUrl: string): URL {
    if (!rawUrl || typeof rawUrl !== "string") {
      throw new Error("Invalid URL: URL cannot be empty.");
    }

    let trimmed = rawUrl.trim();
    const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase();
      if (scheme !== "http" && scheme !== "https") {
        throw new Error(`Forbidden protocol "${scheme}:". Only HTTP and HTTPS are permitted.`);
      }
    } else {
      trimmed = `https://${trimmed}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(`Invalid URL format: "${rawUrl}" could not be parsed.`);
    }

    // Protocol check
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Forbidden protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hostnames
    if (this.BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      throw new Error(`Access to internal or local hostname "${hostname}" is forbidden.`);
    }

    // Check if hostname is an IP literal
    if (this.isPrivateOrReservedIp(hostname)) {
      throw new Error(`Access to private, loopback, or metadata IP "${hostname}" is strictly prohibited.`);
    }

    return parsed;
  }

  /**
   * Performs an asynchronous DNS lookup to ensure the hostname does not resolve
   * to a private or internal IP address.
   */
  public static async verifyResolvedIp(hostname: string): Promise<void> {
    // If it's already an IP, it was checked in validateAndNormalizeUrl
    if (this.isPrivateOrReservedIp(hostname)) {
      throw new Error(`Forbidden IP target: ${hostname}`);
    }

    try {
      const lookup = await dns.lookup(hostname, { all: true });
      for (const entry of lookup) {
        if (this.isPrivateOrReservedIp(entry.address)) {
          throw new Error(`Hostname "${hostname}" resolves to private/internal IP address "${entry.address}".`);
        }
      }
    } catch (err: any) {
      if (err.message?.includes("resolves to private")) {
        throw err;
      }
      // If DNS lookup fails, let caller handle or continue
    }
  }

  /**
   * Checks if an IP string belongs to private, loopback, link-local, or cloud metadata ranges.
   */
  public static isPrivateOrReservedIp(ip: string): boolean {
    // IPv6 loopback
    if (ip === "::1" || ip === "::" || ip === "0:0:0:0:0:0:0:1") return true;

    // Check IPv4
    const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4Match) return false;

    const [_, o1, o2, o3, o4] = ipv4Match.map(Number);

    // 0.0.0.0/8
    if (o1 === 0) return true;

    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) return true;

    // 10.0.0.0/8 (Private)
    if (o1 === 10) return true;

    // 172.16.0.0/12 (Private: 172.16.x.x - 172.31.x.x)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;

    // 192.168.0.0/16 (Private)
    if (o1 === 192 && o2 === 168) return true;

    // 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. 169.254.169.254)
    if (o1 === 169 && o2 === 254) return true;

    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;

    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (o1 === 192 && o2 === 0 && o3 === 2) return true;
    if (o1 === 198 && o2 === 51 && o3 === 100) return true;
    if (o1 === 203 && o2 === 0 && o3 === 113) return true;

    // Broadcast
    if (o1 >= 224) return true;

    return false;
  }
}
