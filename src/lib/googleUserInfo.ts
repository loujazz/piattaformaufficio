export interface GoogleUserInfo {
  name: string;
  picture: string;
  email: string;
}

/** Recupera nome, foto profilo ed email dell'utente loggato (richiede gli scope userinfo.profile/email). */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Impossibile recuperare il profilo Google (${res.status}).`);
  }
  const data = (await res.json()) as { name?: string; picture?: string; email?: string };
  return {
    name: data.name ?? "",
    picture: data.picture ?? "",
    email: data.email ?? "",
  };
}
