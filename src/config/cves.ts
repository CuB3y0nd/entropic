export type CveRecord = {
  id: `CVE-${number}-${number}`;
  title: string;
  date: string;
};

export const cveRecords: CveRecord[] = [
  {
    id: "CVE-2024-25817",
    title: "eza Heap Buffer Overflow via .git Metadata",
    date: "2024-03-05"
  },
  {
    id: "CVE-2025-60939",
    title: "Spotify Client Denial of Service",
    date: "2025-10-23"
  },
  {
    id: "CVE-2026-56113",
    title: "dhcpcd Heap Use-After-Free in dhcp6_deprecateaddrs via DHCPv6 RENEW",
    date: "2026-06-23"
  },
  {
    id: "CVE-2026-56114",
    title: "dhcpcd Stack Out-of-Bounds Write in dhcp6_makemessage()",
    date: "2026-06-23"
  },
  {
    id: "CVE-2026-56116",
    title: "dhcpcd Memory Leak DoS via IPv6 Router Advertisement Handling",
    date: "2026-06-23"
  },
  {
    id: "CVE-2026-56117",
    title: "dhcpcd Heap Use-After-Free via Control Socket Handling",
    date: "2026-06-23"
  }
];
