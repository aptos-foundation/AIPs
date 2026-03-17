#!/usr/bin/env node
// @ts-check
/**
 * Validate AIP front matter across all Markdown files.
 * Zero external dependencies — uses only node:fs and node:path.
 *
 * Exit code 0 = all good (warnings are OK).
 * Exit code 1 = at least one error found.
 */

import {readdirSync, readFileSync} from "node:fs";
import {basename, join} from "node:path";

// ── Helpers ported from src/content.config.ts ──────────────────────

/** Strip HTML comments, YAML inline comments, angle-bracket wrappers, extra whitespace. */
function norm(s) {
	return String(s ?? "")
		.replace(/<!--.*?-->/g, "")
		.replace(/#.*$/g, "")
		.replace(/^\s*<(.*)>\s*$/, "$1")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Map raw status to a known canonical value, or return an empty string for unknown.
 * @param {any} raw
 */
function statusNormalize(raw) {
	const s = norm(raw).toLowerCase();
	if (!s) return "";
	if (["draft", "wip", "work in progress"].some((k) => s.includes(k)))
		return "Draft";
	if (["accepted", "final"].some((k) => s.includes(k))) return "Accepted";
	if (["in review", "review", "last call"].some((k) => s.includes(k)))
		return "In Review";
	if (["rejected"].some((k) => s.includes(k))) return "Rejected";
	if (
		["on hold", "deferred", "stagnant", "paused"].some((k) => s.includes(k))
	)
		return "On Hold";
	return "";
}

/**
 * True if the value looks like an unfilled template placeholder.
 * @param {any} v
 */
function isPlaceholder(v) {
	const n = norm(v);
	if (!n) return false;
	// e.g. "mm/dd/yyyy", "AIP title", "Standard (Core, …) | Informational | Process"
	if (/\|/.test(n)) return true;
	if (/^mm\/dd\/yyyy/i.test(n)) return true;
	if (/^AIP\s+(title|number)/i.test(n)) return true;
	return /determined by the AIP/i.test(n);

}

/**
 * Try to parse a date string — returns true if parseable.
 * @param {any} v
 */
function isParseableDate(v) {
	const n = norm(v);
	if (!n) return false;
	if (isPlaceholder(v)) return false;
	const d = new Date(n);
	return !isNaN(d.getTime());
}

// ── Frontmatter parser ─────────────────────────────────────────────

/**
 * Extract frontmatter key/value pairs from Markdown content.
 * Returns null if no frontmatter delimiters are found.
 * @param {string} content
 */
function parseFrontmatter(content) {
	const lines = content.split("\n");
	if (lines[0].trim() !== "---") return null;

	let endIdx = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			endIdx = i;
			break;
		}
	}
	if (endIdx === -1) return null;

	const fm = {};
	let currentKey = null;

	for (let i = 1; i < endIdx; i++) {
		const line = lines[i];

		// YAML list continuation: "  - item"
		if (/^\s+-\s/.test(line) && currentKey) {
			const item = line.replace(/^\s+-\s*/, "").trim();
			if (item) {
				const prev = fm[currentKey];
				fm[currentKey] = prev ? `${prev}, ${item}` : item;
			}
			continue;
		}

		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;

		let key = line
			.slice(0, colonIdx)
			.trim()
			.toLowerCase()
			.replace(/\s*\(\*optional\)/g, ""); // strip (*optional)

		// Normalize "authors" → "author"
		if (key === "authors") key = "author";

		fm[key] = line.slice(colonIdx + 1).trim();
		currentKey = key;
	}

	return fm;
}

// ── Validation ─────────────────────────────────────────────────────

/**
 * Validate a single AIP file. Returns { errors: [], warnings: [] }.
 * @param {import("fs").PathOrFileDescriptor} filePath
 */
function validateFile(filePath) {
	const errors = [];
	const warnings = [];
	const fileName = basename(filePath);

	const content = readFileSync(filePath, "utf-8");
	const fm = parseFrontmatter(content);

	// E001: No frontmatter
	if (!fm) {
		errors.push({ code: "E001", msg: "No frontmatter found" });
		return { errors, warnings };
	}

	// ── aip field ──

	const rawAip = fm.aip;

	// E002: Missing aip
	if (rawAip === undefined || rawAip === "") {
		errors.push({ code: "E002", msg: "Missing `aip` field" });
	} else {
		const aipNum = Number(norm(rawAip));

		// E003: Not a valid non-negative integer
		if (!Number.isInteger(aipNum) || aipNum < 0) {
			errors.push({
				code: "E003",
				msg: `\`aip\` is not a valid non-negative integer: "${rawAip}"`,
			});
		} else {
			// E004: Doesn't match filename
			const fileMatch = fileName.match(/^aip-(\d+)-/);
			if (fileMatch) {
				const fileNum = parseInt(fileMatch[1], 10);
				if (fileNum !== aipNum) {
					errors.push({
						code: "E004",
						msg: `AIP number ${aipNum} doesn't match filename number ${fileNum}`,
					});
				}
			}
		}
	}

	// E005: Missing title
	if (fm.title === undefined || norm(fm.title) === "") {
		errors.push({ code: "E005", msg: "Missing `title`" });
	}

	// ── status ──

	const rawStatus = fm.status;
	if (rawStatus === undefined || rawStatus === "") {
		// E006: Missing status
		errors.push({ code: "E006", msg: "Missing `status`" });
	} else {
		const normalized = statusNormalize(rawStatus);
		if (!normalized) {
			// E007: Unknown status
			errors.push({
				code: "E007",
				msg: `Status doesn't normalize to a known value: "${rawStatus}"`,
			});
		}
	}

	// ── type ──

	if (fm.type === undefined || norm(fm.type) === "") {
		errors.push({ code: "E008", msg: "Missing `type`" });
	} else if (isPlaceholder(fm.type)) {
		warnings.push({
			code: "W003",
			msg: `Type appears to be a template placeholder: "${fm.type}"`,
		});
	}

	// ── author (warning only) ──

	if (fm.author === undefined || norm(fm.author) === "") {
		warnings.push({ code: "W001", msg: "Missing `author`" });
	}

	// ── created date (warning only) ──

	if (fm.created === undefined || norm(fm.created) === "") {
		warnings.push({ code: "W002", msg: "Missing `created` date" });
	} else if (!isParseableDate(fm.created)) {
		warnings.push({
			code: "W002",
			msg: `Unparseable \`created\` date: "${fm.created}"`,
		});
	}

	return { errors, warnings };
}

// ── Main ───────────────────────────────────────────────────────────

const aipsDir = join(process.cwd(), "aips");
const files = readdirSync(aipsDir)
	.filter((f) => f.endsWith(".md"))
	.sort();

let totalErrors = 0;
let totalWarnings = 0;
const results = [];

for (const file of files) {
	const filePath = join(aipsDir, file);
	const { errors, warnings } = validateFile(filePath);
	totalErrors += errors.length;
	totalWarnings += warnings.length;
	if (errors.length > 0 || warnings.length > 0) {
		results.push({ file, errors, warnings });
	}
}

// ── Output ─────────────────────────────────────────────────────────

if (results.length > 0) {
	for (const { file, errors, warnings } of results) {
		console.log(`\n${file}`);
		for (const e of errors) {
			console.log(`  ERROR  ${e.code}: ${e.msg}`);
		}
		for (const w of warnings) {
			console.log(`  WARN   ${w.code}: ${w.msg}`);
		}
	}
	console.log();
}

console.log(
	`Validated ${files.length} files: ${totalErrors} error(s), ${totalWarnings} warning(s)`,
);

if (totalErrors > 0) {
	process.exit(1);
}
