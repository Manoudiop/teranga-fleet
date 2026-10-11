import type { AuthUserResponse, LoginResponse } from '@teranga-fleet/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, setUnauthorizedHandler } from './api';
import { deleteToken, isExpired, readToken, saveToken, tokenExpiry } from './session';
import { resetTracking, resumeTracking } from './tracking/tracking';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null; reason?: string }
  | { status: 'signedIn'; user: AuthUserResponse };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: (reason?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(
    async (reason?: string) => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      await resetTracking().catch(() => undefined);
      await deleteToken();
      queryClient.clear();
      setState({ status: 'signedOut', user: null, reason });
    },
    [queryClient],
  );

  /** Déconnexion automatique à l'expiration du token. */
  const scheduleExpiry = useCallback(
    (token: string) => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      const expiry = tokenExpiry(token);
      if (!expiry) return;
      // setTimeout est limité à ~24,8 jours : au-delà, la vérification au lancement suffit.
      const delay = Math.min(expiry.getTime() - Date.now(), 2 ** 31 - 1);
      expiryTimer.current = setTimeout(() => void signOut('Votre session a expiré.'), delay);
    },
    [signOut],
  );

  const openSession = useCallback(
    async (token: string, user: AuthUserResponse) => {
      setState({ status: 'signedIn', user });
      scheduleExpiry(token);
      await resumeTracking();
    },
    [scheduleExpiry],
  );

  // Restauration de la session au lancement.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await readToken();
      if (!token || isExpired(token)) {
        if (token) await deleteToken();
        if (!cancelled) setState({ status: 'signedOut', user: null });
        return;
      }
      try {
        const user = await api<AuthUserResponse>('auth/me', { token });
        if (!cancelled) await openSession(token, user);
      } catch (error) {
        // Hors réseau : le token est conservé, l'écran de connexion affiche la raison.
        if (error instanceof ApiError && error.status === 0) {
          if (!cancelled) setState({ status: 'signedOut', user: null, reason: error.message });
          return;
        }
        await deleteToken();
        if (!cancelled) setState({ status: 'signedOut', user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openSession]);

  // Un 401 de l'API (token révoqué, compte supprimé) renvoie à la connexion.
  useEffect(() => {
    setUnauthorizedHandler(() => void signOut('Votre session a expiré. Reconnectez-vous.'));
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api<LoginResponse>('auth/login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
        token: null,
      });
      if (res.user.role !== 'CHAUFFEUR') {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'Cette application est réservée aux chauffeurs. Les gestionnaires utilisent le tableau de bord web.',
        );
      }
      await saveToken(res.accessToken);
      await openSession(res.accessToken, res.user);
    },
    [openSession],
  );

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return context;
}
