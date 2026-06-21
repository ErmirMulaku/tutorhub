/** Tiny classname joiner — keeps the lib dependency-free (no `clsx`). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
