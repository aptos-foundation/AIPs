import { getCollection } from "astro:content";

const SITE_URL = "https://aptos-foundation.github.io/AIPs";

const escapeXml = (s: string): string =>
	s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

const numberFromSlug = (slug: string): number | undefined => {
	const m = slug.match(/aips\/(?:aip[-_])?(\d+)/i);
	return m ? Number(m[1]) : undefined;
};

/**
 * Parse a date string (MM/DD/YYYY or YYYY-MM-DD or Date) to RFC-2822 format.
 */
const toRfc2822 = (raw: unknown): string | null => {
	if (!raw) return null;
	let d: Date;
	if (raw instanceof Date) {
		d = raw;
	} else {
		const s = String(raw);
		// Handle MM/DD/YYYY
		const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
		if (mdy) {
			d = new Date(`${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}T00:00:00Z`);
		} else {
			d = new Date(s);
		}
	}
	return isNaN(d.getTime()) ? null : d.toUTCString();
};

export async function GET() {
	const docs = await getCollection("docs", (e) => e.id.startsWith("aips/"));

	const items = docs.map((e) => {
		const data = e.data as any;
		const n = data.aip ?? numberFromSlug(e.id);
		const title = data.title ?? `AIP ${n ?? ""}`.trim();
		const status = data.status ?? "Draft";
		const type = data.type ?? "Uncategorized";
		const created = data.created ?? null;
		const description = data.description ?? `${title} — Status: ${status}, Type: ${type}`;

		return { number: n, title, status, type, created, description, slug: e.id };
	});

	// Sort by created date descending (newest first), nulls last
	items.sort((a, b) => {
		const da = a.created ? new Date(String(a.created)).getTime() : 0;
		const db = b.created ? new Date(String(b.created)).getTime() : 0;
		return db - da;
	});

	const rssItems = items
		.map((item) => {
			const link = `${SITE_URL}/aips/${item.number ?? item.slug}/`;
			const pubDate = toRfc2822(item.created);
			return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ""}
      <category>${escapeXml(item.type)}</category>
      <description>${escapeXml(item.description)}</description>
    </item>`;
		})
		.join("\n");

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Aptos Improvement Proposals</title>
    <link>${SITE_URL}/aips/</link>
    <description>Specifications and process for proposing and evolving the Aptos protocol and ecosystem.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/aips/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
