"use client";

import { AudioLines, Check, Moon, Palette, RotateCcw, Save, ShieldCheck, SlidersHorizontal, Trash2, Volume2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { contrastRatio, equalizerFrequencies, equalizerPresets } from "@/lib/customization";
import { clearPersonalization } from "@/lib/personalization";
import type { ListeningPreferences } from "@/lib/types";
import { APP_NAME } from "@/lib/brand";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore, useStoreHydrated } from "@/stores/player-store";

const splitValues = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

export function SettingsScreen() {
  // Remount once saved settings load so the preference drafts start from them.
  const hydrated = useStoreHydrated();
  return <SettingsForm key={hydrated ? "saved" : "default"} />;
}

function SettingsForm() {
  const { theme: storedTheme, setTheme } = useTheme();
  // The theme is read from storage on the client; render it unselected on the server to match.
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const theme = mounted ? storedTheme : undefined;
  const store = usePlayerStore(useShallow((state) => ({
    preferences: state.preferences,
    appearance: state.appearance,
    volume: state.volume,
    equalizer: state.equalizer,
    setPreferences: state.setPreferences,
    setAppearance: state.setAppearance,
    resetAppearance: state.resetAppearance,
    setVolume: state.setVolume,
    setEqualizerEnabled: state.setEqualizerEnabled,
    setEqualizerPreset: state.setEqualizerPreset,
    setEqualizerGain: state.setEqualizerGain,
  })));
  const [draftPreferences, setDraftPreferences] = useState(() => ({
    artists: store.preferences.artists.join(", "),
    genres: store.preferences.genres.join(", "),
    languages: store.preferences.languages.join(", "),
  }));
  const [preferencesStatus, setPreferencesStatus] = useState<"idle" | "saved" | "cleared">("idle");
  const [personalizationStatus, setPersonalizationStatus] = useState<"idle" | "clearing" | "cleared" | "error">("idle");
  const contrast = useMemo(() => contrastRatio(store.appearance.background, store.appearance.foreground), [store.appearance.background, store.appearance.foreground]);
  const savePreferences = () => {
    const preferences: ListeningPreferences = {
      artists: splitValues(draftPreferences.artists),
      genres: splitValues(draftPreferences.genres),
      languages: splitValues(draftPreferences.languages),
    };
    store.setPreferences(preferences);
    setPreferencesStatus("saved");
  };
  const resetPersonalization = async () => {
    setPersonalizationStatus("clearing");
    try { await clearPersonalization(); setPersonalizationStatus("cleared"); }
    catch { setPersonalizationStatus("error"); }
  };

  return <div className="page-stack settings-page">
    <div className="section-heading"><div><span className="eyebrow"><Palette size={14} /> Make it yours</span><h1>Settings</h1><p>Sound, appearance, and recommendations stay in this browser.</p></div></div>
    <section className="settings-card"><div><Moon /><span><strong>Appearance mode</strong><small>Choose the base interface.</small></span></div><div className="segmented" role="group" aria-label="Appearance mode">{(["light", "dark", "system"] as const).map((option) => <button key={option} aria-pressed={theme === option} className={theme === option ? "active" : ""} onClick={() => setTheme(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div></section>
    <section className="settings-panel"><header><Palette /><div><strong>Custom colors</strong><small>Preview a personal palette across {APP_NAME}.</small></div><label className="switch"><input type="checkbox" checked={store.appearance.enabled} onChange={(event) => store.setAppearance({ ...store.appearance, enabled: event.target.checked })} /><span>Use custom colors</span></label></header><div className="color-grid">{(["background", "surface", "foreground", "accent"] as const).map((key) => <label key={key}><span>{key === "foreground" ? "Text" : key[0].toUpperCase() + key.slice(1)}</span><input type="color" value={store.appearance[key]} onChange={(event) => store.setAppearance({ ...store.appearance, enabled: true, [key]: event.target.value })} /><code>{store.appearance[key]}</code></label>)}</div>{contrast < 4.5 && <p className="contrast-warning" role="alert">Text contrast is {contrast.toFixed(1)}:1. Choose colors that reach at least 4.5:1 for readable body text.</p>}<Button variant="secondary" size="sm" onClick={store.resetAppearance}><RotateCcw size={15} /> Reset colors</Button></section>
    <section className="settings-card"><div><Volume2 /><span><strong>Default volume</strong><small>{Math.round(store.volume * 100)}% on this device.</small></span></div><Slider aria-label="Default volume" value={[store.volume]} max={1} step={0.01} onValueChange={([value]) => store.setVolume(value)} /></section>
    <section className="settings-panel"><header><AudioLines /><div><strong>Equalizer</strong><small>Shape audio with five frequency bands.</small></div><label className="switch"><input aria-label="Enable equalizer" type="checkbox" checked={store.equalizer.enabled} onChange={(event) => store.setEqualizerEnabled(event.target.checked)} /><span>{store.equalizer.enabled ? "Enabled" : "Bypassed"}</span></label></header><div className="preset-row" role="group" aria-label="Equalizer preset">{(["flat", "bass", "vocal", "bright"] as const).map((preset) => <button key={preset} aria-pressed={store.equalizer.preset === preset} className={store.equalizer.preset === preset ? "active" : ""} onClick={() => store.setEqualizerPreset(preset)}>{preset[0].toUpperCase() + preset.slice(1)}</button>)}</div><div className="equalizer-grid">{equalizerFrequencies.map((frequency, index) => <label key={frequency}><span>{frequency >= 1000 ? `${frequency / 1000}k` : frequency} Hz</span><Slider aria-label={`${frequency} hertz gain`} value={[store.equalizer.gains[index] ?? equalizerPresets.flat[index]]} min={-12} max={12} step={1} onValueChange={([value]) => store.setEqualizerGain(index, value)} /><output>{store.equalizer.gains[index] > 0 ? "+" : ""}{store.equalizer.gains[index]} dB</output></label>)}</div></section>
    <section className="settings-panel"><header><SlidersHorizontal /><div><strong>Listening preferences</strong><small>Optional hints for a more useful home page.</small></div></header><div className="preference-grid">{(["artists", "genres", "languages"] as const).map((key) => <label key={key}><span>Favorite {key}</span><input value={draftPreferences[key]} onChange={(event) => { setPreferencesStatus("idle"); setDraftPreferences((current) => ({ ...current, [key]: event.target.value })); }} placeholder={key === "artists" ? "e.g. Miles Davis, Arnob" : key === "genres" ? "e.g. jazz, ambient" : "e.g. Bangla, English"} /><small>Separate multiple choices with commas.</small></label>)}</div><div className="settings-actions"><Button size="sm" onClick={savePreferences}>{preferencesStatus === "saved" ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save preferences</>}</Button><Button variant="secondary" size="sm" onClick={() => { const empty = { artists: "", genres: "", languages: "" }; setDraftPreferences(empty); store.setPreferences({ artists: [], genres: [], languages: [] }); setPreferencesStatus("cleared"); }}><Trash2 size={15} /> Clear</Button>{preferencesStatus !== "idle" && <small className="form-message" role="status">{preferencesStatus === "saved" ? "Preferences saved. Home will update with new picks." : "Preferences cleared."}</small>}</div></section>
    <section className="settings-card"><div><ShieldCheck /><span><strong>Listening personalization</strong><small>Clear searches, affinities, plays, skips, and recommendation impressions.</small></span></div><div><Button variant="secondary" disabled={personalizationStatus === "clearing"} onClick={resetPersonalization}>{personalizationStatus === "clearing" ? <><Trash2 /> Clearing…</> : personalizationStatus === "cleared" ? <><Check /> Cleared</> : <><Trash2 /> Clear personalization</>}</Button>{personalizationStatus === "error" && <small className="form-error" role="alert">Could not clear personalization. Please retry.</small>}</div></section>
    <p className="settings-note">These settings and your library stay in this browser.</p>
  </div>;
}
