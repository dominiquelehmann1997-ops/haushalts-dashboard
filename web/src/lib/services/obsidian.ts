// Baut Obsidian-Deeplinks (`obsidian://open?vault=...&file=...`) aus dem
// vault-relativen Dateipfad eines Rezepts. Funktioniert identisch auf
// Desktop/Tablet/Handy (Obsidian-Mobile-Apps registrieren dasselbe URL-Schema).

/**
 * `vaultFile` kommt aus `Recipe.vaultFile` (siehe recipeIngest.ts), z.B.
 * "Rezepte/Kokos-Curry". `vaultName` ist der Anzeigename des Obsidian-Vaults
 * (env `OBSIDIAN_VAULT_NAME`) — ohne beides gibt es keinen Link (`null`).
 */
export function obsidianUrl(
  vaultFile: string | null | undefined,
  vaultName: string | undefined = process.env.OBSIDIAN_VAULT_NAME,
): string | null {
  if (!vaultFile || !vaultName) return null;
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(vaultFile)}`;
}
