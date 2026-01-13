import { getDataCardPreviewFields, setDataCardPreviewFields } from '@/shared/lib/tauri';

export type DataCardPreviewField =
  | 'username'
  | 'recovery_email'
  | 'mobile_phone'
  | 'note'
  | 'folder'
  | 'tags';

export const MAX_DATA_CARD_PREVIEW_FIELDS = 3;

const EVENT_NAME = 'datacard-preview-fields-changed';

const isAllowed = (value: string): value is DataCardPreviewField =>
  value === 'username' ||
  value === 'recovery_email' ||
  value === 'mobile_phone' ||
  value === 'note' ||
  value === 'folder' ||
  value === 'tags';

export async function loadPreviewFields(): Promise<DataCardPreviewField[]> {
  try {
    const raw = await getDataCardPreviewFields();
    const out: DataCardPreviewField[] = [];
    for (const item of raw) {
      if (!isAllowed(item)) continue;
      if (out.includes(item)) continue;
      out.push(item);
      if (out.length >= MAX_DATA_CARD_PREVIEW_FIELDS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function savePreviewFields(fields: DataCardPreviewField[]): Promise<void> {
  const unique: DataCardPreviewField[] = [];
  for (const f of fields) {
    if (!unique.includes(f)) unique.push(f);
    if (unique.length >= MAX_DATA_CARD_PREVIEW_FIELDS) break;
  }
  await setDataCardPreviewFields(unique);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: unique }));
}

export function onPreviewFieldsChanged(handler: (fields: DataCardPreviewField[]) => void): () => void {
  const listener = (evt: Event) => {
    const custom = evt as CustomEvent;
    const raw = Array.isArray(custom.detail) ? custom.detail : [];
    const fields: DataCardPreviewField[] = raw.filter(isAllowed).slice(0, MAX_DATA_CARD_PREVIEW_FIELDS);
    handler(fields);
  };

  window.addEventListener(EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(EVENT_NAME, listener as EventListener);
}
