import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/youtube-audio", () => ({ resolveYouTubeAudio: vi.fn() }));

import { GET } from "@/app/api/youtube/audio/route";
import { resolveYouTubeAudio } from "@/lib/youtube-audio";

const resolveMock = vi.mocked(resolveYouTubeAudio);
const target = {
  url: "https://rr1---sn.example.googlevideo.com/videoplayback?expire=2000000000",
  mimeType: "audio/mp4",
  contentLength: 1000,
  maxRangeBytes: 1024 * 1024,
};

function request(path: string, range?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { "x-forwarded-for": crypto.randomUUID(), ...(range ? { range } : {}) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  resolveMock.mockReset();
});

describe("YouTube audio route", () => {
  it("rejects invalid video IDs before resolving a stream", async () => {
    const response = await GET(request("/api/youtube/audio?videoId=bad"));
    expect(response.status).toBe(400);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("proxies byte ranges as audio without exposing the signed URL", async () => {
    resolveMock.mockResolvedValue(target);
    const fetchMock = vi.fn().mockResolvedValue(new Response("audio", {
      status: 206,
      headers: { "content-length": "5", "content-range": "bytes 0-999/1000", "content-type": "audio/mp4" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("/api/youtube/audio?videoId=IF9GJstin2g", "bytes=0-"));

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("audio/mp4");
    expect(response.headers.get("content-range")).toBe("bytes 0-999/1000");
    await expect(response.text()).resolves.toBe("audio");
    expect(fetchMock).toHaveBeenCalledWith(target.url, expect.objectContaining({ headers: { Range: "bytes=0-999" } }));
  });

  it("rejects ranges outside the resolved audio size", async () => {
    resolveMock.mockResolvedValue(target);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("/api/youtube/audio?videoId=IF9GJstin2g", "bytes=1000-1001"));
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */1000");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes a stale signed URL and retries the requested range once", async () => {
    const refreshed = { ...target, url: "https://rr2---sn.example.googlevideo.com/videoplayback?expire=2000000100" };
    resolveMock.mockResolvedValueOnce(target).mockResolvedValueOnce(refreshed);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("expired", { status: 403 }))
      .mockResolvedValueOnce(new Response("audio", {
        status: 206,
        headers: { "content-length": "5", "content-range": "bytes 0-999/1000", "content-type": "audio/mp4" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("/api/youtube/audio?videoId=IF9GJstin2g", "bytes=0-"));

    expect(response.status).toBe(206);
    await expect(response.text()).resolves.toBe("audio");
    expect(resolveMock).toHaveBeenNthCalledWith(2, "IF9GJstin2g", true);
    expect(fetchMock).toHaveBeenNthCalledWith(2, refreshed.url, expect.objectContaining({ headers: { Range: "bytes=0-999" } }));
  });

  it("returns a stable error when resolution fails", async () => {
    resolveMock.mockRejectedValue(new Error("upstream detail"));
    const response = await GET(request("/api/youtube/audio?videoId=IF9GJstin2g"));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: { code: "AUDIO_UNAVAILABLE", message: "This YouTube audio stream is temporarily unavailable." } });
  });

  it("answers a request without a Range header with a capped partial response", async () => {
    resolveMock.mockResolvedValue({ ...target, contentLength: 5 * 1024 * 1024 });
    const fetchMock = vi.fn().mockResolvedValue(new Response("audio", {
      status: 206,
      headers: { "content-length": "1048576", "content-range": "bytes 0-1048575/5242880" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("/api/youtube/audio?videoId=IF9GJstin2g"));

    expect(response.status).toBe(206);
    expect(fetchMock).toHaveBeenCalledWith(target.url, expect.objectContaining({ headers: { Range: "bytes=0-1048575" } }));
  });

  it("stitches small upstream ranges into one response", async () => {
    resolveMock.mockResolvedValue({ ...target, contentLength: 10, maxRangeBytes: 4 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("abcd", { status: 206 }))
      .mockResolvedValueOnce(new Response("efgh", { status: 206 }))
      .mockResolvedValueOnce(new Response("ij", { status: 206 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("/api/youtube/audio?videoId=IF9GJstin2g", "bytes=0-"));

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-9/10");
    expect(response.headers.get("content-length")).toBe("10");
    await expect(response.text()).resolves.toBe("abcdefghij");
    expect(fetchMock.mock.calls.map(([, init]) => init.headers.Range)).toEqual(["bytes=0-3", "bytes=4-7", "bytes=8-9"]);
  });
});
