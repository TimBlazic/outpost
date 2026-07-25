/** Mentions support Unicode letters (e.g. Blažič), not just ASCII `\w`. */

export function mentionHandle(name: string) {
  return `@${name.replace(/\s+/g, "")}`;
}

/** Split body so @handles (incl. diacritics) can be highlighted. */
export function splitMentions(body: string): string[] {
  return body.split(/(@[\p{L}\p{N}_][\p{L}\p{N}_.-]*)/gu);
}

/** Match incomplete @query at caret for autocomplete. */
export function mentionQueryAt(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const match = before.match(/@([\p{L}\p{N}_.-]*)$/u);
  return match ? match[1] : null;
}

export function replaceMentionQuery(
  value: string,
  caret: number,
  insert: string
) {
  const before = value.slice(0, caret);
  const after = value.slice(caret);
  const replaced = before.replace(/@([\p{L}\p{N}_.-]*)$/u, `${insert} `);
  return { next: replaced + after, caret: replaced.length };
}
