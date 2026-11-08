import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const fixture = path.join(process.cwd(), "e2e/fixtures/local-test.wav");
const archiveTrack = {
  id: "archive:open-album:online-song.mp3",
  providerTrackId: "open-album/online-song.mp3",
  source: "archive",
  title: "Online Song",
  artist: "Archive Artist",
  album: "Open Album",
  duration: 120,
  genres: ["Ambient"],
  playable: true,
  streamUrl: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
  downloadUrl: "/api/archive/download?identifier=open-album&file=online-song.mp3",
  originalUrl: "https://archive.org/details/open-album",
  license: { name: "Creative Commons", url: "https://creativecommons.org/licenses/by/4.0/" },
};

const youtubeTrack = {
  id: "youtube:IF9GJstin2g",
  providerTrackId: "IF9GJstin2g",
  source: "youtube",
  title: "Jani Na (জানি না) | Challenge | Nachiketa | Jeet Gannguli | Dev | Subhashree | Raj Chakraborty | SVF",
  artist: "Music Channel",
  album: "YouTube",
  duration: 260,
  genres: ["YouTube"],
  playable: true,
  streamUrl: "/api/youtube/audio?videoId=IF9GJstin2g",
  youtubeVideoId: "IF9GJstin2g",
  artwork: "https://i.ytimg.com/vi/IF9GJstin2g/hqdefault.jpg",
  originalUrl: "https://www.youtube.com/watch?v=IF9GJstin2g",
};

async function mockArchive(page: import("@playwright/test").Page) {
  await page.route("**/api/archive**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [archiveTrack], provider: "internet-archive" }) });
  });
  await page.route("**/api/youtube/search**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], provider: "youtube" }) });
  });
}

async function importLocalTrack(page: import("@playwright/test").Page) {
  await page.goto("/library");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByText("local-test", { exact: true })).toBeVisible();
}

test("listener can open a local track and lyrics bottom sheet", async ({ page }) => {
  await importLocalTrack(page);
  await page.getByRole("button", { name: "local-test Local file" }).click();
  await expect(page).toHaveURL(/\/player/);
  await expect(page.locator("iframe, video")).toHaveCount(0);
  await expect(page.getByLabel("Music player")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("button", { name: /Pause|Play/ })).toBeVisible();
  await page.getByRole("button", { name: "Lyrics" }).click();
  await expect(page.getByRole("dialog", { name: "Lyrics for local-test" })).toBeVisible();
  await page.getByRole("button", { name: "Close lyrics" }).click();
  await expect(page.getByRole("dialog", { name: /Lyrics for/i })).toHaveCount(0);
});

test("library keeps local audio after reload and shows portfolio attribution", async ({ page }) => {
  await importLocalTrack(page);
  await expect(page.getByText("Files stay in this browser")).toBeVisible();
  await expect(page.getByRole("link", { name: /Developed by Sohan Talukder/i })).toHaveAttribute("href", "https://sohantalukder.github.io");
  await page.reload();
  await expect(page.getByText("local-test", { exact: true })).toBeVisible();
});

test("online search plays in the same tab through native audio controls", async ({ page }) => {
  await mockArchive(page);
  await page.goto("/search?q=ambient");
  await expect(page.getByRole("heading", { name: "Music in Auralume", exact: true })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator("iframe, video")).toHaveCount(0);
  await expect(page.getByText("Online Song", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Online Song Archive Artist", exact: true }).click();
  await expect(page).toHaveURL(/\/player/);
  await expect(page.getByRole("heading", { name: "Online Song" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: /Pause|Play/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download MP3" })).toHaveAttribute("href", archiveTrack.downloadUrl);
});

test("YouTube search plays songs outside Archive in audio-only mode", async ({ page }) => {
  // YouTube audio plays through the server proxy and the shared native audio element.
  const audio = await readFile(fixture);
  await page.route("**/api/youtube/audio**", async (route) => {
    // Mirror the proxy's byte-range contract so the browser can seek.
    const match = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : audio.length - 1;
    await route.fulfill({
      status: 206,
      headers: { "Content-Type": "audio/wav", "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${audio.length}` },
      body: audio.subarray(start, end + 1),
    });
  });
  await page.route("**/api/archive**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], provider: "internet-archive" }) });
  });
  await page.route("**/api/youtube/search**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [youtubeTrack], provider: "youtube" }) });
  });
  await page.goto("/search?q=ami%20suneci");
  await expect(page.getByText(youtubeTrack.title, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `${youtubeTrack.title} ${youtubeTrack.artist}` }).click();
  await expect(page).toHaveURL(/\/player/);
  await expect(page.locator("iframe, video")).toHaveCount(0);
  await expect(page.getByText("YouTube audio-only stream · no video is loaded")).toHaveCount(0);
  const title = page.getByRole("heading", { name: youtubeTrack.title });
  await expect(title).toBeVisible();
  const titleLayout = await title.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { fontSize: Number.parseFloat(getComputedStyle(element).fontSize), top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
  });
  expect(titleLayout.fontSize).toBeLessThanOrEqual(48);
  expect(titleLayout.top).toBeGreaterThanOrEqual(0);
  expect(titleLayout.bottom).toBeLessThanOrEqual(titleLayout.viewportHeight);
  await expect(page.getByRole("main").getByRole("button", { name: /Pause|Play/ })).toBeVisible();

  // The player URL names the track, so a reload restores it instead of "Nothing playing".
  await expect(page).toHaveURL(/\/player\?track=youtube%3AIF9GJstin2g/);
  await page.reload();
  await expect(page.getByRole("heading", { name: youtubeTrack.title })).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();

  await page.goBack();
  await expect(page).toHaveURL(/\/search/);
  const miniPlayer = page.getByLabel("Music player");
  await expect(miniPlayer).toBeVisible();
  const miniTimeline = miniPlayer.getByRole("slider", { name: "Seek track" });
  const timeBefore = Number(await miniTimeline.getAttribute("aria-valuenow"));
  await expect.poll(async () => Number(await miniTimeline.getAttribute("aria-valuenow"))).toBeGreaterThan(timeBefore);
  await miniTimeline.focus();
  await miniTimeline.press("End");
  await expect.poll(async () => Number(await miniTimeline.getAttribute("aria-valuenow"))).toBeGreaterThan(20);
});

test("home updates recommendations from an in-place search without a reload", async ({ page, isMobile }) => {
  test.skip(isMobile, "Phones search from the Search tab, not the top bar.");
  await page.route("**/api/archive**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [archiveTrack], provider: "internet-archive" }) });
  });
  await page.route("**/api/youtube/search**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [youtubeTrack], provider: "youtube" }) });
  });
  await page.goto("/home");
  await page.getByRole("combobox", { name: "Search music" }).fill("late night songs");
  await expect(page.getByRole("listbox").getByText(youtubeTrack.title, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Because you searched for “late night songs”" })).toBeVisible();
  await expect(page.locator(".card-grid").getByText(youtubeTrack.title, { exact: true })).toBeVisible();
});

test("home is online-first and device import remains optional", async ({ page }) => {
  await mockArchive(page);
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
  await expect(page.getByText("Online Song", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add music from this device" })).toBeVisible();
  await page.getByRole("link", { name: /Open local library/i }).click();
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});

test("local playlists keep track metadata and can be managed", async ({ page }) => {
  await page.goto("/playlists");
  await page.getByRole("button", { name: "New playlist" }).click();
  await page.getByPlaceholder("Playlist name").fill("Focus mix");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await importLocalTrack(page);
  await page.getByRole("button", { name: "More options for local-test" }).click();
  await page.getByRole("menuitem", { name: "Add to Focus mix" }).click();
  await page.goto("/playlists");
  await page.getByRole("link", { name: /Focus mix/ }).click();
  await expect(page.getByText("local-test", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("local-test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Playlist name").fill("Deep focus");
  await page.getByLabel("Playlist name").press("Enter");
  await expect(page.getByRole("heading", { name: "Deep focus" })).toBeVisible();
});

test("sidebar collapses to icons and remembers the choice", async ({ page, isMobile }) => {
  test.skip(isMobile, "Phones use the tab bar instead of the sidebar.");
  await page.goto("/home");
  const sidebar = page.locator(".sidebar");
  await expect(page.getByRole("link", { name: "Liked songs" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeLessThan(90);
  // Icon-only links stay usable through their accessible names.
  await page.getByRole("link", { name: "Liked songs" }).click();
  await expect(page).toHaveURL(/\/liked/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeGreaterThan(200);
});

test("sound, preference, and custom color settings persist locally", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Use custom colors").check();
  await page.getByLabel("Enable equalizer").check();
  await page.getByRole("button", { name: "Bass" }).click();
  await page.getByText("Favorite artists").locator("..").getByRole("textbox").fill("Arnob, Nina Simone");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.reload();
  await expect(page.getByLabel("Use custom colors")).toBeChecked();
  await expect(page.getByLabel("Enable equalizer")).toBeChecked();
  await expect(page.getByRole("button", { name: "Bass" })).toHaveAttribute("aria-pressed", "true");
});
