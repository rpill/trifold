import assert from 'node:assert/strict';
import test from 'node:test';
import { Preferences, mapPlatformLanguage, type PreferenceStorage } from '../src/settings/Preferences.ts';

class MemoryStorage implements PreferenceStorage {
  readonly values = new Map<string,string>();
  getItem(key:string): string|null { return this.values.get(key) ?? null; }
  setItem(key:string,value:string): void { this.values.set(key,value); }
}

test('platform language supplies default until user chooses explicitly', () => {
  const storage = new MemoryStorage();
  const prefs = new Preferences(storage);
  prefs.initializeLanguage('de-DE');
  assert.equal(prefs.language, 'en');
  prefs.initializeLanguage('ru-RU');
  assert.equal(prefs.language, 'ru');
  prefs.setLanguage('en');
  prefs.initializeLanguage('ru-RU');
  assert.equal(prefs.language, 'en');
  const saved = JSON.parse(storage.values.get('trifoldPreferences') ?? '{}');
  assert.equal(saved.language, 'en');
});

test('sound/how-to-play persist and corrupt storage falls back safely', () => {
  const storage = new MemoryStorage();
  storage.values.set('trifoldPreferences', '{bad');
  const prefs = new Preferences(storage);
  assert.equal(prefs.soundEnabled, true);
  assert.equal(prefs.howToPlaySeen, false);
  prefs.setSoundEnabled(false);
  prefs.markHowToPlaySeen();
  const restored = new Preferences(storage);
  assert.equal(restored.soundEnabled, false);
  assert.equal(restored.howToPlaySeen, true);
});

test('legacy preferences import only when no explicit Trifold preferences exist', () => {
  const storage = new MemoryStorage();
  const prefs = new Preferences(storage);
  prefs.importLegacy({ language:'ru', soundEnabled:false, tutorialCompleted:true });
  assert.equal(prefs.language,'ru');
  assert.equal(prefs.soundEnabled,false);
  assert.equal(prefs.howToPlaySeen,true);

  const explicit = new Preferences(storage);
  explicit.setLanguage('en');
  explicit.setSoundEnabled(true);
  explicit.importLegacy({ language:'ru', soundEnabled:false, tutorialCompleted:false });
  assert.equal(explicit.language,'en');
  assert.equal(explicit.soundEnabled,true);
  assert.equal(explicit.howToPlaySeen,true);
});

test('language mapping matches product policy', () => {
  assert.equal(mapPlatformLanguage(undefined),'ru');
  assert.equal(mapPlatformLanguage('uk-UA'),'ru');
  assert.equal(mapPlatformLanguage('en-US'),'en');
});
