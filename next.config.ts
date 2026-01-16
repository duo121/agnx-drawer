import type { NextConfig } from "next"
import packageJson from "./package.json"

// Augment NextConfig to allow webpackDevMiddleware tuning in dev
type NextConfigWithDevMiddleware = NextConfig & {
    webpackDevMiddleware?: (config: any) => any
}

const nextConfig: NextConfigWithDevMiddleware = {
    /* config options here */
    output: "standalone",
    // Support for subdirectory deployment (e.g., https://example.com/nextaidrawio)
    // Set NEXT_PUBLIC_BASE_PATH environment variable to your subdirectory path (e.g., /nextaidrawio)
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
    env: {
        APP_VERSION: packageJson.version,
    },
    // Include instrumentation.ts in standalone build for Langfuse telemetry
    outputFileTracingIncludes: {
        "*": ["./instrumentation.ts"],
    },
    webpackDevMiddleware: (config: any) => {
        const projectRoot = process.cwd()

        // 仅关注当前项目，忽略其它 package/参考目录
        const shouldIgnore = (path: string) => {
            const normalized = path.replace(/\\/g, "/")

            // 需要忽略的通用目录
            if (
                normalized.includes("node_modules") ||
                normalized.includes(".git") ||
                normalized.includes(".turbo") ||
                normalized.includes(".next") ||
                normalized.includes("dist") ||
                normalized.includes("build") ||
                normalized.includes("coverage") ||
                normalized.includes(".wrangler") ||
                normalized.includes("reference")
            ) {
                return true
            }

            // 忽略 monorepo 其他 package，保留当前项目
            const inMonorepo = normalized.startsWith(`${projectRoot}/..`)
            const inProject = normalized.startsWith(projectRoot)
            if (inMonorepo && !inProject) {
                return true
            }

            return false
        }

        config.watchOptions = {
            ...config.watchOptions,
            ignored: shouldIgnore,
        }
        return config
    },
}

export default nextConfig

// Initialize OpenNext Cloudflare for local development only
// This must be a dynamic import to avoid loading workerd binary during builds
if (process.env.NODE_ENV === "development") {
    import("@opennextjs/cloudflare").then(
        ({ initOpenNextCloudflareForDev }) => {
            initOpenNextCloudflareForDev()
        },
    )
}
