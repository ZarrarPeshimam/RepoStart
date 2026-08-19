const LOCAL_DEFAULTS: Record<string, string> = {
  MONGO_URI: "mongodb://localhost:27017/<database-name>",
  DATABASE_URL: "postgresql://<username>:<password>@localhost:5432/<database-name>",
  REDIS_URL: "redis://localhost:6379",
}

const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^["']\s*["']$/,
  /YOUR_MONGODB_URI/i,
  /<your_database_url>/i,
  /your_redis_url/i,
  /CHANGE_ME/i,
  /PLACEHOLDER/i,
]

export function applyEnvDefaults(envContent: string): string {
  const lines = envContent.split(/\r?\n/)
  
  const updatedLines = lines.map((line) => {
    // Ignore comments and malformed lines without '='
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      return line
    }

    const eqIndex = line.indexOf("=")
    const key = line.slice(0, eqIndex).trim()
    const rawValue = line.slice(eqIndex + 1).trim()

    // Check if this key has a defined local development default
    if (!(key in LOCAL_DEFAULTS)) {
      return line
    }

    // Check if the current value is empty or matches a known placeholder pattern
    const isPlaceholder = PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(rawValue))

    if (isPlaceholder) {
      // Preserve key format while replacing the value with the default
      return `${key}=${LOCAL_DEFAULTS[key]}`
    }

    return line
  })

  return updatedLines.join("\n")
}
