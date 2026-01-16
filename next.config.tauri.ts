import type { NextConfig } from "next"
import packageJson from "./package.json"

const nextConfig: NextConfig = {
    output: "export",
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
    env: {
        APP_VERSION: packageJson.version,
    },
    images: {
        unoptimized: true,
    },
}

export default nextConfig
