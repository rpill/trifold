import type { MetaOperation } from './MetaOperations.ts';

export interface MetaJournalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MetaJournalEnvelope {
  readonly stream: string;
  readonly sequence: number;
  readonly operation: MetaOperation;
}

interface PersistedJournal {
  readonly version: 1;
  readonly stream: string;
  readonly nextSequence: number;
  readonly pending: readonly MetaJournalEnvelope[];
}

const JOURNAL_KEY_PREFIX = 'trifoldMetaJournal:';
const STREAM_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/u;
const ATTEMPT_PATTERN = /^[a-zA-Z0-9_~\-]{1,100}$/u;

function resolveBrowserStorage(): MetaJournalStorage | null {
  try {
    return (globalThis as typeof globalThis & { localStorage?: MetaJournalStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDifficulty(value: unknown): value is 'easy' | 'medium' | 'hard' {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function isPartition(value: unknown): value is 'onboarding' | 'easy' | 'medium' | 'hard' {
  return value === 'onboarding' || value === 'easy' || value === 'medium' || value === 'hard';
}

function isMetaOperation(value: unknown): value is MetaOperation {
  if (!isObject(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'set-standard-difficulty') return isDifficulty(value.difficulty);
  if (value.kind === 'standard-served') {
    return Number.isSafeInteger(value.seed) && (value.seed as number) > 0
      && isPartition(value.partition) && isDifficulty(value.difficulty)
      && (value.partition === 'onboarding' ? value.difficulty === 'easy' : value.partition === value.difficulty);
  }
  if (value.kind === 'standard-failed') return typeof value.attemptId === 'string' && ATTEMPT_PATTERN.test(value.attemptId);
  if (value.kind === 'daily-hint-used') return typeof value.dailyId === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value.dailyId);
  if (value.kind !== 'begin' && value.kind !== 'complete') return false;
  if (typeof value.attemptId !== 'string' || !ATTEMPT_PATTERN.test(value.attemptId)) return false;
  if (value.mode !== 'standard' && value.mode !== 'daily') return false;
  if (value.dailyId !== undefined && (typeof value.dailyId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value.dailyId))) return false;
  if (value.kind === 'begin' && value.dailyRankingEligible !== undefined && typeof value.dailyRankingEligible !== 'boolean') return false;
  return value.mode !== 'daily' || typeof value.dailyId === 'string';
}

function parseJournal(serialized: string): PersistedJournal | null {
  try {
    const raw: unknown = JSON.parse(serialized);
    if (!isObject(raw) || raw.version !== 1 || typeof raw.stream !== 'string' || !STREAM_PATTERN.test(raw.stream)
      || !Number.isSafeInteger(raw.nextSequence) || (raw.nextSequence as number) < 1 || !Array.isArray(raw.pending)) return null;
    const pending: MetaJournalEnvelope[] = [];
    let previous = 0;
    for (const candidate of raw.pending) {
      if (!isObject(candidate) || candidate.stream !== raw.stream || !Number.isSafeInteger(candidate.sequence)
        || (candidate.sequence as number) <= previous || (candidate.sequence as number) >= (raw.nextSequence as number)
        || !isMetaOperation(candidate.operation)) return null;
      previous = candidate.sequence as number;
      pending.push({ stream: raw.stream, sequence: previous, operation: structuredClone(candidate.operation) });
    }
    return { version: 1, stream: raw.stream, nextSequence: raw.nextSequence as number, pending };
  } catch {
    return null;
  }
}

function createStream(): string {
  try {
    const id = globalThis.crypto?.randomUUID();
    if (id && STREAM_PATTERN.test(id)) return id;
  } catch {
    // Fall back below.
  }
  return `stream_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export class MetaJournal {
  private readonly key: string;
  private readonly storage: MetaJournalStorage | null;
  private journal: PersistedJournal;
  private storageDurable: boolean;

  constructor(scope: string, storage: MetaJournalStorage | null = resolveBrowserStorage()) {
    this.key = `${JOURNAL_KEY_PREFIX}${encodeURIComponent(scope || 'local')}`;
    this.storage = storage;
    this.storageDurable = storage !== null;
    let restored: PersistedJournal | null = null;
    if (storage) {
      try {
        const serialized = storage.getItem(this.key);
        restored = serialized === null ? null : parseJournal(serialized);
      } catch {
        this.storageDurable = false;
      }
    }
    this.journal = restored ?? { version: 1, stream: createStream(), nextSequence: 1, pending: [] };
  }

  get stream(): string { return this.journal.stream; }
  get nextSequence(): number { return this.journal.nextSequence; }
  get durable(): boolean { return this.storageDurable; }
  get pending(): readonly MetaJournalEnvelope[] { return structuredClone(this.journal.pending); }

  append(operation: MetaOperation): MetaJournalEnvelope | null {
    const envelope: MetaJournalEnvelope = {
      stream: this.journal.stream,
      sequence: this.journal.nextSequence,
      operation: structuredClone(operation),
    };
    const next: PersistedJournal = {
      ...this.journal,
      nextSequence: this.journal.nextSequence + 1,
      pending: [...this.journal.pending, envelope],
    };
    if (!this.persist(next)) return null;
    this.journal = next;
    return structuredClone(envelope);
  }

  acknowledge(included: readonly MetaJournalEnvelope[]): boolean {
    const sequences = new Set(included.filter(({ stream }) => stream === this.journal.stream).map(({ sequence }) => sequence));
    if (sequences.size === 0) return true;
    const next: PersistedJournal = {
      ...this.journal,
      pending: this.journal.pending.filter(({ sequence }) => !sequences.has(sequence)),
    };
    if (!this.persist(next)) return false;
    this.journal = next;
    return true;
  }

  private persist(next: PersistedJournal): boolean {
    if (this.storage === null) return true;
    try {
      this.storage.setItem(this.key, JSON.stringify(next));
      this.storageDurable = true;
      return true;
    } catch {
      this.storageDurable = false;
      return false;
    }
  }
}
