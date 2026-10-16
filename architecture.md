# Internet Security Study architecture

## Purpose and authority

Independent Korean learning-support application, published at /internet-security-study/ on GitHub Pages. The approved scope is the supplied Internet Security weeks 1–7 (midterm) and 9–14 (final). Teach concepts progressively before exercises, review, incident cases and 60-minute mock exams. Actual question count/type and grading are unconfirmed; 30 single-choice questions is a labelled practice preset, not an official exam prediction. The 2026-10-17 user-approved extension adds optional account synchronization using Neon only; GitHub Pages remains the frontend host. Vercel, the shared ranking backend and other applications are out of scope.

## Layers

- dist/content/week-NN.json: original Korean learning objectives, explanations, worked examples, checks, reviewed multiple-choice questions, page-level coverage and correction evidence. No original handout PDFs/images are published.
- dist/src/domain/: pure curriculum validation, deterministic selection, grading, review scheduling, exam lifecycle and backup validation. No DOM, storage or network access.
- dist/src/storage.js: the app-specific localStorage repository; strict bounds/schema, readback, no silent overwrites of malformed/newer records, revision/conflict checking and user-visible failure. Public shared-origin storage is not a confidentiality boundary. Do not write WEB LAB's shared progress key.
- dist/src/app.js and views/: DOM presentation and orchestration only; use domain APIs for decisions and storage adapters for persistence. No innerHTML for content/user input, eval, external attack execution, analytics or public ranking.
- dist/src/cloud/: optional Neon Auth and Data API adapters and account-bound synchronization orchestration. Bundle the pinned official SDK locally; browser-delivered configuration contains public HTTPS endpoints only. Never deliver Postgres credentials, Neon management keys or password hashes to the browser. Auth tokens are not written to Web Storage by application code.
- database/: versioned PostgreSQL migrations, restricted RPC entry points and private application tables. Neon validates user JWTs; PostgreSQL enforces ownership, bounds, concurrency, idempotency and reset epochs. Controllers/views have no SQL or direct privileged connection. No unauthenticated access to learning records. RLS is enabled and forced; public table writes and public function execution are explicitly revoked except documented authenticated entry points.
- dist/styles.css / index.html / assets/: accessible responsive learning interface, original code-native illustrations. Self-hosted only.
- tools/ and test/: local verification, loopback-only dist server, content/logic regression tests; never deployed.
- .github/workflows/pages.yml: Windows and Linux verification, deployment of dist only after successful checks. Official actions pinned by SHA. No secrets in code/output.

## Learning and state policy

Concept reading alone is not mastery. Independent correct attempts, confidence and delayed practice inform review; guesses/hints never imply secure mastery. Repeated delivery of the same attempt must be idempotent. Records are bounded and explicitly exportable/deletable. Guest mode retains the existing local-only repository unchanged. Account mode uses acknowledged database state plus an account-bound local queue; local writes are not described as remotely saved. Existing guest records are never automatically attached to an account or deleted on login. Import requires explicit confirmation. Unsupported/malformed backups are rejected before mutation. Restore requires confirmation and an unchanged readable baseline; this explicitly approved replacement may recover corrupt JSON, while automatic writes remain blocked. Validation or pre-write failures preserve the old bytes. A write whose readback fails is retried once; an unrecoverable readback is explicitly uncertain, never reported as a successful save or guaranteed rollback. Keep the prior bytes exportable in memory and do not overwrite possible other-tab writes to attempt recovery. Multiple tabs use revision checks; no claim of atomic cross-tab localStorage transactions. A storage failure allows memory-only study with a clear notice.

Cloud sync merges append-only attempts and read completion, uses per-field versions for mutable bookmarks/settings, and rejects stale epochs after reset. Device clock is not an authority for conflict resolution. Conflicting intent remains exportable and requires a visible resolution; it is not silently discarded. Same-account mock exams have one active writer and explicit takeover; deadlines are preserved. Logout/account changes never route another account's pending writes to the new identity. All learning content remains usable without an account or when Neon is unavailable. Free-plan exhaustion must fail visibly without upgrading or billing.

Mock exams preserve generated order/option IDs and original deadline on reload; time never resets on navigation. No explanations until submission/timeout. Exact 1–7/9–14 filters and unique question families. The learner may study any concept without unlocking games or losing lives. Incident activities use fictional data only.

## Content truth and coverage

Track every supplied page in coverage entries (teaching, summary, historical or blank/administrative). Substantive topics link to objectives and questions; non-teaching pages have explicit reasons. Verify conflicting technical claims with primary references. Distinguish verified correction, historical/version context and unresolved/excluded claims. Never teach a known error as fact or count an unresolved claim as a correct answer. Modern supplementary context is labelled separately from course scope.

## Encoding

UTF-8 without BOM, CRLF text as declared in .gitattributes. The pinned Neon SDK is the only new browser runtime integration and is self-hosted in a reproducible bundle. The gallery is a separate repository and is not changed by this account-sync task.
