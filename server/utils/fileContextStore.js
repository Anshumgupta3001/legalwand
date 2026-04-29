/**
 * In-memory file context store.
 * Maps userId (string) → { text: string, filename: string }
 * Cleared on server restart. No DB persistence.
 */
const fileContextStore = new Map();

module.exports = fileContextStore;
