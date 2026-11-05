import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { validGoogleAccessToken } from "@/lib/auth";
import { normalizeYouTubeLibrary, type YouTubePlaylistSource } from "@/lib/youtube-library";

type ApiThumbnail = { url?: string };
type ApiPlaylist = { id?: string; snippet?: { title?: string; description?: string; publishedAt?: string } };
type ApiPlaylistItem = {
  snippet?: {
    title?: string;
    channelTitle?: string;
    videoOwnerChannelTitle?: string;
    thumbnails?: Record<string, ApiThumbnail>;
    resourceId?: { videoId?: string };
  };
  contentDetails?: { videoId?: string };
};

async function googleApi<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || "YouTube library request failed");
  return body;
}

async function playlistItems(playlistId: string, accessToken: string) {
  const items: ApiPlaylistItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ part: "snippet,contentDetails", maxResults: "50", playlistId });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleApi<{ items?: ApiPlaylistItem[]; nextPageToken?: string }>(`playlistItems?${params}`, accessToken);
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && items.length < 200);
  return items.slice(0, 200);
}

async function inBatches<T, R>(values: T[], size: number, work: (value: T) => Promise<R>) {
  const output: R[] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(...await Promise.all(values.slice(index, index + size).map(work)));
  }
  return output;
}

export async function GET(request: NextRequest) {
  if (!process.env.NEXTAUTH_SECRET || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: { code: "AUTH_NOT_CONFIGURED", message: "Google sign-in has not been configured for this deployment." } }, { status: 503 });
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in with Google before syncing YouTube." } }, { status: 401 });
  const accessToken = await validGoogleAccessToken(token);
  if (!accessToken) return NextResponse.json({ error: { code: "REAUTH_REQUIRED", message: "Google access expired. Sign out and sign in again." } }, { status: 401 });

  try {
    const [playlistPage, channelPage] = await Promise.all([
      googleApi<{ items?: ApiPlaylist[] }>("playlists?part=snippet,contentDetails&mine=true&maxResults=25", accessToken),
      googleApi<{ items?: Array<{ contentDetails?: { relatedPlaylists?: { likes?: string } } }> }>("channels?part=contentDetails&mine=true", accessToken),
    ]);
    const playlists = (playlistPage.items ?? []).filter((playlist): playlist is ApiPlaylist & { id: string } => Boolean(playlist.id)).slice(0, 24);
    const likesId = channelPage.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
    if (likesId && !playlists.some((playlist) => playlist.id === likesId)) {
      playlists.unshift({ id: likesId, snippet: { title: "Liked videos", description: "Videos you liked on YouTube" } });
    }

    const sources = await inBatches(playlists, 4, async (playlist): Promise<YouTubePlaylistSource> => {
      const items = await playlistItems(playlist.id, accessToken);
      return {
        id: playlist.id,
        title: playlist.snippet?.title || "YouTube playlist",
        description: playlist.snippet?.description,
        publishedAt: playlist.snippet?.publishedAt,
        items: items.map((item) => ({
          videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
          title: item.snippet?.title,
          artist: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle,
          thumbnails: item.snippet?.thumbnails,
        })),
      };
    });

    return NextResponse.json({ data: normalizeYouTubeLibrary(sources), meta: { maximumPlaylists: 25, maximumTracksPerPlaylist: 200 } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: { code: "YOUTUBE_SYNC_FAILED", message: error instanceof Error ? error.message : "YouTube sync failed." } }, { status: 502 });
  }
}
