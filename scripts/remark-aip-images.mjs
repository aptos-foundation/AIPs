import { visit } from "unist-util-visit";

/**
 * Remark plugin to normalize image paths in AIP markdown files.
 * Rewrites relative diagram paths to absolute paths for proper rendering.
 */
export default function remarkAipImages() {
	return (tree) => {
		visit(tree, "image", (node) => {
			if (!node || !node.url) return;
			const url = String(node.url);

			// Normalize common forms to absolute paths:
			// "../diagrams/foo.png" -> "/diagrams/foo.png"
			// "./diagrams/foo.png"  -> "/diagrams/foo.png"
			// "diagrams/foo.png"    -> "/diagrams/foo.png"
			if (url.startsWith("../diagrams/")) {
				node.url = "/diagrams/" + url.slice("../diagrams/".length);
			} else if (url.startsWith("./diagrams/")) {
				node.url = "/diagrams/" + url.slice("./diagrams/".length);
			} else if (url.startsWith("diagrams/")) {
				node.url = "/diagrams/" + url.slice("diagrams/".length);
			}
			// Leave absolute "/diagrams/..." and external URLs as-is
		});
	};
}
