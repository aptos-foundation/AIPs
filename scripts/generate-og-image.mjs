/**
 * Generates a static OG image (1200x630 PNG) for social sharing.
 * Uses sharp to render an SVG template to PNG.
 * Run: node scripts/generate-og-image.mjs
 */
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

// Aptos brand colors
const BG = "#0b1929";
const ACCENT = "#06d6a0";
const TEXT = "#e8edf3";
const SUBTLE = "#6b7d94";

const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#0f2744"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="#2ec4b6"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Decorative grid lines -->
  <g opacity="0.06" stroke="${ACCENT}" stroke-width="1">
    <line x1="0" y1="210" x2="${WIDTH}" y2="210"/>
    <line x1="0" y1="420" x2="${WIDTH}" y2="420"/>
    <line x1="400" y1="0" x2="400" y2="${HEIGHT}"/>
    <line x1="800" y1="0" x2="800" y2="${HEIGHT}"/>
  </g>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${WIDTH}" height="4" fill="url(#accent)"/>

  <!-- AIP icon / logo mark -->
  <g transform="translate(80, 160)">
    <rect x="0" y="0" width="64" height="64" rx="12" fill="${ACCENT}" opacity="0.15"/>
    <text x="32" y="44" font-family="system-ui, sans-serif" font-size="36" font-weight="700"
          fill="${ACCENT}" text-anchor="middle">A</text>
  </g>

  <!-- Title -->
  <text x="80" y="300" font-family="system-ui, sans-serif" font-size="56" font-weight="700" fill="${TEXT}">
    Aptos Improvement
  </text>
  <text x="80" y="370" font-family="system-ui, sans-serif" font-size="56" font-weight="700" fill="${TEXT}">
    Proposals
  </text>

  <!-- Subtitle -->
  <text x="80" y="430" font-family="system-ui, sans-serif" font-size="24" fill="${SUBTLE}">
    Protocol specifications for the Aptos blockchain
  </text>

  <!-- Bottom accent bar -->
  <rect x="80" y="500" width="120" height="4" rx="2" fill="url(#accent)"/>

  <!-- URL -->
  <text x="80" y="560" font-family="monospace" font-size="18" fill="${SUBTLE}">
    aptos-foundation.github.io/AIPs
  </text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og-image.png");
console.log("Generated public/og-image.png (1200x630)");
