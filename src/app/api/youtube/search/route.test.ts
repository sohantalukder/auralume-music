import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/youtube/search/route";

const html = `<script>var ytInitialData = ${JSON.stringify({
  contents: [{ videoRenderer: {
    videoId: "IF9GJstin2g",
    title: { runs: [{ text: "Ami Shunechi Sedin Tumi" }] },
    ownerText: { runs: [{ text: "Music Channel" }] },
    lengthText: { simpleText: "4:20" },
  } }],
})};</script>`;

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, { headers: { "x-forwarded-for": crypto.randomUUID() } });
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("YouTube search route", () => {
  it("validates the query before contacting YouTube", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("/api/youtube/search?q=x"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns normalized videos using the fixed YouTube search endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("/api/youtube/search?q=ami%20suneci"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.provider).toBe("youtube");
    expect(body.data[0]).toMatchObject({ id: "youtube:IF9GJstin2g", title: "Ami Shunechi Sedin Tumi", streamUrl: "/api/youtube/audio?videoId=IF9GJstin2g" });
    expect(fetchMock.mock.calls[0][0].toString()).toMatch(/^https:\/\/www\.youtube\.com\/results\?/);
  });

  it("reports upstream or parser failures without leaking details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("consent", { status: 200 })));
    const response = await GET(request("/api/youtube/search?q=ami%20suneci"));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: { code: "YOUTUBE_UNAVAILABLE", message: "YouTube search is temporarily unavailable." } });
  });

  it("uses the official API and returns a pagination token when configured", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      items: [{ id: { videoId: "IF9GJstin2g" }, snippet: { title: "Ami Shunechi Sedin Tumi", channelTitle: "Music Channel", thumbnails: { high: { url: "https://example.com/art.jpg" } } } }],
      nextPageToken: "next-page",
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("/api/youtube/search?q=ami%20suneci&pageToken=current-page"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ provider: "youtube-data-api", nextPageToken: "next-page", data: [{ id: "youtube:IF9GJstin2g" }] });
    expect(fetchMock.mock.calls[0][0].toString()).toContain("pageToken=current-page");
    expect(fetchMock.mock.calls[0][0].toString()).toContain("key=test-key");
  });
});
