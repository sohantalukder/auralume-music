import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/archive/download/route";

const metadata = {
  metadata: {
    identifier: "open-album",
    licenseurl: "https://creativecommons.org/licenses/by/4.0/",
  },
  files: [{ name: "folder/song one.mp3", format: "VBR MP3", size: "8" }],
};

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, { headers: { "x-forwarded-for": crypto.randomUUID() } });
}

afterEach(() => vi.unstubAllGlobals());

describe("Archive MP3 download route", () => {
  it("rejects invalid targets without making an upstream request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("/api/archive/download?identifier=../../etc&file=song.mp3"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams an exact, licensed MP3 as an attachment", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(metadata), { status: 200 }))
      .mockResolvedValueOnce(new Response("mp3bytes", { status: 200, headers: { "content-length": "8", "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("/api/archive/download?identifier=open-album&file=folder%2Fsong%20one.mp3"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("content-disposition")).toContain("attachment; filename=\"song one.mp3\"");
    await expect(response.text()).resolves.toBe("mp3bytes");
    expect(fetchMock.mock.calls[0][0].toString()).toBe("https://archive.org/metadata/open-album");
    expect(fetchMock.mock.calls[1][0].toString()).toBe("https://archive.org/download/open-album/folder/song%20one.mp3");
  });

  it("fails closed when the requested file is not licensed by current metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...metadata, metadata: { identifier: "open-album" } }), { status: 200 })));
    const response = await GET(request("/api/archive/download?identifier=open-album&file=folder%2Fsong%20one.mp3"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "DOWNLOAD_NOT_ALLOWED" } });
  });

  it("does not expose upstream download failures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(metadata), { status: 200 }))
      .mockRejectedValueOnce(new Error("private network detail"));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("/api/archive/download?identifier=open-album&file=folder%2Fsong%20one.mp3"));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: { code: "DOWNLOAD_UNAVAILABLE", message: "This MP3 could not be downloaded right now." } });
  });
});
