import "server-only";
import { BotGuardClient } from "bgutils-js/botguard";
import type { WebPoSignalOutput } from "bgutils-js/shared-types";
import { buildURL, getHeaders, parseLooseJSON, USER_AGENT } from "bgutils-js/utils";
import { WebPoMinter } from "bgutils-js/webpo";
import { JSDOM } from "jsdom";

const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
const MAX_UPSTREAM_TEXT_BYTES = 5 * 1024 * 1024;
const MINTER_FALLBACK_TTL_MS = 30 * 60 * 1000;

type MinterState = { minter: WebPoMinter; expiresAt: number };

let state: MinterState | undefined;
let pending: Promise<MinterState> | undefined;

async function textResponse(response: Response, label: string) {
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  const text = await response.text();
  if (!text || text.length > MAX_UPSTREAM_TEXT_BYTES) throw new Error(`${label} returned invalid content`);
  return text;
}

function trustedInterpreterUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("YouTube attestation interpreter is unavailable");
  const url = new URL(value, "https://www.youtube.com");
  const trustedHost = /(^|\.)(?:youtube|google)\.com$/i.test(url.hostname);
  if (url.protocol !== "https:" || !trustedHost) throw new Error("Unexpected YouTube interpreter host");
  return url;
}

async function createMinter(): Promise<MinterState> {
  const dom = new JSDOM("<!doctype html><html lang=\"en\"><head></head><body></body></html>", {
    url: "https://www.youtube.com",
    referrer: "https://www.youtube.com/",
  });
  const pageHtml = await textResponse(await fetch("https://www.youtube.com", {
    headers: { accept: "*/*", "accept-language": "en-US,en;q=0.7", "user-agent": USER_AGENT },
  }), "YouTube attestation page");
  const configJson = pageHtml.match(/ytcfg\.set\(({.+?})\);/s)?.[1];
  if (!configJson) throw new Error("YouTube attestation config is unavailable");
  const youtubeWindow = dom.window as typeof dom.window & { yt: { config_: unknown } };
  youtubeWindow.yt = { config_: JSON.parse(configJson) as unknown };
  Object.assign(globalThis, {
    yt: youtubeWindow.yt,
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    origin: dom.window.origin,
  });
  if (!("navigator" in globalThis)) Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator });

  const attestationJson = pageHtml.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/)?.[1];
  if (!attestationJson) throw new Error("YouTube attestation challenge is unavailable");
  const challenge = parseLooseJSON(attestationJson).R?.bgChallenge;
  if (!challenge) throw new Error("YouTube attestation challenge is invalid");
  const interpreterUrl = trustedInterpreterUrl(challenge.interpreterUrl?.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue);
  const interpreter = await textResponse(await fetch(interpreterUrl), "YouTube attestation interpreter");
  new Function(interpreter)();

  const botGuardClient = await BotGuardClient.create({
    program: challenge.program,
    globalName: challenge.globalName,
    globalObject: globalThis,
  });
  const webPoSignalOutput: WebPoSignalOutput = [];
  const botguardResponse = await botGuardClient.snapshot({ webPoSignalOutput });
  const integrityResponse = await fetch(buildURL("GenerateIT", true), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([REQUEST_KEY, botguardResponse]),
  });
  if (!integrityResponse.ok) throw new Error(`YouTube integrity service returned ${integrityResponse.status}`);
  const integrity = await integrityResponse.json();
  if (!Array.isArray(integrity)) throw new Error("YouTube integrity response is invalid");
  const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] = integrity;
  const minter = await WebPoMinter.create({ integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken }, webPoSignalOutput);
  const ttlMs = typeof estimatedTtlSecs === "number" && estimatedTtlSecs > 600
    ? (estimatedTtlSecs - 300) * 1000
    : MINTER_FALLBACK_TTL_MS;
  return { minter, expiresAt: Date.now() + ttlMs };
}

async function currentMinter() {
  if (state && state.expiresAt > Date.now()) return state.minter;
  pending ??= createMinter().then((created) => {
    state = created;
    return created;
  }).finally(() => {
    pending = undefined;
  });
  return (await pending).minter;
}

export async function getYouTubeContentPoToken(videoId: string) {
  return (await currentMinter()).mintAsWebsafeString(videoId);
}
