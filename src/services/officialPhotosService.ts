import { supabase } from '@/lib/supabase';

export type OfficialPhoto = {
  externalUserId: string | null;
  userId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  source: 'selected' | 'legacy_avatar' | 'none';
  version: string;
  updatedAt: string;
};

export type OfficialPhotosBatchResult = {
  data: OfficialPhoto[];
  notFound: string[];
  unavailable?: boolean;
};

export function withOfficialPhotoVersion(url: string, version?: string | null): string {
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

export function officialPhotoSrc(photo?: OfficialPhoto | null): string | undefined {
  if (!photo?.photoUrl || photo.source === 'none') return undefined;
  return withOfficialPhotoVersion(photo.photoUrl, photo.version);
}

export async function fetchOfficialPhotosBatch(externalUserIds: string[]): Promise<OfficialPhotosBatchResult> {
  const ids = [...new Set(externalUserIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { data: [], notFound: [] };

  const { data, error } = await supabase.functions.invoke('official-photos', {
    body: { externalUserIds: ids },
  });

  if (error) {
    return { data: [], notFound: ids, unavailable: true };
  }

  const payload = (data ?? {}) as OfficialPhotosBatchResult & { error?: string };
  if (payload.unavailable) {
    return {
      data: Array.isArray(payload.data) ? payload.data : [],
      notFound: Array.isArray(payload.notFound) ? payload.notFound : ids,
      unavailable: true,
    };
  }

  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    notFound: Array.isArray(payload.notFound) ? payload.notFound : [],
  };
}
