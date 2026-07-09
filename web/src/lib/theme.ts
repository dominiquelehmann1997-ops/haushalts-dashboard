// Geteilte Theme-Konstanten für Tablet (Startseite) und Handy (/mobile).
//
// Speicher-Schlüssel und Werte sind an EINER Stelle definiert, damit das
// Inline-Skript vor dem ersten Paint, der Header-Toggle (Tablet) und der
// Einstellungen-Schalter (Handy) dieselbe Quelle nutzen.

export const THEME_KEY = "cockpit-theme";

/** `"light"`/`"dark"` = fest gewählt; `"auto"` (oder fehlend) = OS-Einstellung. */
export type ThemePref = "light" | "dark" | "auto";

/**
 * Selbst-ausführendes Skript-Fragment, das VOR dem ersten Paint läuft und
 * `.dark` (+ `color-scheme`) am `<html>` setzt. So erscheint die Seite bei
 * jedem Refresh sofort im richtigen Design — kein kurzes Aufblitzen des
 * Tag-Designs mehr. Wird identisch in beide Layouts (Tablet & Handy)
 * eingebettet und ist idempotent.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var dark=t==='dark'||((t===null||t==='auto')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;if(dark){e.classList.add('dark');}else{e.classList.remove('dark');}e.style.colorScheme=dark?'dark':'light';}catch(e){}})();`;
