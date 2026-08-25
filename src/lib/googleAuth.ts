// Wrapper minimale attorno a Google Identity Services (GIS) per il flusso
// "token client" lato browser: nessun backend, il token resta solo in memoria.

const SCOPE =
  "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

export interface AccessToken {
  value: string;
  expiresAt: number; // epoch ms
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }) => TokenClient;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleAccountsOAuth2;
      };
    };
  }
}

let tokenClient: TokenClient | null = null;

function getTokenClient(
  clientId: string,
  onToken: (token: AccessToken) => void,
  onError: (message: string) => void,
): TokenClient {
  if (tokenClient) return tokenClient;

  if (!window.google?.accounts?.oauth2) {
    throw new Error(
      "Google Identity Services non è ancora disponibile: controlla la connessione o riprova tra un istante.",
    );
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (response) => {
      if (response.error || !response.access_token) {
        onError(response.error ?? "Login Google non riuscito.");
        return;
      }
      onToken({
        value: response.access_token,
        // sottraiamo un margine di sicurezza per rinnovare in anticipo
        expiresAt: Date.now() + (response.expires_in - 60) * 1000,
      });
    },
    error_callback: (error) => {
      onError(error.message ?? "Login Google annullato o non riuscito.");
    },
  });

  return tokenClient;
}

/**
 * Richiede un access token.
 * silent = true → nessun popup, fallisce silenziosamente se serve interazione
 * (usato per il refresh automatico prima della scadenza).
 * silent = false → mostra il popup di consenso Google (login esplicito).
 */
export function requestAccessToken(
  clientId: string,
  silent: boolean,
  onToken: (token: AccessToken) => void,
  onError: (message: string) => void,
): void {
  const client = getTokenClient(clientId, onToken, onError);
  client.requestAccessToken({ prompt: silent ? "none" : "consent" });
}
