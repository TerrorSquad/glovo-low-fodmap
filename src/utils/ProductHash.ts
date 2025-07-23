// Utility for generating a stable hash for product deduplication
// Only hashes the product name (case-insensitive, trimmed)

export function getProductHash(name: string): string {
  if (!name) return ''
  // Simple hash: lowercased, trimmed, and SHA-256
  const normalized = name.trim().toLowerCase()
  // Use a basic hash for simplicity (can swap for crypto if needed)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  return `name_${Math.abs(hash)}`
}
