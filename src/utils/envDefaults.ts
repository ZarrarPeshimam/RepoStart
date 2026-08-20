// src/utils/envDefaults.ts

export const LOCAL_DEV_DEFAULTS: Record<string, string> = {
  MONGO_URI: "mongodb://localhost:27017/<database-name>",
  DATABASE_URL: "postgresql://<username>:<password>@localhost:5432/<database-name>",
  REDIS_URL: "redis://localhost:6379",
};

/**
 * Checks if a given value is empty, null, or a recognized placeholder string.
 */
export function isPlaceholderOrEmpty(value: string | undefined): boolean {
  if (value === undefined || value === null) return true;
  
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === '""' || trimmed === "''") return true;

  // Common placeholder patterns
  const normalized = trimmed.toUpperCase();
  const placeholderPatterns = [
    "YOUR_",
    "<",
    "YOUR-",
    "CHANGE_ME",
    "CHANGEME",
    "TODO",
    "DEFAULT",
  ];

  // Check if it matches typical placeholder substrings or enclosure brackets
  if (
    placeholderPatterns.some((pattern) => normalized.includes(pattern)) ||
    (trimmed.startsWith("<") && trimmed.endsWith(">"))
  ) {
    return true;
  }

  return false;
}

/**
 * Replaces recognized placeholder or empty service variables with local dev defaults.
 */
export function applyLocalDevDefaults(envContent: string): string {
  const lines = envContent.split(/\r?\n/);
  
  const processedLines = lines.map((line) => {
    // Ignore comments and empty lines
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return line;
    }

    // Split key and value by the first '='
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      return line;
    }

    const key = line.substring(0, eqIndex).trim();
    const currentValue = line.substring(eqIndex + 1);

    // If the key is a recognized service variable and its value is empty/placeholder
    if (key in LOCAL_DEV_DEFAULTS && isPlaceholderOrEmpty(currentValue)) {
      return `${key}=${LOCAL_DEV_DEFAULTS[key]}`;
    }

    return line;
  });

  return processedLines.join("\n");
}
