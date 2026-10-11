import type { RuleMatchType } from "../domain/types.js";

const DOMAIN_PATTERN = /^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+\.?$/u;

/**
 * Suggests a match type for text typed into the quick-add field. Returns
 * undefined for blank input so callers can keep the current selection.
 */
export function inferMatchType(text: string): RuleMatchType | undefined {
  const value = text.trim();
  if (!value) return undefined;
  if (value.includes("*") || value.includes("/")) return "url_pattern";
  if (/\s/.test(value)) return "title_keyword";
  if (DOMAIN_PATTERN.test(value)) return "domain_suffix";
  return "title_keyword";
}

/**
 * Extracts a rule-friendly domain from a full http(s) URL, dropping a leading
 * "www.". Returns undefined for anything that is not a plain web URL,
 * including wildcard patterns the user wants to keep verbatim.
 */
export function domainFromUrl(text: string): string | undefined {
  const value = text.trim();
  if (!/^https?:\/\//i.test(value) || value.includes("*")) return undefined;
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/\.$/, "");
    return hostname.replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}
