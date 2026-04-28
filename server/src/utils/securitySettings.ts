import { Request } from 'express';

export function normalizeIp(ip?: string | null) {
  if (!ip) return '';

  let normalized = ip.trim();
  if (normalized.includes(',')) {
    normalized = normalized.split(',')[0].trim();
  }

  normalized = normalized.replace(/^::ffff:/, '');
  if (normalized === '::1') return '127.0.0.1';

  const portMatch = normalized.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
  if (portMatch) return portMatch[1];

  return normalized;
}

export function getRequestIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return normalizeIp(forwardedIp || req.socket.remoteAddress || req.ip);
}

export function parseAllowedIpList(raw?: string | null) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch (error) {
    // Plain text fallback is supported for manually edited rows.
  }

  return raw
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isIpAllowed(ip: string, allowedIps: string[]) {
  if (allowedIps.length === 0) return true;

  return allowedIps.some((allowed) => {
    if (allowed === '*' || allowed === ip) return true;
    if (allowed.endsWith('.*')) {
      return ip.startsWith(allowed.slice(0, -1));
    }
    return false;
  });
}
