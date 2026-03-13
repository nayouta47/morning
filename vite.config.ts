import { defineConfig, Plugin } from 'vite'
import fs from 'fs'
import path from 'path'

function gameDataPlugin(): Plugin {
  function generate() {
    const eventsPath = path.resolve(__dirname, 'src/data/events.ts')
    const enemiesPath = path.resolve(__dirname, 'src/data/enemies.ts')
    const outPath = path.resolve(__dirname, 'public/tools/game-data.json')

    const eventsContent = fs.readFileSync(eventsPath, 'utf-8')
    const enemiesContent = fs.readFileSync(enemiesPath, 'utf-8')

    // Extract EVENT_NAMES block
    const eventNamesMatch = eventsContent.match(/EVENT_NAMES\s*=\s*\{([^}]+)\}/)
    const events: { id: string; name: string }[] = []
    if (eventNamesMatch) {
      const block = eventNamesMatch[1]
      const re = /(\w+):\s*'([^']+)'/g
      let m
      while ((m = re.exec(block)) !== null) {
        events.push({ id: m[1], name: m[2] })
      }
    }

    // Extract enemies
    const enemies: { id: string; name: string }[] = []
    const re = /id:\s*'(\w+)'[\s\S]*?name:\s*'([^']+)'/g
    let m
    while ((m = re.exec(enemiesContent)) !== null) {
      enemies.push({ id: m[1], name: m[2] })
    }

    fs.writeFileSync(outPath, JSON.stringify({ events, enemies }, null, 2))
  }

  return {
    name: 'game-data',
    buildStart() {
      generate()
    },
    handleHotUpdate({ file }) {
      if (file.endsWith('events.ts') || file.endsWith('enemies.ts')) {
        generate()
      }
    },
  }
}

export default defineConfig({
  base: '/morning/',
  plugins: [gameDataPlugin()],
})
