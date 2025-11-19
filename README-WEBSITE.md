# AIPs Website Development

This repository contains a [Starlight](https://starlight.astro.build)-based documentation website for Aptos Improvement Proposals (AIPs).

## 🚀 Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   
   The site will be available at `http://localhost:4321/`

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Preview the production build**:
   ```bash
   npm run preview
   ```

## 📁 Project Structure

```
/
├── aips/                   # AIP markdown files (preserved in original location)
├── diagrams/               # Images and diagrams referenced by AIPs
├── src/
│   ├── content/
│   │   ├── docs/
│   │   │   ├── aips/      # Symlink to /aips directory
│   │   │   ├── index.mdx  # Homepage
│   │   │   └── submit.md  # Submission guide
│   │   └── config.ts      # Content schema with AIP metadata normalization
│   ├── pages/
│   │   └── aips/
│   │       ├── index.astro  # Interactive browse page with filters
│   │       └── data.json.ts # JSON API endpoint for AIP metadata
│   └── styles/
│       └── theme.css      # Custom Aptos theme styling
├── scripts/
│   └── remark-aip-images.mjs  # Plugin to rewrite image paths
├── public/
│   └── diagrams/          # Symlink to /diagrams directory
├── astro.config.mjs       # Astro configuration
└── tsconfig.json          # TypeScript configuration
```

## ✨ Key Features

### 1. **No File Movement**
All AIP markdown files remain in the original `/aips/` directory. The website uses symlinks to access them without moving or modifying the original files.

### 2. **Interactive Browse Page**
The `/aips/` page provides:
- **Search**: Find AIPs by number or title
- **Filters**: Filter by status (Draft, Accepted, In Review, etc.) and category (Framework, Core, Gas, etc.)
- **Sorting**: Sort by AIP number, status, or category

### 3. **Metadata Normalization**
AIP frontmatter is automatically normalized during build:
- **Status**: Inconsistent status values (e.g., "Draft ", "draft", "DRAFT") are normalized to consistent values
- **Category/Type**: Various type formats (e.g., "Standard (Framework)", "Framework", "Standard Framework") are normalized to canonical categories

### 4. **Global Search**
Powered by Pagefind, the search function indexes all AIP content and allows users to quickly find relevant proposals.

### 5. **Responsive Design**
The site is fully responsive and works on desktop, tablet, and mobile devices.

## 🔧 Adding a New AIP

1. Create your AIP markdown file in the `/aips/` directory following the naming convention:
   ```bash
   cp TEMPLATE.md aips/your-feature-name.md
   ```

2. The new AIP will automatically appear on the website after the next build. No configuration changes needed!

3. For local development, the dev server will hot-reload and show your new AIP immediately.

## 🎨 Customization

### Theme Colors
Edit `src/styles/theme.css` to customize the Aptos brand colors and styling.

### Homepage
Edit `src/content/docs/index.mdx` to update the homepage content.

### Sidebar
Edit the `sidebar` configuration in `astro.config.mjs` to customize navigation.

## 🚀 Deployment

### GitHub Pages
The site is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the `main` branch.

**Workflow file**: `.github/workflows/pages.yml`

The workflow:
1. Checks out the code
2. Installs Node.js 20 and dependencies
3. Builds the site with `npm run build`
4. Deploys the `dist/` folder to GitHub Pages

### Manual Deployment
To manually trigger a deployment, go to the Actions tab on GitHub and run the "Deploy Starlight to GitHub Pages" workflow.

## 📝 Content Schema

AIPs are automatically validated and normalized using Zod schemas defined in `src/content/config.ts`:

- **aip** (number): AIP number
- **title** (string): AIP title
- **author** (string | string[]): Author(s)
- **discussions-to** (string): Discussion URL
- **status** (string): Normalized status value
- **type** (string): Normalized category value
- **created** (date): Creation date
- **updated** (date): Last update date
- **requires** (string | string[]): Required AIPs

## 🐛 Troubleshooting

### Symlinks not working
Ensure git is configured to handle symlinks:
```bash
git config core.symlinks true
```

### Build fails with "Cannot find module"
Try removing `node_modules` and reinstalling:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Images not showing
Verify that the `/public/diagrams` symlink points to the correct location:
```bash
ls -la public/diagrams
```

## 📚 Learn More

- [Starlight Documentation](https://starlight.astro.build/)
- [Astro Documentation](https://docs.astro.build/)
- [AIP Submission Guide](https://github.com/aptos-foundation/AIPs/blob/main/README.md)

## 🤝 Contributing

Contributions to improve the website are welcome! Please follow the standard GitHub workflow:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For AIP content contributions, please refer to the main [README.md](README.md).
