export function message(
  key: string,
  substitutions?: string | string[],
): string {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

export function localizeDocument(): void {
  document.documentElement.lang = chrome.i18n.getUILanguage().replace("_", "-");
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n;
    if (key) element.textContent = message(key);
  }
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-i18n-aria-label]",
  )) {
    const key = element.dataset.i18nAriaLabel;
    if (key) element.setAttribute("aria-label", message(key));
  }
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n-title]")) {
    const key = element.dataset.i18nTitle;
    if (key) element.title = message(key);
  }
}
