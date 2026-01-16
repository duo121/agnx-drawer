/**
 * 跨平台配置同步
 * 让 Electron 和 Tauri 共享用户配置
 */

const CONFIG_FILE_NAME = 'agnx-drawer-config.json'

interface AppConfig {
  darkMode: boolean
  drawioTheme: 'min' | 'sketch'
  locale: string
  closeProtection: boolean
}

// 检测运行环境
const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

/**
 * 获取配置文件路径
 */
async function getConfigPath(): Promise<string | null> {
  if (isTauri) {
    // Tauri: 使用 app data 目录
    const { appDataDir } = await import('@tauri-apps/api/path')
    const appData = await appDataDir()
    return `${appData}${CONFIG_FILE_NAME}`
  } else if (isElectron) {
    // Electron: 可以通过 IPC 获取路径
    // 这里暂时返回 null，使用 localStorage
    return null
  }
  return null
}

/**
 * 从文件读取配置
 */
async function readConfigFromFile(): Promise<Partial<AppConfig> | null> {
  try {
    const configPath = await getConfigPath()
    if (!configPath) return null

    if (isTauri) {
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
      if (await exists(configPath)) {
        const content = await readTextFile(configPath)
        return JSON.parse(content)
      }
    }
  } catch (error) {
    console.warn('[ConfigSync] Failed to read config file:', error)
  }
  return null
}

/**
 * 写入配置到文件
 */
async function writeConfigToFile(config: Partial<AppConfig>): Promise<void> {
  try {
    const configPath = await getConfigPath()
    if (!configPath) return

    if (isTauri) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(configPath, JSON.stringify(config, null, 2))
    }
  } catch (error) {
    console.warn('[ConfigSync] Failed to write config file:', error)
  }
}

/**
 * 从 localStorage 读取配置
 */
function readConfigFromLocalStorage(): Partial<AppConfig> {
  const config: Partial<AppConfig> = {}

  const darkMode = localStorage.getItem('agnx-dark-mode')
  if (darkMode !== null) {
    config.darkMode = darkMode === 'true'
  }

  const drawioTheme = localStorage.getItem('drawio-theme')
  if (drawioTheme === 'min' || drawioTheme === 'sketch') {
    config.drawioTheme = drawioTheme
  }

  const locale = localStorage.getItem('agnx-locale')
  if (locale) {
    config.locale = locale
  }

  const closeProtection = localStorage.getItem('close-protection')
  if (closeProtection !== null) {
    config.closeProtection = closeProtection === 'true'
  }

  return config
}

/**
 * 写入配置到 localStorage
 */
function writeConfigToLocalStorage(config: Partial<AppConfig>): void {
  if (config.darkMode !== undefined) {
    localStorage.setItem('agnx-dark-mode', String(config.darkMode))
  }
  if (config.drawioTheme !== undefined) {
    localStorage.setItem('drawio-theme', config.drawioTheme)
  }
  if (config.locale !== undefined) {
    localStorage.setItem('agnx-locale', config.locale)
  }
  if (config.closeProtection !== undefined) {
    localStorage.setItem('close-protection', String(config.closeProtection))
  }
}

/**
 * 加载配置（优先从文件，回退到 localStorage）
 */
export async function loadConfig(): Promise<Partial<AppConfig>> {
  // 先尝试从文件读取
  const fileConfig = await readConfigFromFile()
  if (fileConfig && Object.keys(fileConfig).length > 0) {
    // 同步到 localStorage
    writeConfigToLocalStorage(fileConfig)
    return fileConfig
  }

  // 回退到 localStorage
  return readConfigFromLocalStorage()
}

/**
 * 保存配置（同时写入文件和 localStorage）
 */
export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  // 写入 localStorage
  writeConfigToLocalStorage(config)

  // 写入文件
  await writeConfigToFile(config)
}

/**
 * 获取单个配置项
 */
export function getConfigItem<K extends keyof AppConfig>(
  key: K
): AppConfig[K] | undefined {
  const config = readConfigFromLocalStorage()
  return config[key]
}

/**
 * 设置单个配置项
 */
export async function setConfigItem<K extends keyof AppConfig>(
  key: K,
  value: AppConfig[K]
): Promise<void> {
  await saveConfig({ [key]: value })
}
