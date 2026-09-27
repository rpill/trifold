import type { PlayerStorage } from '../platform/services.ts';
import { ActiveGameRepository } from '../persistence/ActiveGameRepository.ts';
import type { TrifoldActiveGameSave } from '../persistence/ActiveGameSave.ts';
import { createDefaultMetaSave, META_SAVE_VERSION, normalizeMetaSave, type MetaSave } from './MetaSave.ts';
import { migrateLegacyProfile, type LegacyPreferenceSnapshot } from './LegacyProfileMigration.ts';
import { mergeProfiles } from './profile/ProfileMerge.ts';
import { parsePlayerProfile } from './profile/ProfileSchema.ts';
import type { PlayerProfileV1 } from './profile/ProfileTypes.ts';

export interface LegacyBrowserStorage {
  getItem(key: string): string | null;
}

export interface MetaBootstrapResult {
  readonly meta: MetaSave;
  readonly activeGame: TrifoldActiveGameSave | null;
  readonly preferences: LegacyPreferenceSnapshot;
  readonly migrated: boolean;
  readonly persisted: boolean;
}

const LEGACY_PROFILE_KEY = 'trifoldPlayerProfile';
const DEFAULT_PREFERENCES: LegacyPreferenceSnapshot = {
  language: null,
  soundEnabled: true,
  tutorialCompleted: false,
};

type StrictPlayerStorage = PlayerStorage & {
  loadStrict?: () => Promise<unknown>;
  saveStrict?: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readLegacyLocal(storage: LegacyBrowserStorage | null): PlayerProfileV1 | null {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(LEGACY_PROFILE_KEY);
    if (!serialized) return null;
    return parsePlayerProfile(JSON.parse(serialized));
  } catch {
    return null;
  }
}

function readLegacyCloud(root: unknown): PlayerProfileV1 | null {
  if (!isObject(root) || root.trifoldProfileVersion !== 1) return null;
  try {
    return parsePlayerProfile(root.profile);
  } catch {
    return null;
  }
}

function readCurrentMeta(root: unknown): MetaSave | null {
  if (!isObject(root) || !isObject(root.trifoldMeta) || root.trifoldMeta.version !== META_SAVE_VERSION) return null;
  return normalizeMetaSave(root.trifoldMeta);
}

async function loadBestEffort(storage: StrictPlayerStorage): Promise<unknown> {
  try {
    return await (storage.loadStrict?.() ?? storage.load());
  } catch {
    return null;
  }
}

async function saveBestEffort(storage: StrictPlayerStorage, meta: MetaSave): Promise<boolean> {
  try {
    if (storage.saveStrict) await storage.saveStrict({ trifoldMeta: meta }, true);
    else await storage.save({ trifoldMeta: meta }, true);
    return true;
  } catch {
    return false;
  }
}

export async function bootstrapMetaState(
  platformStorage: PlayerStorage,
  legacyLocalStorage: LegacyBrowserStorage | null,
  activeGameRepository: ActiveGameRepository,
): Promise<MetaBootstrapResult> {
  const storage = platformStorage as StrictPlayerStorage;
  const root = await loadBestEffort(storage);
  const existingMeta = readCurrentMeta(root);
  if (existingMeta) {
    return {
      meta: existingMeta,
      activeGame: activeGameRepository.load(),
      preferences: DEFAULT_PREFERENCES,
      migrated: false,
      persisted: true,
    };
  }

  const local = readLegacyLocal(legacyLocalStorage);
  const cloud = readLegacyCloud(root);
  let legacy: PlayerProfileV1 | null = null;
  if (local && cloud) legacy = mergeProfiles(local, cloud);
  else legacy = local ?? cloud;

  if (legacy) {
    const migrated = migrateLegacyProfile(legacy);
    if (activeGameRepository.load() === null && migrated.activeGame !== null) {
      activeGameRepository.save(migrated.activeGame);
    }
    const persisted = await saveBestEffort(storage, migrated.meta);
    return {
      meta: migrated.meta,
      activeGame: activeGameRepository.load(),
      preferences: migrated.preferences,
      migrated: true,
      persisted,
    };
  }

  const meta = createDefaultMetaSave();
  const persisted = await saveBestEffort(storage, meta);
  return {
    meta,
    activeGame: activeGameRepository.load(),
    preferences: DEFAULT_PREFERENCES,
    migrated: false,
    persisted,
  };
}
