# Decision log

## D11 — Content replacement without rewriting learning history (2026-10-17)

- Context: the user requested substantive concept learning rather than questions about spotting handout mistakes. Existing records refer to question IDs and answer keys.
- Options: delete old IDs; replace their meaning in place; issue replacement IDs and retain historical definitions.
- Decision: replace 58 active questions with authored concept/scenario questions using `-r2` IDs/families. Preserve their exact old definitions in `retiredQuestions` with `supersededBy`; exclude them from all new selections. Resolve old bookmarks to the active replacement. Keep backup schema/content version compatible and seed both generations into the private grading catalog.
- Rationale: deleting or repurposing IDs would invalidate backups or change the interpretation of already graded answers. Active totals remain 631 questions/144 concepts; retained definitions do not inflate those counts.
- Affected: authoring manuscripts, week JSON, catalog, practice/exam/history readers, content tests and DB catalog seeding.
- Review: compare all 58 historical definition hashes with the pre-change commit; validate backup/active-exam/result compatibility and bookmark removal. Semantic review is distinct from a schema test and does not establish official exam coverage.

## D10 — Bounded retention and explicit recovery (2026-10-17)

- Context: multiple devices may retry an uncertain write or continue after another device resets the account; storage and free-plan resources are finite.
- Options: whole-record last-write-wins; unbounded event history; bounded validated state with versioned intent and reset epochs.
- Decision: retain 3,000 attempts, 20 exam results, 128 idempotency receipts, 500 queued changes, at most 2 MiB state/normal request, 128 KiB exam request, 256 KiB field versions and 4 MiB local outbox. An account is limited to 120 successful RPC admissions per minute. Receipts preserve the originally accepted field versions. Old reset epochs, too-stale bases, incompatible stored data and permanent validation errors stop automatic sending while keeping exportable local data. Account deletion in managed Auth cascades only that account's application state and receipts; no automatic inactivity deletion or new account-deletion UI is introduced.
- Rationale: acknowledgment loss must not duplicate answers or turn an old intent into a fresh overwrite. Bounded history and receipts limit routine free-tier use; this is not a global DDoS or billing guarantee. Invalid transactions roll back, including their rate counter.
- Affected: database migrations 001–004, sync/outbox/session/storage, account/backup UI, regression tests.
- Review: reset versus offline queue, delayed receipt plus concurrent field change, duplicate IDs with altered contents, account switching, corrupt/quota/readback failures, full bounds. Guest data remains untouched; clearing site data removes unsent records. Historical managed-service backups may outlive row deletion according to the provider's retention policy.

## D09 — Managed sessions and browser compatibility (2026-10-17)

- Context: GitHub Pages and Neon Auth have different sites; some browser privacy policies reject cross-site session cookies. A successful password exchange is not sufficient proof of a usable browser session.
- Options: store an opaque session token in localStorage; disable browser protections; require a confirmed managed session and provide explicit failure/backup paths.
- Decision: keep managed HttpOnly cookies and the official SDK; never persist credentials in Web Storage or weaken privacy settings. A missing session after sign-in is reported as session/browser failure, not as an unverified email. Test Chromium, Firefox and WebKit separately and publish the verified limits. Shared SMTP uses the provider's free sender; test OTP fixtures do not demonstrate real mailbox delivery. Repeated operational tests are bounded and do not bypass managed rate limits.
- Rationale: insecure token persistence or a paid/domain/proxy service would violate the security or Neon-only/no-cost scope.
- Affected: cloud adapter, account UI, live and deterministic browser harnesses, verification notes.
- Review: final HTTPS deployment is tested separately from localhost. Physical iOS/Android devices and actual mail inbox delivery require separate evidence. Authentication metadata may include IP/user agent; the UI must not claim the provider stores only three application form fields.
- Result: Chromium/Firefox passed the public HTTPS flow; WebKit sign-in returned a user but the following session lookup was empty and no session cookie was stored. Keep this as a documented unsupported test environment, not a passed mobile claim. Add a visible compatibility notice. Supporting a new shared-domain/proxy arrangement would need a separately reviewed architecture change; this task does not add one.

## D08 — Narrow JWT initialization wrappers (2026-10-17)

- Context: real verified test accounts intermittently received `AUTH_REQUIRED` on the first Data API call. An isolated reproduction and the pg_session_jwt issue/source pointed to lazy initialization inside SECURITY DEFINER. The managed `auth` schema does not delegate USAGE to the SQL-created runtime roles.
- Options: weaken ownership checks; broaden schema/table access; initialize the verified identity in an invoker wrapper and retain restricted implementations.
- Decision: migrations 005–006 move the privileged RPC implementations to the private schema. Public SECURITY INVOKER wrappers first execute a SQL-standard, CREATE-time-bound `auth.user_id()` helper, then call the implementations. The authenticated role receives only schema USAGE and execution of the four entry implementations plus initializer, not table access or other helpers. The helper accepts no user ID; every implementation independently checks verified email and forced RLS.
- Rationale: this preserves managed JWT verification and ownership without client-supplied identity or broad managed-schema permissions. New migration 007 separately qualifies a table-function column whose ambiguous `id` join wrongly rejected every new exam when the catalog contained a retired row.
- Affected: database/005–007, PGlite cold-identity/retired-question tests, live two-account tests.
- Review: anonymous/cross-account/direct-table denial; alternating A/B JWTs on pooled connections; valid new exams with retired catalog rows and refusal to start an exam containing a retired question. Upstream evidence: https://github.com/neondatabase/pg_session_jwt/issues/51 and https://github.com/neondatabase/pg_session_jwt . The symptom and remediation were observed; no claim is made of rebuilding the provider's C extension.

## D07 — Deployment credentials and isolated operational tests (2026-10-17)

- Context: the user authorized a dedicated free Neon resource and secret use while absent. Migrations and real-account checks need a privileged connection that must never reach Pages, logs or source control.
- Options: plaintext env file; embedded browser connection string; short-lived child-process environment populated from a Windows user-encrypted external file.
- Decision: keep the credential only in a current-user DPAPI file outside the repository, use exact project-host allowlisting and TLS verification, and clear the child environment after each command. No plaintext env file, repository credential or Vercel resource is created. Operational tests create unique disposable example.com accounts and delete only their exact IDs/emails and verification identifiers; never inspect or modify existing learners' records. Controlled OTP values are kept in process memory and applied only to these fixtures, not to real users.
- Rationale: privileged deployment capability must be separated from the public browser application. Test fixtures exercise managed verification/recovery without reading the user's mailbox or leaking codes.
- Affected: tools/private-db.ps1, db-client/migrate and live-account-check, ignored output artifacts, deployment docs.
- Review: remove the task-created local credential after final verification; preserve migration files and sanitized evidence. Audit candidate commits for credential patterns without printing matches. This operational account-creation/deletion test is never an automatic CI step.

## D06 — Neon-only optional accounts and loss-aware sync (2026-10-17)

- Context: the user approved a no-cost automatic implementation session, preserving guest records and adding cross-device account progress only to this application. The user explicitly rejected the proposed Vercel API and instructed use of Neon managed browser authentication/data access instead.
- Options: separate Vercel backend; self-managed password service; GitHub Pages + Neon managed Auth + Data API + PostgreSQL transactions/RLS.
- Decision: retain GitHub Pages and use a new dedicated Neon Free project. Do not use Vercel, paid plans or the ranking database. Passwords and sessions belong to managed Auth, not custom SQL or browser storage. Use the official pinned SDK, locally bundled. Public endpoints are not credentials; DB/management secrets never enter dist, logs or Git. The user explicitly approved email + password on 2026-10-17 because the current managed plugin list does not expose username authentication. Require email verification; use the provider's shared verification-code/reset delivery within its free limits, without claiming production-scale mail delivery. No paid sender or domain is created.
- Rationale: this follows the latest requested boundary without exposing a privileged Postgres connection to browser code. A managed service replaces the custom auth server; row ownership and concurrency remain database responsibilities, not just frontend filters.
- Data policy: no real names, telephone numbers, analytics or ranking. The provider's required name field uses a fixed non-identifying label. Existing guest key remains untouched on login. Only confirmed import attaches guest data. Account queues are identity-bound; acknowledged DB state, not device time, controls synchronization. Bounded append-only attempts/read completion are merged; mutable fields use versions; reset changes epoch. Concurrent exams require an explicit writer transfer without resetting the deadline. Backups remain available.
- Affected: architecture.md, new database migrations/API contract, cloud adapters and pure sync domain, account UI, content revision/legacy handling, tests and build/CI scripts.
- Review: test anonymous/cross-account denial, forged IDs, stale/duplicate writes, connection loss and retry, account switching, storage failures, legacy backup preservation, exam takeover and deadline. Real browser/production tests are required separately from local mocks. Shared-origin GitHub Pages and cross-site-cookie limitations must be measured and disclosed, never called complete isolation. No credentials have been added to the repository.

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
