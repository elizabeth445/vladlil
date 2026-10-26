export function readDraft(key: string, fields: Record<string, number>): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(fields).flatMap(([field, maxLength]) => {
      const value = (stored as Record<string, unknown>)[field];
      return typeof value === "string" && value.length <= maxLength ? [[field, value]] : [];
    }));
  } catch {
    return {};
  }
}

export function saveDraft(key: string, value: Record<string, string>): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
