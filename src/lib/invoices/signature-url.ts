/** Browser URL for the current firm signature (auth-gated API). Safe for client components. */
export function signatureDisplayUrl(signaturePath: string | null | undefined) {
  if (!signaturePath) return null;
  if (signaturePath.startsWith("http")) return signaturePath;
  if (signaturePath.startsWith("/api/")) return signaturePath;
  // Storage key → serve via API route
  return `/api/invoices/signature?v=${encodeURIComponent(signaturePath)}`;
}
