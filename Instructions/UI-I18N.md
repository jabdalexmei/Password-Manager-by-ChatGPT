# ТЗ 1 — UI-I18N-01: убрать хардкод текста, весь текст только через i18n + поддержка плейсхолдеров

## Цель

1. В приложении **не должно остаться** текстов/лейблов/placeholder/aria-label, написанных строкой в JSX/TS (кроме символов-иконок типа `×`, `⧉`, `👁`, SVG).
    
2. i18n должен уметь **подставлять параметры** (у тебя сейчас видно `Active profile: {profileName}`).
    

## 1) Правки i18n-движка

### Файл: `src/lib/i18n.ts`

Сделать поддержку:

- новых namespaces (Common, Search, Folders, Details)
    
- параметров `t(key, params)` с подстановкой `{{param}}`
    

**Требуемые изменения:**

1. Добавить импорты:
    

- `src/i18n/English/Common.json`
    
- `src/i18n/English/Search.json`
    
- `src/i18n/English/Folders.json`
    
- `src/i18n/English/Details.json`
    

2. Расширить `Dictionaries` и `dictionaries` этими namespaces.
    
3. Сигнатура:
    

```ts
const t = (key: string, params?: Record<string, string | number>): string => { ... }
```

4. Подстановка параметров:
    

- если строка содержит `{{name}}`, заменить на `String(params.name)`
    
- заменить **все вхождения** каждого параметра
    

5. Обновить `tGlobal` аналогично (тоже с params).
    

## 2) Добавить новые i18n файлы

### Файл: `src/i18n/English/Common.json` (создать)

Минимально нужно:

```json
{
  "action.cancel": "Cancel",
  "action.close": "Close",
  "action.ok": "OK",
  "aria.dismissToast": "Dismiss",
  "error.hookToaster": "useToaster must be used within ToasterProvider"
}
```

### Файл: `src/i18n/English/Search.json` (создать)

```json
{
  "placeholder.searchVault": "Search vault"
}
```

### Файл: `src/i18n/English/Folders.json` (создать)

```json
{
  "title": "Folders",
  "nav.allItems": "All items",
  "nav.favorites": "Favorites",
  "nav.archive": "Archive",
  "nav.deleted": "Deleted",

  "action.addFolder": "Add folder",
  "action.deleteFolder": "Delete folder",
  "action.restore": "Restore",
  "action.purge": "Purge",

  "dialog.newFolder.title": "New folder",
  "dialog.newFolder.description": "Organize your vault with folders.",
  "dialog.newFolder.label": "Folder name",
  "dialog.newFolder.placeholder": "Work, Projects, Personal",
  "validation.folderNameRequired": "Folder name is required"
}
```

### Файл: `src/i18n/English/Details.json` (создать)

```json
{
  "empty.selectPrompt": "Select a card to see details",

  "label.created": "Created",
  "label.updated": "Updated",
  "label.title": "Title",
  "label.folder": "Folder",
  "label.username": "Username",
  "label.email": "Email",
  "label.url": "URL",
  "label.mobile": "Mobile phone",
  "label.password": "Password",
  "label.note": "Note",
  "label.tags": "Tags",
  "label.noValue": "—",
  "label.noFolder": "—",

  "action.copy": "Copy",
  "action.reveal": "Reveal",
  "action.hide": "Hide",
  "action.edit": "Edit",
  "action.delete": "Delete",
  "action.restore": "Restore",
  "action.purge": "Purge",
  "action.markFavorite": "Mark favorite",
  "action.unmarkFavorite": "Unmark favorite"
}
```

## 3) Обязательные замены в коде (убрать хардкод)

### `src/features/Vault/components/Search/Search.tsx`

- заменить namespace `Vault` → `Search`
    
- placeholder брать из `t('placeholder.searchVault')`
    

### `src/features/Vault/components/Folders/Folders.tsx`

- заменить namespace `Vault` → `Folders`
    
- все подписи (Folders/All items/Deleted/Restore/Purge/Delete) брать из `Folders.json`
    

### `src/features/Vault/components/Details/Details.tsx`

- заменить namespace `DataCards` → `Details`
    
- все подписи/кнопки/empty state брать из `Details.json`
    

### `src/features/Vault/components/Header/VaultHeader.tsx`

- `t('activeProfile', { profileName })` должно реально подставлять имя профиля (после правки i18n).
    

### `src/components/Toaster.tsx`

- aria-label кнопки закрытия тоста **нельзя** хардкодить (`"Dismiss"` → `tCommon('aria.dismissToast')`)
    
- строку ошибки `useToaster must be used...` вынести в i18n (Common.error.hookToaster)
    

## Критерии приёмки

1. В UI **нет** `{profileName}` / `{{profileName}}` — имя подставляется.
    
2. По проекту (src/**) не осталось видимых текстов, написанных напрямую в JSX (кроме одиночных символов-иконок и SVG).
    
3. Все placeholder/aria-label тоже через i18n.
