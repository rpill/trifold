import { parsePlayerProfile } from './ProfileSchema.ts';
import type { PlayerProfileV1 } from './ProfileTypes.ts';
import type { PlayerStorage, TrustedClock } from '../../platform/services.ts';
import { CloudProfileStore } from './CloudProfileStore.ts';
import { mergeProfiles } from './ProfileMerge.ts';

export interface ProfileStore {
  load(): Promise<PlayerProfileV1>;
  save(profile: PlayerProfileV1): Promise<void>;
}

export type ProfileReducer = (
  profile: PlayerProfileV1,
) => PlayerProfileV1 | Promise<PlayerProfileV1>;

export class ProfileRepository {
  private readonly store: ProfileStore;
  private cloudStore: CloudProfileStore | null = null;
  private profile: PlayerProfileV1;
  private queue: Promise<void> = Promise.resolve();

  private constructor(store: ProfileStore, profile: PlayerProfileV1) {
    this.store = store;
    this.profile = parsePlayerProfile(profile);
  }

  static async open(store: ProfileStore): Promise<ProfileRepository> {
    return new ProfileRepository(store, await store.load());
  }

  get current(): PlayerProfileV1 {
    return structuredClone(this.profile);
  }

  async connectCloud(platform: { readonly storage: PlayerStorage; readonly clock: TrustedClock }): Promise<PlayerProfileV1> {
    const cloud = new CloudProfileStore(platform.storage, platform.clock);
    const remote = await cloud.load();
    const merged = remote ? mergeProfiles(this.profile, remote) : parsePlayerProfile(this.profile);
    await this.store.save(merged);
    try {
      await cloud.save(merged, true);
      this.cloudStore = cloud;
    } catch {
      this.cloudStore = cloud;
    }
    this.profile = merged;
    return structuredClone(merged);
  }

  mutate(reducer: ProfileReducer): Promise<PlayerProfileV1> {
    const run = this.queue.then(async () => {
      const candidate = await reducer(structuredClone(this.profile));
      const parsed = parsePlayerProfile(candidate);
      await this.store.save(parsed);
      if (this.cloudStore) {
        try { await this.cloudStore.save(parsed, false); } catch { /* local commit remains authoritative */ }
      }
      this.profile = parsed;
      return structuredClone(parsed);
    });

    // A rejected mutation must not permanently poison later writes. The caller
    // still receives the original rejection through `run`.
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
