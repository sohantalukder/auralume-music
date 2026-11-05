export type LyricLine = { time: number; text: string };

export function parseSyncedLyrics(value = ""): LyricLine[] {
  return value.split(/\r?\n/).flatMap((line) => {
    const matches = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]+\]/g, "").trim();
    if (!text) return [];
    return matches.map((match) => ({
      time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${(match[3] || "0").padEnd(2, "0")}`),
      text,
    }));
  }).sort((a, b) => a.time - b.time);
}

export function activeLyricIndex(lines: LyricLine[], currentTime: number) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (currentTime >= lines[index].time) return index;
  }
  return -1;
}
