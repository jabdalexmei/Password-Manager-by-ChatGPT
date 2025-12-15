## Цель

Сделать **в точности такой UX**, как на демо-скринах (твои примеры “правильного UI”):

- модалка New/Edit card — по центру, аккуратная, единый стиль, поля в столбик
    
- модалка New folder — маленькая, по центру, Cancel/OK справа
    
- никаких `.modal-backdrop/.modal/.modal-actions` (их нет в css → отсюда белые инпуты)
    

## 0) Канон-рефактор: хуки без JSX

Сейчас у тебя:

- `useDataCards.tsx` возвращает JSX (`dialogs`)
    
- `useFolders.tsx` возвращает JSX (`dialogs`)
    

По канону это запрещено.

### Требование

- `useDataCards` и `useFolders` — **только state + handlers**, **без JSX**
    
- JSX модалок — в `DataCards.tsx` и `Folders.tsx`
    

### Файлы

1. Переименовать:
    

- `src/features/Vault/components/DataCards/useDataCards.tsx` → `.../useDataCards.ts`
    
- `src/features/Vault/components/Folders/useFolders.tsx` → `.../useFolders.ts`
    

2. Обновить импорты в:
    

- `src/features/Vault/Vault.tsx`
    
- `src/features/Vault/components/DataCards/DataCards.tsx`
    
- `src/features/Vault/components/Folders/Folders.tsx`
    

## 1) Создать единые dialog-классы (используем то, что уже есть)

В проекте уже есть:

- `.dialog-backdrop`
    
- `.dialog`
    
- `.dialog-actions`
    
- `.form-grid`, `.form-field`, `.form-label`, `.form-error`
    

### Требование

Все новые модалки должны рендериться так:

```tsx
<div className="dialog-backdrop">
  <div className="dialog dialog-wide">
    ...
  </div>
</div>
```

### Файл: `src/styles/ui.css`

Добавить ширину для “широкой” модалки карточки:

```css
.dialog-wide {
  width: min(640px, 100%);
}
```

И добавить шапку/крестик:

```css
.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dialog-close {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  color: var(--color-text);
  cursor: pointer;
}

.dialog-close:hover {
  border-color: var(--color-primary);
}
```

## 2) Модалка Create / Edit Data card (как на демо)

### Где реализовать

Файл: `src/features/Vault/components/DataCards/DataCards.tsx`

### Требование по полям (как на демо)

Форма вертикально (одна колонка), поля:

- Title (required)
    
- URL
    
- Username
    
- Email
    
- Mobile phone
    
- Password (рядом маленькая кнопка “generate”/иконка — можно сделать просто генерацию на фронте)
    
- Notes (textarea)
    
- Folder (select)
    
- Mark as favorite (checkbox)
    
- Tags (опционально, одной строкой `tag1, tag2`)
    

### Требования по поведению

- Create:
    
    - если `title.trim() === ""` → показать `.form-error` под Title, не закрывать
        
    - submit вызывает `onCreateCard(...)`
        
    - после успеха: закрыть, список обновится (у тебя это делает useVault)
        
- Edit:
    
    - prefill данными карточки
        
    - submit вызывает `onUpdateCard(...)`
        
    - после успеха: закрыть
        

### Техническое требование (mapping)

В UI используем camelCase модель, но при отправке в `useVault` у тебя уже есть `mapCreateCardToBackend/mapUpdateCardToBackend`.  
Поэтому из модалки передавать в `onCreateCard/onUpdateCard` строго `CreateDataCardInput/UpdateDataCardInput` как в `src/features/Vault/types/ui.ts`.

### Требование по разметке (обязательное)

Использовать **только** классы:

- `.dialog-backdrop`, `.dialog`, `.dialog-wide`
    
- `.form-grid`, `.form-field`, `.form-label`, `.form-error`
    
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-outline`
    
- `.icon-button` (если нужно для иконки генерации)
    

## 3) Модалка Create folder (как на демо)

### Где реализовать

Файл: `src/features/Vault/components/Folders/Folders.tsx`

### Вид

- Заголовок: “New folder”
    
- Подзаголовок/описание: “Organize your vault with folders.”
    
- Одно поле ввода “Folder name” с placeholder
    
- Кнопки справа: Cancel / OK
    

### Поведение

- если `name.trim() === ""` → показать `validation.folderNameRequired` под полем
    
- submit вызывает `onCreateFolder(trimmedName)`
    
- после успеха: закрыть
    

## 4) Полностью удалить использование старых modal-классов

Во всём `src/**`:

- запретить `modal-backdrop`, `modal`, `modal-actions`
    
- заменить на `dialog-backdrop`, `dialog`, `dialog-actions`
    

## Критерии приёмки

1. Create/Edit card открываются **как на демо**: по центру, нормальные поля, без белых дефолтных инпутов.
    
2. Create folder — маленькая модалка по центру как на демо.
    
3. `useDataCards` и `useFolders` не возвращают JSX.
    
4. В проекте больше нет классов `modal-*`.
