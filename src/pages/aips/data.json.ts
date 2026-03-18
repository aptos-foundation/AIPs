import { getCollection } from "astro:content";

/**
 * Extract AIP number from slug
 */
const numberFromSlug = (slug: string): number | undefined => {
	// Expect slugs like "aips/aip-123" or "aips/123"
	const m = slug.match(/aips\/(?:aip[-_])?(\d+)/i);
	return m ? Number(m[1]) : undefined;
};

/**
 * GET endpoint that returns all AIPs as JSON
 */
export async function GET() {
	try {
		const docs = await getCollection("docs", (e) => e.id.startsWith("aips/"));

		const items = docs.map((e) => {
			const data = e.data as any;
			const n = data.aip ?? numberFromSlug(e.id);
			const title = data.title ?? `AIP ${n ?? ""}`.trim();

			return {
				number: n ?? null,
				slug: e.id,
				url: `/${e.id}/`,
				title,
				status: data.status ?? "Draft",
				type: data.type ?? "Uncategorized",
				author: data.author ?? [],
				created: data.created ?? null,
				updated: data.updated ?? null,
			};
		});

		// Sort by number ascending (nulls last)
		items.sort((a, b) => {
			if (a.number === null) return 1;
			if (b.number === null) return -1;
			return a.number - b.number;
		});

		return new Response(JSON.stringify(items, null, 2), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (error) {
		console.error("Error generating AIP data:", error);
		return new Response(JSON.stringify({ error: "Failed to load AIPs" }), {
			status: 500,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	}
}
