import { defineCollection, z } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";

/**
 * Normalize string values by removing HTML comments and extra whitespace
 */
const norm = (s?: unknown): string =>
  String(s ?? "")
    .replace(/<!--.*?-->/g, "")
    .replace(/#.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Normalize status values to a consistent set
 */
const statusNormalize = (raw?: unknown): string => {
  const s = norm(raw).toLowerCase();
  if (!s) return "Draft";
  if (["draft", "wip", "work in progress"].some((k) => s.includes(k)))
    return "Draft";
  if (["accepted", "final"].some((k) => s.includes(k))) return "Accepted";
  if (["in review", "review", "last call"].some((k) => s.includes(k)))
    return "In Review";
  if (["rejected"].some((k) => s.includes(k))) return "Rejected";
  if (["on hold", "deferred", "stagnant", "paused"].some((k) => s.includes(k)))
    return "On Hold";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Normalize type/category values to a consistent set
 */
const typeNormalize = (raw?: unknown): string => {
  const t = norm(raw).toLowerCase();
  if (!t) return "Uncategorized";
  
  const repl = t
    .replace(/standard\s*\(?\s*framework\)?/g, "framework")
    .replace(/standard\s*\(?\s*core\)?/g, "core")
    .replace(/standard\s*framework/g, "framework")
    .replace(/\s+/g, " ")
    .trim();

  if (repl.includes("framework")) return "Framework";
  if (repl.includes("core")) return "Core";
  if (repl.includes("gas")) return "Gas";
  if (repl.includes("crypto")) return "Cryptography";
  if (repl.includes("ecosystem")) return "Ecosystem";
  if (repl.includes("informational")) return "Informational";
  if (repl.includes("governance")) return "Governance";
  if (repl.includes("vm") || repl.includes("execution")) return "VM";
  if (repl.includes("network") || repl.includes("consensus")) return "Networking";
  if (repl.includes("language")) return "Language";
  return repl.charAt(0).toUpperCase() + repl.slice(1);
};

/**
 * Convert various date formats to Date objects
 */
const toDate = (v?: unknown): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const s = norm(v);
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
};

/**
 * Convert string or array to string array
 */
const toStringArray = (v?: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => norm(x)).filter(Boolean);
  const s = norm(v);
  if (!s) return [];
  // Handle both comma-separated and quoted comma-separated values
  // e.g., "AIP-10, AIP-11" or '"AIP-10", "AIP-11"'
  if (s.includes(",")) {
    return s
      .split(",")
      .map((x) => x.replace(/^"|"$/g, "").trim()) // Remove surrounding quotes
      .filter(Boolean);
  }
  return [s];
};

export const collections = {
  docs: defineCollection({
    type: "content",
    schema: docsSchema({
      extend: z.object({
        aip: z.number().int().nonnegative().optional(),
        title: z.string().optional(),
        author: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .nullable()
          .transform(toStringArray),
        "discussions-to": z.string().optional().nullable(),
        status: z.any().optional().nullable().transform(statusNormalize),
        type: z.any().optional().nullable().transform(typeNormalize),
        created: z
          .union([z.string(), z.date()])
          .optional()
          .nullable()
          .transform(toDate),
        updated: z
          .union([z.string(), z.date()])
          .optional()
          .nullable()
          .transform(toDate),
        requires: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .nullable()
          .transform(toStringArray),
        "last-call-end-date": z.string().optional().nullable(),
      }),
    }),
  }),
};
