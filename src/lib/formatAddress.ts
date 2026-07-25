/**
 * Split address into lines by comma. Each part is trimmed; a comma is appended to every line except the last.
 * e.g. "Dunajska cesta 151, 1000 Ljubljana, Slovenia" -> ["Dunajska cesta 151,", "1000 Ljubljana,", "Slovenia"]
 */
export function formatAddressLines(address: string | null | undefined): string[] {
  if (!address || !address.trim()) return [];
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  return parts.map((p, i) => (i < parts.length - 1 ? `${p},` : p));
}
