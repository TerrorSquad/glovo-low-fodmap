// Syncs the version from package.json to manifest.json and manifest.ts
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pkgPath = resolve(__dirname, '../package.json')
const manifestJsonPath = resolve(__dirname, '../src/manifest.json')
const manifestTsPath = resolve(__dirname, '../manifest.ts')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const newVersion = pkg.version

// Update manifest.json if it exists
if (existsSync(manifestJsonPath)) {
  const manifest = JSON.parse(readFileSync(manifestJsonPath, 'utf8'))
  manifest.version = newVersion
  writeFileSync(manifestJsonPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Updated manifest.json version to ${newVersion}`)
}

// Update manifest.ts if it exists
if (existsSync(manifestTsPath)) {
  let manifestTs = readFileSync(manifestTsPath, 'utf8')
  manifestTs = manifestTs.replace(/version:\s*['"]([\d.]+)['"]/,
    `version: '${newVersion}'`)
  writeFileSync(manifestTsPath, manifestTs)
  console.log(`Updated manifest.ts version to ${newVersion}`)
}
