# CLAUDE.md

This file is the working specification for AI agents editing this vocabulary app.

## Project

VocabMaster is a pure frontend English vocabulary practice app.

- Entry point: `index.html`
- Styles: `style.css`
- Logic: `app.js`
- Data file: `vocab-data.json`
- No backend.
- No Supabase.
- No npm/build step.
- Data must stay local JSON plus browser `localStorage` cache.

## Current Product Rules

### Rebuild Mode

The existing vocabulary bank has been reset.

- `vocab-data.json` starts with `words: []`.
- New vocabulary should be rebuilt from uploaded images or manual entries.
- Do not restore old A-list words unless the user explicitly asks.

### Import Workflow From Images

When the user uploads vocabulary images:

Default image source folder:

- `C:\Users\AAFCT\Desktop\新增\圖片`

1. Read/OCR the image.
2. Extract each word with all visible information:
   - English word
   - Chinese meanings
   - part(s) of speech
   - English example(s)
   - Chinese translation(s) of examples, if visible
3. If any word, Chinese meaning, part of speech, English example, or Chinese example translation is unclear, flag it explicitly before writing. Do not guess unclear text into the vocabulary bank.
4. Show the extracted list to the user first.
5. Wait for user confirmation or corrections.
6. Only after confirmation, write entries into `vocab-data.json`.

Never add recognized image content directly without first showing the extracted list.

### Category Rule

Every word is categorized by the first letter of the English word.

Examples:

- `apple` -> `A`
- `commercial` -> `C`
- `zebra` -> `Z`

Implementation details:

- Groups are fixed A-Z categories.
- Group IDs use `letter-a`, `letter-b`, ..., `letter-z`.
- Group names use uppercase letters `A`, `B`, ..., `Z`.
- `groupId` must be derived automatically from `word`.
- Do not ask the user to pick a group for normal vocabulary.
- Do not create custom groups for image imports.
- If the word does not start with A-Z, use `groupId: null`.

### Data Schema

Use schema version 2.

```json
{
  "schemaVersion": 2,
  "words": [],
  "groups": [
    { "id": "letter-a", "name": "A", "createdAt": "2026-05-30" }
  ]
}
```

Each word keeps legacy flat fields for existing practice modes, plus structured fields for richer dictionary data.

```json
{
  "id": "generated-id",
  "word": "commercial",
  "definition": "商業的;商業廣告",
  "partOfSpeech": "adj.;n.",
  "example": "The commercial was shown on TV.",
  "senses": [
    {
      "partOfSpeech": "adj.",
      "definitions": ["商業的"],
      "examples": [
        {
          "en": "The commercial district is busy.",
          "zh": "商業區很繁忙。"
        }
      ]
    },
    {
      "partOfSpeech": "n.",
      "definitions": ["商業廣告"],
      "examples": [
        {
          "en": "I saw a commercial on TV.",
          "zh": "我在電視上看到一則廣告。"
        }
      ]
    }
  ],
  "groupId": "letter-c",
  "createdAt": "2026-05-30",
  "repetitions": 0,
  "easeFactor": 2.5,
  "interval": 1,
  "dueDate": "2026-05-30",
  "lastReviewed": null,
  "totalReviews": 0,
  "correctCount": 0
}
```

Rules:

- `definition` is the joined readable summary used by existing lists/quizzes.
- `partOfSpeech` is the joined readable summary, such as `adj.;n.`.
- `example` is the first or best example for backward compatibility.
- `senses` is the source of truth for multiple meanings, parts of speech, and examples.
- Keep meanings/examples tied to their sense. Do not store separate parallel arrays that lose the relationship.

## App Behavior

### Local Storage

- `KEY` should remain versioned, currently `vocabmaster_v2`.
- Legacy `vocabmaster_v1` cache is intentionally removed on load to prevent old words returning.
- Saving should write schema version 2 data.

### Letter Groups

- The app should normalize loaded/imported data so all words get the correct `groupId` from `word`.
- The app should always expose A-Z groups in `state.groups`.
- Manual add/edit should recalculate `groupId` after word changes.

### Manual Entry

Manual word entry should include:

- word
- Chinese definition
- part of speech
- example
- automatic first-letter category preview

The category is not manually selectable.

## Verification

After code/data edits:

- Validate `vocab-data.json` parses.
- Verify `words.length` and `groups.length`.
- Run JS syntax check if available:

```powershell
C:\Users\AAFCT\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check app.js
```
