import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import remarkAipImages from "./scripts/remark-aip-images.mjs";

// Determine if we're in CI and configure base path accordingly
const isCI = process.env.GITHUB_ACTIONS === "true";
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] || "AIPs";
const base = isCI ? `/${repo}` : "/";
const site = isCI
  ? `https://aptos-foundation.github.io/${repo}/`
  : "http://localhost:4321/";

// https://astro.build/config
export default defineConfig({
  site,
  base,
  vite: {
    server: {
      fs: {
        // Allow serving files from the parent directories (for symlinks)
        allow: [".."]
      }
    },
    resolve: {
      // Preserve symlinks to allow reading AIP files
      preserveSymlinks: true
    }
  },
  markdown: {
    remarkPlugins: [remarkAipImages],
  },
  integrations: [
    starlight({
      title: "Aptos Improvement Proposals (AIPs)",
      description:
        "Specifications and process for proposing and evolving the Aptos protocol and ecosystem.",
      social: {
        github: "https://github.com/aptos-foundation/AIPs",
      },
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
    }),
  ],
});
