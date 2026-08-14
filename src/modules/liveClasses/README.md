# Live Classes (v1)

One-off scheduled sessions with a manual join URL.

## Ownership

| Field | Meaning |
|-------|---------|
| `createdById` | Who drafted the session (edit/delete drafts) |
| `hostTeacherId` | Who hosts (defaults to creator; admin may assign another teacher) |

## Status

Stored: `DRAFT | PUBLISHED | CANCELLED`  
Computed when published: `UPCOMING | LIVE | ENDED` from `now` vs `startsAt`/`endsAt`.

## Publish rules

Requires title, meeting URL, and class. Students/parents only see **PUBLISHED** sessions for their class (and section if set).

## Settings

`TenantLiveClassesSetting.allowTeachersToCreateLiveClasses`
