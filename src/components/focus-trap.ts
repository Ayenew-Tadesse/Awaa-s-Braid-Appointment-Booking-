// Keeps Tab and Shift+Tab inside an open dialog, so keyboard users don't land
// on the page behind it.
export function trapTab(e: KeyboardEvent, box: HTMLElement | null) {
  if (e.key !== "Tab" || !box) return;
  const items = [...box.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const [first, last] = [items[0], items[items.length - 1]];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
