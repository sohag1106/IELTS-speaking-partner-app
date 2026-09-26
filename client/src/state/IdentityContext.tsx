import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchProfile, guestLogin, type Profile } from '../lib/api';
import { clearIdentity, loadIdentity, saveIdentity, type Identity } from '../lib/storage';

interface IdentityCtx {
  identity: Identity | null;
  ready: boolean;
  login: (nickname: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<IdentityCtx | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());
  const [ready, setReady] = useState(false);

  // Validate any stored token on first load; drop it if the server rejects it.
  useEffect(() => {
    let cancelled = false;
    const stored = loadIdentity();
    if (!stored) {
      setReady(true);
      return;
    }
    fetchProfile(stored.token)
      .then((profile: Profile) => {
        if (cancelled) return;
        setIdentity({ ...stored, nickname: profile.nickname });
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearIdentity();
        setIdentity(null);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (nickname: string) => {
    const id = await guestLogin(nickname);
    saveIdentity(id);
    setIdentity(id);
  }, []);

  const logout = useCallback(() => {
    clearIdentity();
    setIdentity(null);
  }, []);

  const value = useMemo(
    () => ({ identity, ready, login, logout }),
    [identity, ready, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIdentity(): IdentityCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useIdentity must be used within IdentityProvider');
  return ctx;
}
