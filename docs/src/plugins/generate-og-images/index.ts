import type { LoadContext, Plugin, RouteConfig } from "@docusaurus/types";
import type { PropVersionDoc, PropVersionMetadata } from "@docusaurus/plugin-content-docs";
import { URL } from "url";

// register loaders for .ts/.tsx (sync)
import { register } from "esbuild-register/dist/node";
const { unregister } = register({ extensions: [".ts", ".tsx"] });
process.on('exit', () => unregister())

/**
 * Tries to type-safely cast from our `unknown` route to the actual docusaurus docs object
 */
function getDocsPlugin(plugin: RouteConfig): PropVersionMetadata | undefined {
  if (plugin.props == null) return undefined
  if (!("version" in plugin.props)) return undefined
  const version = plugin.props.version
  if (version == null || (typeof version !== "object") || !("docs" in version)) return undefined
  const docs = version.docs
  if (docs == null || typeof docs !== 'object') return undefined

  return version as PropVersionMetadata
}

/**
 * Recursively gets all doc pages for this project
 */
function getAllDocsRoutes(plugin: RouteConfig): PropVersionDoc[] {
  const pages: PropVersionDoc[] = []
  const docsPlugin = getDocsPlugin(plugin)
  if (docsPlugin != null) {
    const docs = Object.values(docsPlugin.docs)
    pages.push(...docs)
  }
  if (plugin.routes != null) {
    const subPages = plugin.routes.flatMap((r) => getAllDocsRoutes(r))
    pages.push(...subPages)
  }
  return pages
}

interface Options {
  width?: number
  height?: number
}

export default function plugin(context: LoadContext, { width, height }: Options = {}): Plugin {
  return {
    name: 'generate-og-images',
    async postBuild({ outDir, routes, siteConfig }) {
      const docsPages = routes.flatMap((r) => getAllDocsRoutes(r))
      if (docsPages.length === 0) {
        throw new Error(`Failed to generate og-images for ${outDir} - no docs pages were found!`)
      }
      const baseUrl = new URL(siteConfig.baseUrl, siteConfig.url)
      // @ts-expect-error we enabled .tsx import in esbuild at the top
      const { runPlugin } = (await import("./plugin.tsx"));
      await runPlugin({
        width: width ?? 1200,
        height: height ?? 640,
        baseUrl: baseUrl.href,
        outDirectory: outDir,
        docsPages: docsPages
      })
    }
  }
}
