# UI Component Rules

## Design Principle
Personara.ai should feel calm, intelligent, premium, and human. Avoid clutter.

## UI Rules
- Reuse existing components before creating new ones.
- Use Tailwind consistently.
- Keep mobile layouts clean.
- Avoid dense walls of text.
- Prefer cards, sections, and progressive disclosure.
- Use consistent spacing and rounded corners.
- Preserve existing visual language unless task requests redesign.

## Page Structure Preference
Use:

```tsx
<main>
  <section>
    <header />
    <content />
  </section>
</main>
```

## Component Naming
Use descriptive names:

```txt
StrengthsRadar.tsx
CareerAssetCard.tsx
TeamScenarioRunner.tsx
PersonaPreviewPanel.tsx
```

Avoid vague names:

```txt
Card2.tsx
NewThing.tsx
Widget.tsx
```

## AI Output UI
When displaying AI-generated results:
- Show a loading state.
- Show errors clearly.
- Provide copy/export actions where useful.
- Do not dump raw JSON unless in admin/debug mode.
