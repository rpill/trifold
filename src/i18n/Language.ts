export type AppLanguage = 'ru' | 'en';

export function parseLanguageOverride(value: unknown): AppLanguage | null {
  if (value === undefined || value === null) return null;
  if (value === 'ru' || value === 'en') return value;
  throw new Error('settings.language is invalid.');
}

export function resolveAppLanguage(
  override: AppLanguage | null,
  platformLanguage: string | null | undefined,
): AppLanguage {
  if (override) return override;
  const normalized = platformLanguage?.trim().toLowerCase() ?? '';
  return normalized === 'en' || normalized.startsWith('en-') || normalized.startsWith('en_') ? 'en' : 'ru';
}
