# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Aptos Improvement Proposals (AIPs) repository, which contains the specification documents and website for the Aptos blockchain protocol improvements. It's an Astro-based static site generator using Starlight for documentation.

## Development Commands

Development server:
```bash
npm run dev
npm start  # alias for dev
```

Build and validation:
```bash
npm run build  # runs astro check then astro build
npm run check  # type checking and validation
```

Preview built site:
```bash
npm run preview
```

## Architecture and Structure

### Core Components
- **AIPs Directory (`aips/`)**: Contains all AIP markdown files (aip-0.md through aip-135.md+)
- **Astro Configuration (`astro.config.mjs`)**: Configures Starlight with dynamic base paths for GitHub Pages deployment
- **Content Schema (`src/content/config.ts`)**: Defines and validates AIP frontmatter with normalization functions
- **Remark Plugin (`scripts/remark-aip-images.mjs`)**: Processes image paths in AIP markdown files

### Content Management
- Uses Astro's content collections to manage AIPs as structured data
- Frontmatter schema validates and normalizes AIP metadata (status, type, dates, authors)
- Auto-generates sidebar navigation from the `aips/` directory
- Supports symlinks for content files (preserved via Vite config)

### AIP Structure
AIPs follow the TEMPLATE.md format with required frontmatter:
- `aip`: Number (assigned by AIP manager)
- `title`: AIP title
- `author`: List of authors
- `status`: Draft | In Review | Accepted | Rejected | On Hold
- `type`: Framework | Core | Gas | Cryptography | Ecosystem | etc.
- `created`: Creation date
- Optional: `updated`, `requires`, `discussions-to`

### Build Configuration
- Dynamic base path configuration for GitHub Pages deployment
- Image path normalization for diagrams in `/diagrams/` directory
- TypeScript support with strict checking
- Starlight integration for documentation theming

## Styling and Theming
- The site uses a custom Aptos-inspired theme with teal/turquoise accent colors
- Typography uses Inter font family for modern, clean appearance
- Dark/light theme support with Aptos brand colors
- Custom CSS variables for consistent color usage across components

## Key Files for Development
- `src/content/config.ts`: Content schema and validation logic
- `astro.config.mjs`: Site configuration and integrations  
- `scripts/remark-aip-images.mjs`: Image processing plugin
- `src/styles/theme.css`: Aptos brand theming and custom styles
- `TEMPLATE.md`: Template for new AIPs