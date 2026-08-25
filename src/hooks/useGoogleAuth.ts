import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { type AccessToken, requestAccessToken } from "../lib/googleAuth";
import { fetchGoogleUserInfo, type GoogleUserInfo } from "../lib/googleUserInfo";

export type AuthStatus = "signed-out" | "signing-in" | "signed-in" | "error";

export interface UseGoogleAuthResult {
  status: AuthStatus;
  accessToken: string | null;
  userInfo: GoogleUserInfo | null;
  errorMessage: string | null;
  login: () => void;
  logout: () => void;
}

/**
 * Gestisce login OAuth e refresh silenzioso del token.
 * Il token vive solo in memoria (mai in localStorage): allo scadere,
 * se il refresh silenzioso fallisce, si torna a "signed-out" chiedendo
 * un nuovo login esplicito, senza toccare eventuali dati non salvati
 * nel resto dell'app.
 */
export function useGoogleAuth(clientId: string): UseGoogleAuthResult {
  const [status, setStatus] = useState<AuthStatus>("signed-out");
  const [token, setToken] = useState<AccessToken | null>(null);
  const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  // Ref sempre aggiornato (fuori dal render, via effect qui sotto) per
  // permettere alla callback di refresh di richiamare se stessa senza
  // creare una dipendenza ciclica nello useCallback.
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
    [clientId, clearRefreshTimer],
  );

  useEffect(() => {
    handleTokenRef.current = handleToken;
  }, [handleToken]);

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
  }, [clearRefreshTimer]);

  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  return { status, accessToken: token?.value ?? null, userInfo, errorMessage, login, logout };
}
