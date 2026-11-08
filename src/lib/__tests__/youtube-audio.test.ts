import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("youtubei.js", () => ({
  Innertube: { create: vi.fn() },
  Platform: { shim: {} },
}));
vi.mock("@/lib/youtube-potoken", () => ({ getYouTubeContentPoToken: vi.fn() }));

import { Innertube, Platform } from "youtubei.js";
import { resolveYouTubeAudio } from "@/lib/youtube-audio";
import { getYouTubeContentPoToken } from "@/lib/youtube-potoken";

describe("YouTube audio resolution", () => {
  it("uses a content-bound token when unsigned clients have no streaming data", async () => {
    const decipher = vi.fn().mockResolvedValue("https://rr1---sn.example.googlevideo.com/videoplayback?expire=2000000000");
    const format = {
      url: undefined,
      mime_type: "audio/mp4; codecs=\"mp4a.40.2\"",
      content_length: 1000,
      decipher,
    };
    const chooseFormat = vi.fn().mockReturnValue(format);
    const blocked = { playability_status: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you're not a bot" }, chooseFormat: vi.fn() };
    const innertube = {
      getBasicInfo: vi.fn().mockResolvedValueOnce(blocked).mockResolvedValueOnce(blocked).mockResolvedValue({ playability_status: { status: "OK" }, chooseFormat }),
      session: { player: {} },
    };
    vi.mocked(Innertube.create).mockResolvedValue(innertube as never);
    vi.mocked(getYouTubeContentPoToken).mockResolvedValue("content-token");

    const target = await resolveYouTubeAudio("IF9GJstin2g");

    expect(innertube.getBasicInfo).toHaveBeenNthCalledWith(1, "IF9GJstin2g", { client: "VISIONOS" });
    expect(innertube.getBasicInfo).toHaveBeenNthCalledWith(2, "IF9GJstin2g", { client: "IOS" });
    expect(blocked.chooseFormat).not.toHaveBeenCalled();
    expect(innertube.getBasicInfo).toHaveBeenCalledWith("IF9GJstin2g", { client: "MWEB", po_token: "content-token" });
    expect(chooseFormat).toHaveBeenCalledWith({ format: "mp4", quality: "best", type: "audio" });
    expect(decipher).toHaveBeenCalledWith(innertube.session.player);
    expect(target.url).toContain("pot=content-token");
    expect(target).toMatchObject({ mimeType: "audio/mp4", contentLength: 1000, maxRangeBytes: 16 * 1024 });
    expect(Platform.shim.eval).toEqual(expect.any(Function));
  });

  it("retries session creation after a failed start instead of caching the failure", async () => {
    vi.resetModules();
    const { Innertube: FreshInnertube } = await import("youtubei.js");
    const { resolveYouTubeAudio: freshResolve } = await import("@/lib/youtube-audio");
    const format = {
      mime_type: "audio/mp4",
      content_length: 1000,
      decipher: vi.fn().mockResolvedValue("https://rr1---sn.example.googlevideo.com/videoplayback?expire=2000000000"),
    };
    const innertube = {
      getBasicInfo: vi.fn().mockResolvedValue({ playability_status: { status: "OK" }, chooseFormat: () => format }),
      session: { player: {} },
    };
    vi.mocked(FreshInnertube.create).mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(innertube as never);

    await expect(freshResolve("dQw4w9WgXcQ")).rejects.toThrow("network down");
    await expect(freshResolve("dQw4w9WgXcQ")).resolves.toMatchObject({ contentLength: 1000, maxRangeBytes: 1024 * 1024 });
  });

  it("reports each client's playability refusal when no stream is available", async () => {
    vi.resetModules();
    const { Innertube: FreshInnertube } = await import("youtubei.js");
    const { getYouTubeContentPoToken: freshToken } = await import("@/lib/youtube-potoken");
    const { resolveYouTubeAudio: freshResolve } = await import("@/lib/youtube-audio");
    const innertube = {
      getBasicInfo: vi.fn().mockResolvedValue({ playability_status: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you're not a bot" }, chooseFormat: vi.fn() }),
      session: { player: {} },
    };
    vi.mocked(FreshInnertube.create).mockResolvedValue(innertube as never);
    vi.mocked(freshToken).mockResolvedValue("content-token");

    await expect(freshResolve("M8syt1aCOg0")).rejects.toThrow(
      "VISIONOS LOGIN_REQUIRED: Sign in to confirm you're not a bot; IOS LOGIN_REQUIRED: Sign in to confirm you're not a bot; MWEB LOGIN_REQUIRED: Sign in to confirm you're not a bot",
    );
  });
});
