import { getCollection } from "astro:content";

const numberFromSlug = (slug: string): number | undefined => {
	const m = slug.match(/aips\/(?:aip[-_])?(\d+)/i);
	return m ? Number(m[1]) : undefined;
};

export async function GET() {
	const docs = await getCollection("docs", (e) => e.id.startsWith("aips/"));

	const items = docs.map((e) => {
		const data = e.data as any;
		const n = data.aip ?? numberFromSlug(e.id);
		return { entry: e, number: n };
	});

	items.sort((a, b) => {
		if (a.number === null || a.number === undefined) return 1;
		if (b.number === null || b.number === undefined) return -1;
		return a.number - b.number;
	});

	const lines: string[] = [
		"# Aptos Improvement Proposals — Full Index",
		"",
		`Generated: ${new Date().toISOString().split("T")[0]}`,
		`Total AIPs: ${items.length}`,
		"",
		"---",
		"",
	];

	for (const { entry, number } of items) {
		const data = entry.data as any;
		const title = data.title ?? `AIP ${number ?? ""}`.trim();
		const status = data.status ?? "Draft";
		const type = data.type ?? "Uncategorized";
		const authors = Array.isArray(data.author)
			? data.author.join(", ")
			: (data.author ?? "Unknown");

		lines.push(`## AIP-${number ?? "?"}: ${title}`);
		lines.push("");
		lines.push(`- Status: ${status}`);
		lines.push(`- Type: ${type}`);
		lines.push(`- Authors: ${authors}`);
		if (data.created) lines.push(`- Created: ${data.created}`);
		if (data.updated) lines.push(`- Updated: ${data.updated}`);
		lines.push(`- URL: /aips/${number ?? entry.id}/`);
		lines.push("");

		// Include the raw markdown body if available
		if (entry.body) {
			// Strip frontmatter block if present in body
			const body = entry.body.replace(/^---[\s\S]*?---\n*/, "").trim();
			if (body) {
				lines.push(body);
				lines.push("");
			}
		}

		lines.push("---");
		lines.push("");
	}

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
