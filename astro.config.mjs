import { readdirSync } from "node:fs";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import remarkAipImages from "./scripts/remark-aip-images.mjs";

// Generate redirects for zero-padded AIP numbers: /aips/001/ → /aips/1/
const aipRedirects = {};
for (const f of readdirSync("aips").filter((f) => f.endsWith(".md"))) {
	const m = f.match(/^aip-(\d+)-/);
	if (!m) continue;
	const num = parseInt(m[1], 10);
	const pad3 = String(num).padStart(3, "0");
	const pad2 = String(num).padStart(2, "0");
	if (pad3 !== String(num)) aipRedirects[`/aips/${pad3}`] = `/aips/${num}`;
	if (pad2 !== String(num) && pad2 !== pad3)
		aipRedirects[`/aips/${pad2}`] = `/aips/${num}`;
}

// Determine if we're in CI and configure base path accordingly
const isCI = process.env.GITHUB_ACTIONS === "true";
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] || "AIPs";
const previewBase = process.env.PREVIEW_BASE; // e.g. "/pr-preview/pr-42"
const base = previewBase || (isCI ? `/${repo}` : "/");
const site = isCI
	? `https://aptos-foundation.github.io`
	: "http://localhost:4321";

// https://astro.build/config
export default defineConfig({
	site,
	base,
	redirects: aipRedirects,
	vite: {
		server: {
			fs: {
				// Allow serving files from the parent directories (for symlinks)
				allow: [".."],
			},
		},
		resolve: {
			// Preserve symlinks to allow reading AIP files
			preserveSymlinks: true,
		},
	},
	markdown: {
		remarkPlugins: [remarkAipImages],
	},
	integrations: [
		starlight({
			title: "Aptos Improvement Proposals (AIPs)",
			description:
				"Specifications and process for proposing and evolving the Aptos protocol and ecosystem.",
			favicon: "/favicon.svg",
			components: {
				Head: "./src/components/Head.astro",
			},
			head: [
				{
					tag: "meta",
					attrs: { property: "og:type", content: "website" },
				},
				{
					tag: "meta",
					attrs: {
						property: "og:site_name",
						content: "Aptos Improvement Proposals",
					},
				},
				{
					tag: "meta",
					attrs: { name: "twitter:card", content: "summary" },
				},
				{
					tag: "link",
					attrs: {
						rel: "alternate",
						type: "application/rss+xml",
						title: "Aptos Improvement Proposals",
						href: `${base.replace(/\/$/, "")}/aips/feed.xml`,
					},
				},
			],
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/aptos-foundation/AIPs",
				},
			],
			editLink: {
				baseUrl: "https://github.com/aptos-foundation/AIPs/edit/main/",
			},
			sidebar: [
				{
					label: "Overview",
					items: [
						{ label: "Home", link: "/" },
						{ label: "Browse AIPs", link: "/aips/" },
						{ label: "Submit an AIP", link: "/submit/" },
					],
				},
				{
					label: "AIPs",
					autogenerate: { directory: "aips" },
					collapsed: true,
				},
			],
			customCss: ["./src/styles/theme.css"],
			defaultLocale: "root",
			locales: {
				root: {
					label: "English",
					lang: "en",
				},
			},
			lastUpdated: true,
			pagination: true,
			tableOfContents: {
				minHeadingLevel: 2,
				maxHeadingLevel: 4,
			},
		}),
	],
});
