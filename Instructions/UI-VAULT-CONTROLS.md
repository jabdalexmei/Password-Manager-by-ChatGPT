# ТЗ 2 — UI-VAULT-CONTROLS-02: исправить отображение кнопок/контролов (чистый layout как в демо)

## Цель

Сделать Vault визуально как на демо:

- нормальные кнопки (без “сломанных” классов)
    
- **нет белых дефолтных инпутов**
    
- **нет лишних кнопок Delete под карточкой в списке**
    
- кнопки в сайдбаре выглядят аккуратно и одинаково
    

## 1) Починить “secondary” кнопки

Сейчас в коде используется `btn btn-secondary`, но в `ui.css` **нет** `.btn-secondary`.

### Файл: `src/styles/ui.css`

Добавить стиль **(копия btn-ghost по смыслу)**:

```css
.btn-secondary {
  background: var(--color-surface-2);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btn-secondary:not(:disabled):hover {
  border-color: var(--color-primary);
}
```

## 2) Привести Toaster к существующим стилям

Сейчас:

- контейнер `.toast-container`, а в css ожидается `.toast-host`
    
- aria-label “Dismiss” захардкожен
    

### Файл: `src/components/Toaster.tsx`

Изменить:

- `toast-container` → `toast-host`
    
- кнопке закрытия дать класс `icon-button` (или `btn btn-ghost`, но лучше `icon-button`)
    
- aria-label взять из i18n Common
    

Минимально ожидаемая разметка:

```tsx
<div className="toast-host">
  {toasts.map(t => (
    <div className="toast" key={t.id}>
      <span>{t.message}</span>
      <button className="icon-button" aria-label={tCommon("aria.dismissToast")} onClick={...}>
        ×
      </button>
    </div>
  ))}
</div>
```

## 3) Убрать лишние кнопки в списке карточек (как на твоём плохом скрине)

### Файл: `src/features/Vault/components/DataCards/DataCards.tsx`

Удалить из `renderCard` блок:

```tsx
<div className="vault-card-actions"> ... </div>
```

Список карточек должен быть **только кликабельные строки**, без Delete/Restore/Purge под каждой.

## 4) Убрать “ломающие” кнопки из списка папок

(сейчас кнопки Restore/Purge/Delete вставлены прямо внутрь строки папки и ломают сетку)

### Файл: `src/features/Vault/components/Folders/Folders.tsx`

- Внутри `renderFolder` убрать блоки:
    
    - `<div className="vault-sidebar-actions"> ... </div>` (и для trash, и для обычного режима)
        

**Важно:** функциональность удаления/restore/purge папок не выкидываем — просто переносим на следующий шаг (контекстное меню или отдельная зона действий). В этом ТЗ задача именно “перестать ломать UI”.

## Критерии приёмки

1. В списке карточек **нет** кнопок под каждой карточкой.
    
2. В списке папок **нет** inline-кнопок внутри каждой строки.
    
3. `btn-secondary` выглядит нормально (не “без стилей”).
    
4. Тосты отображаются с текущими стилями `ui.css`.
