export type Language = 'ru' | 'en';
export interface PreferenceStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }
export interface LegacyPreferenceImport { readonly language: Language | null; readonly soundEnabled: boolean; readonly tutorialCompleted: boolean }
export const PREFERENCES_KEY = 'trifoldPreferences';

function browserStorage(): PreferenceStorage | null {
  try { return (globalThis as typeof globalThis & { localStorage?: PreferenceStorage }).localStorage ?? null; } catch { return null; }
}

export function mapPlatformLanguage(locale: string | undefined): Language {
  if (!locale) return 'ru';
  return ['ru','be','kk','uk','uz'].includes(locale.toLowerCase().split(/[-_]/)[0]!) ? 'ru' : 'en';
}

export class Preferences {
  private readonly storage: PreferenceStorage | null;
  private readonly listeners = new Set<() => void>();
  private manualLanguage = false;
  private currentLanguage: Language = 'ru';
  private currentSoundEnabled = true;
  private currentHowToPlaySeen = false;
  private hasPersistedPreferences = false;

  constructor(storage: PreferenceStorage | null = browserStorage()) {
    this.storage = storage;
    try {
      const serialized = storage?.getItem(PREFERENCES_KEY) ?? null;
      if (serialized === null) return;
      const value = JSON.parse(serialized) as unknown;
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
      const record = value as Record<string, unknown>;
      this.hasPersistedPreferences = true;
      if (record.language === 'ru' || record.language === 'en') {
        this.currentLanguage = record.language;
        this.manualLanguage = true;
      }
      if (typeof record.soundEnabled === 'boolean') this.currentSoundEnabled = record.soundEnabled;
      if (typeof record.howToPlaySeen === 'boolean') this.currentHowToPlaySeen = record.howToPlaySeen;
    } catch { /* Invalid or blocked storage uses safe defaults. */ }
  }

  get language(): Language { return this.currentLanguage; }
  get soundEnabled(): boolean { return this.currentSoundEnabled; }
  get howToPlaySeen(): boolean { return this.currentHowToPlaySeen; }

  initializeLanguage(locale: string | undefined): void {
    if (this.manualLanguage) return;
    const next = mapPlatformLanguage(locale);
    if (next === this.currentLanguage) return;
    this.currentLanguage = next;
    this.emit();
  }

  importLegacy(legacy: LegacyPreferenceImport): void {
    if (this.hasPersistedPreferences) return;
    if (legacy.language === 'ru' || legacy.language === 'en') {
      this.currentLanguage = legacy.language;
      this.manualLanguage = true;
    }
    this.currentSoundEnabled = legacy.soundEnabled;
    this.currentHowToPlaySeen = legacy.tutorialCompleted;
    this.save();
    this.emit();
  }

  setLanguage(language: Language): void {
    this.manualLanguage = true;
    this.currentLanguage = language;
    this.save();
    this.emit();
  }

  setSoundEnabled(enabled: boolean): void {
    this.currentSoundEnabled = enabled;
    this.save();
    this.emit();
  }

  markHowToPlaySeen(): void {
    if (this.currentHowToPlaySeen) return;
    this.currentHowToPlaySeen = true;
    this.save();
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private save(): void {
    this.hasPersistedPreferences = true;
    try {
      this.storage?.setItem(PREFERENCES_KEY, JSON.stringify({
        ...(this.manualLanguage ? { language: this.currentLanguage } : {}),
        soundEnabled: this.currentSoundEnabled,
        howToPlaySeen: this.currentHowToPlaySeen,
      }));
    } catch { /* Preferences still work for this page lifetime. */ }
  }

  private emit(): void { for (const listener of this.listeners) listener(); }
}
