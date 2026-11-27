/**
 * Quién puede entrar a Pluto. La lista vive en una variable de entorno (el
 * repo es público): mails completos o dominios con @, separados por coma.
 *
 *   PLUTO_ALLOWED_EMAILS="ana@ejemplo.com, @deregital.com"
 *
 * Sin la variable no entra nadie: Pluto puede crear y borrar instalaciones.
 */
export function getAllowedEmailEntries(
  raw = process.env.PLUTO_ALLOWED_EMAILS,
): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(
  email: string | null | undefined,
  entries = getAllowedEmailEntries(),
) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  const domain = normalized.slice(normalized.lastIndexOf("@"));

  return entries.some((entry) =>
    entry.startsWith("@") ? entry === domain : entry === normalized,
  );
}
