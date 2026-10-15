# Content contract v1

## Correction comparisons and exam uncertainty

Every correction is displayed with the handout explanation/issue summary, `corrected`, primary references, and the app's `examGuidance`. These are paraphrased reviews, not verbatim original PDFs or instructor-approved answers. A correction may additionally contain paired `handoutExplanation` and `verificationReason` strings; either both must be valid text or both omitted. `tools/authoring/correction-comparisons.mjs` is the canonical source of the six detailed, page-rechecked examples and supplements the existing part-1/3/4 manuscripts during serialization.

Pure domain policy in `corrections.js` labels verified technical corrections and excluded/unsubstantiated claims as requiring instructor confirmation of the actual exam. Contextualized records are conditional on the question's stated version/conditions; missing or conflicting conditions require confirmation. All actual exam answer keys remain unconfirmed. `excluded` means excluded from this app's scoring only, never promised to be excluded from the real examination. The UI must show these distinctions together, support source/verification text search, and make the same comparison available in lessons and graded feedback, but not during an active mock exam.

Each dist/content/week-NN.json is a JSON object:

```json
{
  "schemaVersion": 1,
  "id": "w01",
  "number": 1,
  "exam": "midterm",
  "title": "보안의 목적과 네트워크",
  "overview": "This week's connecting idea, in Korean.",
  "source": { "filename": "[교안]인터넷보안_01.pdf", "pages": 15 },
  "objectives": [{
    "id": "w01-cia", "title": "보호할 성질부터 고르기", "pages": [4, 7],
    "why": "A concrete motivating problem, not a slogan.",
    "explanation": ["At least two original explanatory paragraphs."],
    "keyTakeaway": "One reusable rule with limitations.",
    "comparison": [{ "term": "기밀성", "meaning": "Meaning", "example": "Concrete example" }],
    "workedExample": { "situation": "Concrete problem", "steps": ["Reasoning step", "Another reasoning step"], "answer": "Conclusion" },
    "commonMistakes": ["A misconception and why it fails."],
    "check": { "prompt": "Explain/predict before revealing", "answer": "Reasoned answer" },
    "prerequisites": [], "correctionIds": []
  }],
  "questions": [{
    "id": "w01-q001", "objectiveId": "w01-cia", "family": "w01-cia-availability-scenario",
    "kind": "application", "difficulty": 2,
    "prompt": "Original unambiguous question", "context": "Optional plain text logs/code/table",
    "options": [{ "id": "a", "text": "First option", "explanation": "Why this option is right or wrong" }, { "id": "b", "text": "Second option", "explanation": "Reason" }, { "id": "c", "text": "Third option", "explanation": "Reason" }, { "id": "d", "text": "Fourth option", "explanation": "Reason" }],
    "answerId": "a", "explanation": "Reasoned conclusion, not just repeat option",
    "sourcePages": [7]
  }],
  "coverage": [{ "pages": [1], "topic": "Learning goals and formative quiz", "objectiveIds": ["w01-cia"], "status": "covered", "note": "Optional qualification" }],
  "corrections": [{ "id": "w01-correction-01", "pages": [3], "issue": "Specific handout conflict", "corrected": "Accurate explanation", "examGuidance": "How course learning treats this issue without learning an error", "status": "verified", "references": [{ "title": "Primary source", "url": "https://example.org/actual-verified-source" }] }],
  "references": [{ "title": "Primary supporting reference", "url": "https://example.org/actual-verified-source" }]
}
```

IDs use lowercase ASCII letters/digits/hyphens. Exam is midterm or final. Question kind is concept, contrast, application or evidence; difficulty is 1, 2 or 3. Exactly four distinct options and one answer. Family groups genuinely similar variants; do not assign the same family to every question on a concept. Each objective has >=3 independently reasoned questions. Coverage includes every PDF page; status covered, historical, administrative or blank. Teaching/historical entries need objectiveIds. Corrections status verified, contextualized or excluded. Excluded issues must not become questionable scored assertions.

Write complete Korean explanations (why, causal model, example, limits), not extracted paragraphs or label lists. All questions need distractor-specific reasoning. Do not inflate counts with option permutations or cosmetic variants. Avoid universal assertions about old versions. Do not copy attack payloads as functioning code or include real targets. Context is rendered as text only.

Target allocation: w01 35, w02 65, w03 45, w04 40, w05 45, w06 50, w07 50; w09 55, w10 35, w11 35, w12 55, w13 45, w14 45 = 600. These are authoring goals, not official exam weights. If substantive coverage requires more, add real questions. Complete all major subsections; do not reduce scope to hit a count.
