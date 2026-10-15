# Decision log

## D05 — Compare explanations and distinguish instructor confirmation (2026-10-15)

- Context: the user requested both handout and corrected explanations, supporting evidence, and a separate indicator when the actual exam answer needs instructor confirmation. Earlier wording could conflate app scoring exclusions with the real exam.
- Options: show corrected-only notices; mark every older statement as an error; present the evidence ledger with separate technical and exam judgments.
- Decision: reuse all 149 reviewed records, add source-specific summary/rationale metadata for six directly rechecked conflicts, and use one shared comparison component in scope, lessons, graded practice and exam results. Verified technical changes and unsubstantiated app exclusions are marked pending instructor confirmation (81 records); context records show version/condition guidance (68 records) with conditional confirmation. No instructor approval is inferred or fabricated. Search/filter is page-local UI state and is not added to browser persistence. A wrong handout statement is never made the app's answer key.
- Rationale: learners need to understand the discrepancy without mistaking technical verification for the instructor's grading policy. This is additive within the existing static content/domain/view architecture.
- Affected: `dist/src/domain/corrections.js`, shared comparison view, scope/lesson/practice views, optional validated content fields, canonical authoring supplement, comparison and browser tests.
- Follow-up review: add an actual dated instructor response only when supplied; do not promote the current pending labels to confirmed. No instructor message is sent by this change. No new account, DB, data-retention policy or storage key is introduced.

## D01 — Independent learning application (2026-10-15)

- Context: user approved the whole proposed app, full midterm/final coverage, verified corrections, guided understanding, tests, GitHub Pages and WEB LAB integration.
- Options: quiz-only catalog; merge into engineer-practice; independent guided local-first application.
- Decision: independent internet-security-study repository, structured JSON content, concept/example/check/practice/review progression, 60-minute mock exams and fictional incident cases. No DB, accounts, analytics, public ranking or original PDF redistribution. Use localStorage behind a bounded repository because the single bounded JSON state enables deterministic validation, backups and simple transparent failure; IndexedDB/cloud sync are deferred.
- Rationale: preserves existing independent static-app architecture and minimizes user data while supporting requested learning.
- Affected: architecture.md, dist/, test/, tools/, content contract, future WEB LAB catalog entry.
- Review: assert full page/topic mapping, correct answers, storage isolation, backup rejection, accessibility, Windows/Linux tests, local and live browser checks. Browser-local records are not private from other code on the same GitHub Pages origin.

## D02 — Source fidelity and corrections (2026-10-15)

- Context: the handouts include contradictory signature-key descriptions, old OS/protocol examples and overgeneralized security statements.
- Options: repeat handout verbatim; silently modernize; explain corrections with page-level primary evidence and context labels.
- Decision: original paraphrased learning content, explicit correction ledger, version-specific teaching, unresolved disputed assertions excluded from scored questions. Every instructional topic links to explanation and questions. Actual exam format/count remains unconfirmed; UI labels the 30-question preset as practice.
- Rationale: exam alignment must not reinforce known falsehoods; question count alone cannot establish coverage or exam success.
- Affected: dist/content/, docs/content-contract.md, curriculum validation and source/coverage views.
- Review: no live AI generation of unreviewed answers. Source/page validation and manual semantic review are distinct from automated runtime tests.

## D03 — Guided connections and fair assessment (2026-10-15)

- Context: a bank of independent questions alone would not satisfy the requested learning identity. Unrelated distractors can reward surface elimination instead of understanding.
- Options: locked linear lessons; scores/lives; optional concept paths with complete week access.
- Decision: six question-led pathways, explicit prerequisite links, four-stage lessons, 14/12-question starting-point practice (two per week), uncertainty-aware review. Every full-scope mock balances weeks and uses stable option IDs; it does not claim official exam weighting. Peer-review weak distractors into plausible neighboring misconceptions.
- Rationale: let learners find a starting point and explain causes without restricting access or conflating a brief diagnostic with full coverage.
- Affected: domain/pathways.js, views/learn.js, app.js, content authoring and peer-review records, pathways tests.
- Review: validate links/cycle freedom, 600 seeded full-scope selections, actual browser lesson/diagnostic flows. Educational effectiveness in real students is not established by software tests.

## D04 — Explicit recovery and honest write outcomes (2026-10-15)

- Context: adversarial tests reproduced a one-shot readback failure after a successful replacement, unusable corrupt-record recovery, and sparse arrays that serialized to invalid records. Browser tests also reproduced an obsolete slow file selection replacing the newer choice.
- Options: silently reset; automatic rollback writes; readback retry with explicit uncertainty and user-confirmed recovery.
- Decision: strict dense-array and serialized round-trip validation before writes; one readback retry; unknown post-write outcome gets a distinct visible warning and retains prior raw bytes for export. Never rollback over a possibly newer tab. A validated, confirmed restore may replace an unchanged readable corrupt baseline; no automatic writes are enabled by corrupt load. File-selection generations discard stale async completions.
- Rationale: preserve recovery choices without claiming localStorage transactions or guaranteed persistence when the browser fails.
- Affected: architecture.md, storage.js, domain/backup.js, app.js, records view, adversarial/browser regressions.
- Review: confirmed restore, invalid data preservation, quota/read denial, permanent readback failure and intervening tab changes. Original bytes retained in memory disappear when the tab closes, so the warning requests export before reload.
