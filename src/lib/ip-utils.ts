// lib/ip-utils.ts

const ALLOWED_CIDRS = [
  "203.82.42.2/24"
];

function ipToNumber(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isIpInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - Number(bits)) - 1) >>> 0;

  return (
    (ipToNumber(ip) & mask) ===
    (ipToNumber(range) & mask)
  );
}

export function isAllowedIp(ip: string): boolean {
  return ALLOWED_CIDRS.some(cidr => isIpInCIDR(ip, cidr));
}
