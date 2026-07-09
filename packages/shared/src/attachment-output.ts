const ATTACHMENT_OUTPUT_LINE_PATTERN = /^\[attachment:\s*(.+?)\s*\]$/i;

export function parseAttachmentOutputContent(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(ATTACHMENT_OUTPUT_LINE_PATTERN);

      if (!match) {
        return [];
      }

      const relativePath = match[1]?.trim();

      return relativePath ? [relativePath] : [];
    });
}
