import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/services/userService';
import {
  fetchOfficialPhotosBatch,
  officialPhotoSrc,
  type OfficialPhoto,
} from '@/services/officialPhotosService';

const STORAGE_KEY = 'responsum.official-photos.v1';
const STALE_MS = 5 * 60 * 1000;
const UNAVAILABLE_COOLDOWN_MS = 2 * 60 * 1000;

type Catalog = Record<string, OfficialPhoto>;

type CacheShape = {
  photos: Catalog;
  fetchedAt: number;
};

type OfficialPhotosContextValue = {
  photos: Catalog;
  getPhoto: (userId?: string | null) => OfficialPhoto | null;
  getPhotoSrc: (userId?: string | null) => string | undefined;
  refresh: (force?: boolean) => Promise<void>;
};

const OfficialPhotosContext = createContext<OfficialPhotosContextValue>({
  photos: {},
  getPhoto: () => null,
  getPhotoSrc: () => undefined,
  refresh: async () => undefined,
});

function readCache(): CacheShape | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed || typeof parsed !== 'object' || !parsed.photos) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(photos: Catalog, fetchedAt: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ photos, fetchedAt }));
  } catch {
    // ignore quota / private mode
  }
}

function isCatalogUser(user: { name?: string; email?: string }): boolean {
  const email = String(user.email ?? '').trim().toLowerCase();
  const name = String(user.name ?? '').trim();
  if (email.startsWith('deleted_')) return false;
  if (name.startsWith('Usuário Excluído')) return false;
  if (email === 'teste@gmail.com') return false;
  return true;
}

export const OfficialPhotosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Catalog>(() => readCache()?.photos ?? {});
  const fetchedAtRef = useRef(readCache()?.fetchedAt ?? 0);
  const cooldownUntilRef = useRef(0);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (!user) return;
    const now = Date.now();
    if (!force && now - fetchedAtRef.current < STALE_MS) return;
    if (!force && now < cooldownUntilRef.current) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    try {
      const users = await UserService.getAllUsers(true);
      const ids = users.filter(isCatalogUser).map((item) => item.id);
      if (user.id && !ids.includes(user.id)) ids.push(user.id);

      const result = await fetchOfficialPhotosBatch(ids);
      if (result.unavailable) {
        cooldownUntilRef.current = Date.now() + UNAVAILABLE_COOLDOWN_MS;
        return;
      }

      setPhotos((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const photo of result.data) {
          const key = photo.externalUserId;
          if (!key) continue;
          const current = next[key];
          if (
            !current ||
            current.version !== photo.version ||
            current.updatedAt !== photo.updatedAt ||
            current.photoUrl !== photo.photoUrl
          ) {
            next[key] = photo;
            changed = true;
          }
        }
        const fetchedAt = Date.now();
        fetchedAtRef.current = fetchedAt;
        const catalog = changed ? next : prev;
        writeCache(catalog, fetchedAt);
        return catalog;
      });
    } catch {
      cooldownUntilRef.current = Date.now() + UNAVAILABLE_COOLDOWN_MS;
    } finally {
      fetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refresh(false);
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      void refresh(false);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refresh]);

  const value = useMemo<OfficialPhotosContextValue>(() => ({
    photos,
    getPhoto: (userId) => (userId ? photos[userId] ?? null : null),
    getPhotoSrc: (userId) => officialPhotoSrc(userId ? photos[userId] : null),
    refresh,
  }), [photos, refresh]);

  return (
    <OfficialPhotosContext.Provider value={value}>
      {children}
    </OfficialPhotosContext.Provider>
  );
};

export function useOfficialPhotos() {
  return useContext(OfficialPhotosContext);
}

export function useOfficialPhoto(userId?: string | null): OfficialPhoto | null {
  const { getPhoto } = useOfficialPhotos();
  return getPhoto(userId);
}
