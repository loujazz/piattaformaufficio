import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { onGoogleIdentityReady, type AccessToken, requestAccessToken } from "../lib/googleAuth";
import { fetchGoogleUserInfo, type GoogleUserInfo } from "../lib/googleUserInfo";

export type AuthStatus = "checking" | "signed-out" | "signing-in" | "signed-in" | "error";

export interface UseGoogleAuthResult {
  status: AuthStatus;
  accessToken: string | null;
  userInfo: GoogleUserInfo | null;
  errorMessage: string | null;
  login: () => void;
  logout: () => void;
}

const STORAGE_KEY = "presenze-marconi-token";

/**
 * Il tentativo "silenzioso" di Google Identity Services (prompt: 'none') si basa su un
 * iframe verso accounts.google.com: se il browser blocca i cookie di terze parti (default
 * ormai comune in Safari, e sempre più spesso in Chrome/Firefox), fallisce sistematicamente
 * a ogni refresh di pagina. Per questo il token viene anche salvato in sessionStorage e
 * riusato finché resta valido (circa un'ora), senza richiederne uno nuovo: il refresh della
 * pagina non causa più un logout. sessionStorage si svuota da solo alla chiusura della scheda.
 */
function readStoredToken(): AccessToken | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AccessToken>;
    if (typeof parsed.value !== "string" || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return { value: parsed.value, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeStoredToken(token: AccessToken | null): void {
  try {
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage non disponibile (es. modalità privata): il login resta solo in memoria
  }
}

/**
 * Gestisce login OAuth e refresh silenzioso del token.
 * Il token è salvato in sessionStorage (svuotato alla chiusura della scheda) per
 * sopravvivere ai refresh di pagina; allo scadere, se il refresh silenzioso fallisce,
 * si torna a "signed-out" chiedendo un nuovo login esplicito, senza toccare eventuali
 * dati non salvati nel resto dell'app.
 */
export function useGoogleAuth(clientId: string): UseGoogleAuthResult {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [token, setTokenState] = useState<AccessToken | null>(null);
  const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setToken = useCallback((next: AccessToken | null) => {
    setTokenState(next);
    writeStoredToken(next);
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  // Ref sempre aggiornato (fuori dal render, via effect qui sotto) per
  // permettere alla callback di refresh (e al ripristino da sessionStorage)
  // di richiamare handleToken senza creare una dipendenza ciclica.
  const handleTokenRef = useRef<(newToken: AccessToken) => void>(() => {});

  const handleToken = useCallback(
    (newToken: AccessToken) => {
      setToken(newToken);
      setStatus("signed-in");
      setErrorMessage(null);

      clearRefreshTimer();
      const msUntilRefresh = Math.max(newToken.expiresAt - Date.now(), 0);
      refreshTimer.current = setTimeout(() => {
        requestAccessToken(
          clientId,
          true,
          (t) => handleTokenRef.current(t),
          () => {
            // Refresh silenzioso fallito: richiede login esplicito,
            // senza cancellare lo stato applicativo circostante.
            setStatus("signed-out");
            setToken(null);
          },
        );
      }, msUntilRefresh);
    },
    [clientId, clearRefreshTimer, setToken],
  );

  useEffect(() => {
    handleTokenRef.current = handleToken;
  }, [handleToken]);

  // Al montaggio: se sessionStorage ha ancora un token valido (sopravvissuto a un refresh
  // di pagina) lo riusa subito, schedulando comunque il refresh automatico come al solito.
  // Altrimenti tenta un login silenzioso via Google Identity Services; se anche questo
  // fallisce (es. cookie di terze parti bloccati), si torna al login esplicito.
  useEffect(() => {
    const stored = readStoredToken();
    if (stored) {
      handleTokenRef.current(stored);
      return;
    }
    return onGoogleIdentityReady(() => {
      requestAccessToken(
        clientId,
        true,
        (t) => handleTokenRef.current(t),
        () => setStatus("signed-out"),
      );
    });
  }, [clientId]);

  // Recupera nome e foto profilo per mostrarli in testata; non critico per il
  // resto dell'app, quindi un fallimento qui viene semplicemente ignorato.
  useEffect(() => {
    if (!token) {
      startTransition(() => setUserInfo(null));
      return;
    }
    let cancelled = false;
    fetchGoogleUserInfo(token.value)
      .then((info) => {
        if (!cancelled) setUserInfo(info);
      })
      .catch(() => {
        if (!cancelled) setUserInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleError = useCallback((message: string) => {
    setStatus("error");
    setErrorMessage(message);
  }, []);

  const login = useCallback(() => {
    setStatus("signing-in");
    setErrorMessage(null);
    requestAccessToken(clientId, false, handleToken, handleError);
  }, [clientId, handleToken, handleError]);

  const logout = useCallback(() => {
    clearRefreshTimer();
    setToken(null);
    setStatus("signed-out");
  }, [clearRefreshTimer, setToken]);

  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  return { status, accessToken: token?.value ?? null, userInfo, errorMessage, login, logout };
}
