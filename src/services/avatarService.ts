import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB = 20;

export interface UploadAvatarResult {
  url: string;
  path: string;
}

export class AvatarService {
  /**
   * Faz upload de uma imagem para o Supabase Storage (bucket avatars).
   * Salva em avatars/{userId}/{timestamp}.{ext}
   */
  static async uploadAvatar(userId: string, file: File): Promise<UploadAvatarResult> {
    if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Formato não permitido. Use JPEG, PNG, WebP ou GIF.');
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_SIZE_MB) {
      throw new Error(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB} MB.`);
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext.toLowerCase()) ? ext : 'jpg';
    const path = `${userId}/${Date.now()}.${safeExt}`;

    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Avatar upload error:', error);
      throw new Error(error.message || 'Erro ao fazer upload da foto.');
    }

    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(data.path);
    return { url: urlData.publicUrl, path: data.path };
  }

  /**
   * Remove avatar do storage (opcional - chamar ao trocar foto)
   */
  static async removeAvatar(path: string): Promise<void> {
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    if (error) {
      console.warn('Avatar remove error:', error);
    }
  }

  /**
   * Valida se uma URL é válida para uso como avatar
   */
  static isValidAvatarUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    try {
      const u = new URL(url.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
