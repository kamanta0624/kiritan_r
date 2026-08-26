import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// public/characters/ymm4/ 配下の charKey 一覧を索引ファイルへ書き出す。
// public/ は Vite のモジュールグラフに乗らず import.meta.glob が使えないため、
// dev起動時・build開始時にファイルシステムを直接走査して索引を再生成する。
// これにより後から charKey フォルダが増えても手動更新なしで QA 画面に反映される。
function ymm4IndexPlugin() {
  const dir = path.resolve(__dirname, 'public/characters/ymm4')
  const indexPath = path.join(dir, '_index.json')
  const write = () => {
    if (!fs.existsSync(dir)) return
    const charKeys = fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
    fs.writeFileSync(indexPath, JSON.stringify(charKeys))
  }
  return {
    name: 'ymm4-index',
    buildStart() { write() },
    configureServer() { write() },
  }
}

export default defineConfig({
  plugins: [react(), ymm4IndexPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@game': path.resolve(__dirname, './src/game'),
    },
  },
})
