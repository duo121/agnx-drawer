/**
 * Tauri API 封装
 * 提供统一的文件操作接口，兼容 Electron 和 Tauri
 */

// 检测是否在 Tauri 环境中
export const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

// 动态导入 Tauri API（仅在 Tauri 环境中）
let tauriDialog: any = null
let tauriFs: any = null

if (isTauri) {
  import('@tauri-apps/plugin-dialog').then(module => {
    tauriDialog = module
  })
  import('@tauri-apps/plugin-fs').then(module => {
    tauriFs = module
  })
}

export interface TauriAPI {
  /** 是否在 Tauri 环境中 */
  isTauri: boolean
  /** 打开文件对话框并读取文件内容 */
  openFile: (fileType?: 'drawio' | 'excalidraw') => Promise<string | null>
  /** 保存文件对话框并写入文件内容 */
  saveFile: (data: string, fileType?: 'drawio' | 'excalidraw') => Promise<boolean>
  /** 导出图片 */
  exportImage: (data: string, format: 'png' | 'svg') => Promise<boolean>
}

/**
 * 打开文件对话框并读取文件内容
 */
async function openFile(fileType?: 'drawio' | 'excalidraw'): Promise<string | null> {
  if (!isTauri || !tauriDialog || !tauriFs) {
    console.warn('[Tauri] API not available')
    return null
  }

  try {
    // 根据文件类型设置过滤器
    const filters = fileType === 'excalidraw'
      ? [
          { name: 'Excalidraw Files', extensions: ['excalidraw'] },
          { name: 'JSON Files', extensions: ['json'] },
        ]
      : [
          { name: 'Draw.io Files', extensions: ['drawio', 'xml'] },
        ]

    // 打开文件对话框
    const selected = await tauriDialog.open({
      multiple: false,
      filters,
    })

    if (!selected || typeof selected !== 'string') {
      return null
    }

    // 读取文件内容
    const content = await tauriFs.readTextFile(selected)
    return content
  } catch (error) {
    console.error('[Tauri] Failed to open file:', error)
    return null
  }
}

/**
 * 保存文件对话框并写入文件内容
 */
async function saveFile(data: string, fileType?: 'drawio' | 'excalidraw'): Promise<boolean> {
  if (!isTauri || !tauriDialog || !tauriFs) {
    console.warn('[Tauri] API not available')
    return false
  }

  try {
    // 根据文件类型设置过滤器和默认文件名
    const filters = fileType === 'excalidraw'
      ? [
          { name: 'Excalidraw Files', extensions: ['excalidraw'] },
          { name: 'JSON Files', extensions: ['json'] },
        ]
      : [
          { name: 'Draw.io Files', extensions: ['drawio'] },
          { name: 'XML Files', extensions: ['xml'] },
        ]

    const defaultPath = fileType === 'excalidraw' ? 'diagram.excalidraw' : 'diagram.drawio'

    // 打开保存对话框
    const selected = await tauriDialog.save({
      filters,
      defaultPath,
    })

    if (!selected || typeof selected !== 'string') {
      return false
    }

    // 写入文件
    await tauriFs.writeTextFile(selected, data)
    return true
  } catch (error) {
    console.error('[Tauri] Failed to save file:', error)
    return false
  }
}

/**
 * 导出图片
 */
async function exportImage(data: string, format: 'png' | 'svg'): Promise<boolean> {
  if (!isTauri || !tauriDialog || !tauriFs) {
    console.warn('[Tauri] API not available')
    return false
  }

  try {
    const filters = format === 'png'
      ? [{ name: 'PNG Images', extensions: ['png'] }]
      : [{ name: 'SVG Images', extensions: ['svg'] }]

    const defaultPath = `diagram.${format}`

    const selected = await tauriDialog.save({
      filters,
      defaultPath,
    })

    if (!selected || typeof selected !== 'string') {
      return false
    }

    if (format === 'svg') {
      // SVG 是文本格式，直接写入
      await tauriFs.writeTextFile(selected, data)
    } else {
      // PNG 是 base64 编码，需要解码
      const base64Data = data.replace(/^data:image\/png;base64,/, '')
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      await tauriFs.writeBinaryFile(selected, binaryData)
    }

    return true
  } catch (error) {
    console.error('[Tauri] Failed to export image:', error)
    return false
  }
}

// 导出 API
export const tauriAPI: TauriAPI = {
  isTauri,
  openFile,
  saveFile,
  exportImage,
}
