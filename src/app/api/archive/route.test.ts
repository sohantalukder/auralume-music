import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/archive/route";

const searchPayload = {
  response: {
    numFound: 1,
    docs: [{
      identifier: "open-album",
      title: "Open Album",
      creator: "Archive Artist",
      downloads: 12,
      licenseurl: "https://creativecommons.org/licenses/by/4.0/",
    }],
  },
};

const metadataPayload = {
  metadata: {
    identifier: "open-album",
    title: "Open Album",
    creator: "Archive Artist",
    licenseurl: "https://creativecommons.org/licenses/by/4.0/",
  },
  files: [{ name: "song.mp3", format: "VBR MP3", source: "original", length: "120", size: "1000" }],
};

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, { headers: { "x-forwarded-for": crypto.randomUUID() } });
}

afterEach(() => vi.unstubAllGlobals());

describe("Archive route", () => {
  it("validates the search query before contacting the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("/api/archive?q=x"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns normalized tracks using only fixed Archive endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(searchPayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(metadataPayload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("/api/archive?q=ambient&page=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toBe("internet-archive");
    expect(body.data[0]).toMatchObject({ source: "archive", title: "song", playable: true });
    expect(fetchMock.mock.calls[0][0].toString()).toMatch(/^https:\/\/archive\.org\/advancedsearch\.php\?/);
    expect(fetchMock.mock.calls[1][0].toString()).toBe("https://archive.org/metadata/open-album");
  });

  it("fails closed when the upstream search payload is malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: { docs: "bad" } }), { status: 200 })));
    const response = await GET(request("/api/archive?q=ambient"));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "ARCHIVE_UNAVAILABLE" } });
  });

  it("reports upstream failure without leaking implementation details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network details")));
    const response = await GET(request("/api/archive?q=ambient"));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: { code: "ARCHIVE_UNAVAILABLE", message: "The online music catalog is temporarily unavailable." } });
  });
});
