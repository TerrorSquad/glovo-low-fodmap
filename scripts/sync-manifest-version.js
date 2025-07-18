// Syncs the version from package.json to manifest.json and manifest.ts
const fs = require('fs')
const path = require('path')

const pkgPath = path.resolve(__dirname, '../package.json')
const manifestJsonPath = path.resolve(__dirname, '../src/manifest.json')
const manifestTsPath = path.resolve(__dirname, '../manifest.ts')

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const newVersion = pkg.version

// Update manifest.json if it exists
if (fs.existsSync(manifestJsonPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'))
  manifest.version = newVersion
  fs.writeFileSync(manifestJsonPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Updated manifest.json version to ${newVersion}`)
}

// Update manifest.ts if it exists
if (fs.existsSync(manifestTsPath)) {
  let manifestTs = fs.readFileSync(manifestTsPath, 'utf8')
  manifestTs = manifestTs.replace(/version:\s*['"]([\d.]+)['"]/,
    `version: '${newVersion}'`)
  fs.writeFileSync(manifestTsPath, manifestTs)
  console.log(`Updated manifest.ts version to ${newVersion}`)
}
