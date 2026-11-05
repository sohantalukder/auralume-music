import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";

const YOUTUBE_READ_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
};

export async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return { ...token, authError: "RefreshAccessTokenError" };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const refreshed = await response.json() as GoogleRefreshResponse;
    if (!response.ok || !refreshed.access_token) throw new Error("Google token refresh failed");
    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + (refreshed.expires_in ?? 3_600) * 1_000,
      authError: undefined,
    };
  } catch {
    return { ...token, authError: "RefreshAccessTokenError" };
  }
}

export async function validGoogleAccessToken(token: JWT) {
  if (token.accessToken && token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60_000) return token.accessToken;
  const refreshed = await refreshGoogleAccessToken(token);
  return refreshed.authError ? undefined : refreshed.accessToken;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: `openid email profile ${YOUTUBE_READ_SCOPE}`,
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token ?? token.refreshToken,
          accessTokenExpires: account.expires_at ? account.expires_at * 1_000 : Date.now() + 3_600_000,
          authError: undefined,
        };
      }
      if (!token.accessTokenExpires || Date.now() < token.accessTokenExpires - 60_000) return token;
      return refreshGoogleAccessToken(token);
    },
  },
};
