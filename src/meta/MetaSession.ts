import type { PlayerStorage } from '../platform/services.ts';
import { applyMetaOperation, type MetaOperation } from './MetaOperations.ts';
import { MetaJournal, type MetaJournalEnvelope } from './MetaJournal.ts';
import { createDefaultMetaSave, normalizeMetaSave, type MetaSave } from './MetaSave.ts';

const META_KEY = 'trifoldMeta';
export type MetaSessionStatus = 'loading' | 'ready' | 'error';

type StrictPlayerStorage = PlayerStorage & {
  loadStrict?: () => Promise<unknown>;
  saveStrict?: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class MetaSession {
  onChange?: () => void;

  private currentState: MetaSave = createDefaultMetaSave();
  private currentStatus: MetaSessionStatus = 'loading';
  private currentlySaving = false;
  private lastSaveFailed = false;
  private loadInFlight: Promise<boolean> | null = null;
  private flushInFlight: Promise<boolean> | null = null;
  private forcedSnapshotPending = false;
  private readonly storage: StrictPlayerStorage;
  private readonly journal: MetaJournal;

  constructor(storage: PlayerStorage, journal: MetaJournal = new MetaJournal('local')) {
    this.storage = storage as StrictPlayerStorage;
    this.journal = journal;
  }

  get state(): MetaSave { return this.currentState; }
  get status(): MetaSessionStatus { return this.currentStatus; }
  get saving(): boolean { return this.currentlySaving; }
  get saveError(): boolean { return this.lastSaveFailed; }
  get durable(): boolean { return this.journal.durable; }

  load(): Promise<boolean> {
    if (this.loadInFlight) return this.loadInFlight;
    this.loadInFlight = this.performLoad().finally(() => { this.loadInFlight = null; });
    return this.loadInFlight;
  }

  dispatch(operation: MetaOperation): boolean {
    const envelope = this.journal.append(operation);
    if (!envelope) {
      this.lastSaveFailed = true;
      this.notify();
      return false;
    }
    this.currentState = this.applyEnvelope(this.currentState, envelope);
    this.notify();
    if (this.currentStatus === 'ready') void this.flush();
    return true;
  }

  async dispatchAndFlush(operation: MetaOperation): Promise<boolean> {
    if (!this.dispatch(operation)) return false;
    return this.flush();
  }

  flush(): Promise<boolean> {
    if (this.currentStatus !== 'ready') return Promise.resolve(false);
    if (this.flushInFlight) return this.flushInFlight;
    this.currentlySaving = true;
    this.notify();
    this.flushInFlight = this.performFlush().finally(() => {
      this.currentlySaving = false;
      this.flushInFlight = null;
      this.notify();
    });
    return this.flushInFlight;
  }

  adoptBootstrapState(state: MetaSave): void {
    this.currentState = normalizeMetaSave(state);
    this.currentStatus = 'ready';
    this.forcedSnapshotPending = true;
    this.notify();
  }

  replaceAndFlush(state: MetaSave): Promise<boolean> {
    if (this.currentStatus !== 'ready') return Promise.resolve(false);
    this.currentState = normalizeMetaSave(state);
    this.forcedSnapshotPending = true;
    this.notify();
    return this.flush();
  }

  private loadStorage(): Promise<unknown> {
    return this.storage.loadStrict?.() ?? this.storage.load();
  }

  private async loadStorageWithRetry(): Promise<unknown> {
    try {
      return await this.loadStorage();
    } catch {
      return this.loadStorage();
    }
  }

  private async performLoad(): Promise<boolean> {
    this.currentStatus = 'loading';
    this.notify();
    try {
      const raw = await this.loadStorageWithRetry();
      const root = isObject(raw) ? raw : {};
      let loaded = normalizeMetaSave(root[META_KEY]);
      const pending = [...this.journal.pending].sort((a, b) => a.sequence - b.sequence);
      for (const envelope of pending) {
        const applied = loaded.progression.receipts[envelope.stream] ?? 0;
        if (envelope.sequence <= applied) continue;
        loaded = this.applyEnvelope(loaded, envelope);
      }
      this.currentState = loaded;
      this.currentStatus = 'ready';
      this.notify();
      if (pending.length > 0) void this.flush();
      return true;
    } catch {
      this.currentStatus = 'error';
      this.notify();
      return false;
    }
  }

  private async performFlush(): Promise<boolean> {
    while (true) {
      const included = this.journal.pending;
      const forceSnapshot = this.forcedSnapshotPending;
      if (included.length === 0 && !forceSnapshot) {
        this.setSaveError(false);
        return true;
      }
      const stateAtSave = this.currentState;
      const snapshot = structuredClone(stateAtSave);
      try {
        if (this.storage.saveStrict) await this.storage.saveStrict({ [META_KEY]: snapshot }, true);
        else await this.storage.save({ [META_KEY]: snapshot }, true);
      } catch {
        this.setSaveError(true);
        return false;
      }
      if (forceSnapshot && this.currentState === stateAtSave) this.forcedSnapshotPending = false;
      if (included.length > 0 && !this.journal.acknowledge(included)) {
        this.setSaveError(true);
        return false;
      }
      this.setSaveError(false);
    }
  }

  private applyEnvelope(state: MetaSave, envelope: MetaJournalEnvelope): MetaSave {
    const next = applyMetaOperation(state, envelope.operation);
    return {
      ...next,
      progression: {
        ...next.progression,
        receipts: { ...next.progression.receipts, [envelope.stream]: envelope.sequence },
      },
    };
  }

  private setSaveError(failed: boolean): void {
    if (this.lastSaveFailed === failed) return;
    this.lastSaveFailed = failed;
    this.notify();
  }

  private notify(): void {
    try { this.onChange?.(); } catch { /* observers cannot interrupt persistence */ }
  }
}
