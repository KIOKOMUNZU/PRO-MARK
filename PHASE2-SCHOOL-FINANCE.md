# ZELIMU CBC — Phase 2: School Finance

## Included in this checkpoint

- A dedicated School Fees & Receipts workspace, separate from Platform Subscription Billing.
- Fee structure creation by academic year and class/stream.
- Idempotent assignment of a fee structure to active learners in the selected class.
- Recording of learner payments with generated receipt numbers, method/reference/date/notes.
- Allocation of payments against the learner's oldest outstanding charges; any excess is retained as unallocated credit rather than silently discarded.
- Outstanding-charge, payment and fee-structure lists; summary totals; printable receipt view.
- Tenant-bound API routes and school/user checks for finance writes.
- Audit-log events for fee-structure creation and payment recording.

## Database migration required

Apply `database/028_school_finance_core.sql` manually to the intended ZELIMU CBC database after taking a verified backup. The server does not automatically apply this migration. If the migration has not been applied, the Finance workspace reports that the schema is missing.

## Current limitations (not yet implemented)

- M-Pesa is currently a manually recorded payment method, not a live Daraja/STK Push integration or automated reconciliation.
- Bank transfers are manually recorded; there is no bank feed integration.
- Payment reversal/void workflow and controlled receipt cancellation need a separate audited workflow before use in a live accounting environment.
- Payroll is not part of this phase.
- SMS fee reminders and parent-facing balances are not yet connected to this ledger.
- The first version supports KES only to prevent cross-currency payment allocation errors.
- The first version is intended for school finance staff with `SCHOOL_ADMIN` or `ADMIN` access; dedicated finance-staff roles and granular permissions remain future work.
- No live database was accessed or changed during this build.

## Checks run

- `node --check backend/routes/finance.js`
- `node --check backend/server.js`
- Inline dashboard JavaScript syntax check
- `npm run check`

Run the migration on staging first, verify tenant boundaries and payment allocation, then deploy the same reviewed migration and code to production.
