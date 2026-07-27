/** Monta URL pública do Storage forçando o nome original no download. */
export function getAttachmentDownloadUrl(url: string, originalName?: string | null): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (originalName?.trim()) {
      parsed.searchParams.set('download', originalName.trim());
    } else if (!parsed.searchParams.has('download')) {
      parsed.searchParams.set('download', '');
    }
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    if (originalName?.trim()) {
      return `${url}${separator}download=${encodeURIComponent(originalName.trim())}`;
    }
    return `${url}${separator}download`;
  }
}

export function extractStoragePathFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = '/storage/v1/object/public/attachments/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export type ChatFileAttachment = {
  name: string;
  type: string;
  size: number;
  url: string;
};
