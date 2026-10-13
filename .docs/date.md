# Dates and Time

Read this guide before adding date fields, calendar logic, scheduling, retention windows, or timezone-sensitive behaviour. Ask before assuming a client timezone.

## The product day

A day is an `Asia/Shanghai` calendar day for every user. The database computes it with `public.app_today()`; the client uses `getBeijingDateKey()` in `shared/domain/dates.ts`. A day is writable only while it is today and not finalised; a scheduled job finalises past days. Do not derive the product day from the browser's local timezone.

## Choose the value shape

Distinguish a moment in time from a calendar date:

- `*At` is a timestamp representing an instant (for example `loggedAt`). Store it as a UTC ISO 8601 string or a Postgres `timestamptz`.
- A date key is a calendar date with no time or timezone. Store it as a validated `YYYY-MM-DD` string or a Postgres `date`.

Do not create a `Date` from a date-only string and then format it in another timezone; that can shift the displayed calendar day.

## Libraries and formatting

Use `Date` and `Intl`. Ask before adding a date library. Format dates at the presentation boundary with an explicit locale; `formatDateKey` and `formatMonthKey` own the calendar formats.

## Determinism and validation

Inject a clock into important logic rather than reading the current time throughout the implementation; tests use a fixed instant. Validate both the `YYYY-MM-DD` shape and the real calendar date. When a workflow compares dates or timestamps, document the timezone, inclusive or exclusive boundary, and what happens at the day boundary.
