export type HomeItem = {
  label: string;
  href?: string;
  linkLabel?: string;
  external?: boolean;
  prefix?: string;
};

export type HomeSection = {
  title: string;
  items?: HomeItem[];
  volumes?: {
    include?: number[];
    exclude?: number[];
    sort?: "asc" | "desc";
    showEmpty?: boolean;
  };
};

export type SiteConfig = {
  name: string;
  description: string;
  homeAsciiArt: string;
  homeSections: HomeSection[];
};

export const siteConfig: SiteConfig = {
  name: "Entropic",
  description: "Security Research Philes",
  homeAsciiArt: `▓█████  ███▄    █ ▄▄▄█████▓ ██▀███   ▒█████   ██▓███   ██▓ ▄████▄
▓█   ▀  ██ ▀█   █ ▓  ██▒ ▓▒▓██ ▒ ██▒▒██▒  ██▒▓██░  ██▒▓██▒▒██▀ ▀█
▒███   ▓██  ▀█ ██▒▒ ▓██░ ▒░▓██ ░▄█ ▒▒██░  ██▒▓██░ ██▓▒▒██▒▒▓█    ▄
▒▓█  ▄ ▓██▒  ▐▌██▒░ ▓██▓ ░ ▒██▀▀█▄  ▒██   ██░▒██▄█▓▒ ▒░██░▒▓▓▄ ▄██▒
░▒████▒▒██░   ▓██░  ▒██▒ ░ ░██▓ ▒██▒░ ████▓▒░▒██▒ ░  ░░██░▒ ▓███▀ ░
░░ ▒░ ░░ ▒░   ▒ ▒   ▒ ░░   ░ ▒▓ ░▒▓░░ ▒░▒░▒░ ▒▓▒░ ░  ░░▓  ░ ░▒ ▒  ░
 ░ ░  ░░ ░░   ░ ▒░    ░      ░▒ ░ ▒░  ░ ▒ ▒░ ░▒ ░      ▒ ░  ░  ▒
   ░      ░   ░ ░   ░        ░░   ░ ░ ░ ░ ▒  ░░        ▒ ░░
   ░  ░         ░             ░         ░ ░            ░  ░ ░
                                                        ░`,
  homeSections: [
    {
      title: "TL;DR",
      items: [
        {
          label: "Cybersecurity enthusiast. Idealist. Purist."
        },
        {
          label: "Researcher @RaptX",
          linkLabel: "@RaptX",
          href: "https://raptx.org/",
          external: true
        },
        { label: "My CVEs", href: "/cves/" }
      ]
    },
    {
      title: "Philes",
      volumes: {
        sort: "asc",
        showEmpty: false
      }
    },
    {
      title: "Research",
      items: [
        { label: "Binary Exploitation" },
        { label: "Windows Security" },
        { label: "IoT Security" },
        { label: "Automation" }
      ]
    },
    {
      title: "Contact",
      items: [
        { label: "root -at- cubeyond -dot- net" },
        {
          label: "PGP Encryption Key",
          href: "/assets/pgp/public-key.asc"
        },
        {
          label: "github@plt",
          href: "https://github.com/CuB3y0nd/",
          external: true,
          prefix: "~ call"
        },
        {
          label: "memos@plt",
          href: "https://memos.cubeyond.net/",
          external: true,
          prefix: "~ call"
        },
        {
          label: "kofi@plt",
          href: "https://ko-fi.com/cub3y0nd",
          external: true,
          prefix: "~ call"
        }
      ]
    }
  ]
};
