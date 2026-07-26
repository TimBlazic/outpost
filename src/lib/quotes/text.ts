/** Strip common markdown the model sneaks in (e.g. **bold**). */
export function stripQuoteMarkdown(raw: string): string {
  return (raw || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ");
}
