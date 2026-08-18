# Test Series (v1 — paper builder)

Campus LMS module: assemble papers from Question Bank. No student attempts yet.

## Ownership (read before changing middleware)

**The series is the ownership unit.** `TestSeries.createdById` owns every paper under that series. Papers do **not** store a creator.

| Actor | Create series | Add/edit papers on own DRAFT series | Add papers on another teacher’s series | Publish / archive |
|-------|---------------|-------------------------------------|----------------------------------------|-------------------|
| Teacher (toggle on) | Yes | Yes | No (403) | No |
| Admin / Staff | Yes | Yes (any series) | Yes | Yes |

### Admin drafts a paper on a teacher’s series

If an admin creates a DRAFT paper on Teacher A’s series, **Teacher A can edit it**. That is not a bug: edit rights follow series ownership, not who inserted the paper row.

Do not add `paper.createdById` checks without an explicit product decision to support multi-teacher co-authoring.

## Settings

`TenantTestSeriesSetting.allowTeachersToCreateTestSeries` — separate from Question Bank’s `allowTeachersToAddQuestions`.

## Related code

- Permission gates: `testSeries.middleware.ts` (source of truth for the rules above)
- Routes: `testSeries.routes.ts`
- Bank consumption + usage log: `testSeries.service.ts` → `logUsage(..., TEST_SERIES, paperId)`
