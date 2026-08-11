# RPG save backup and recovery runbook

## Scope and ownership

This runbook covers the SQLite deployment of `echoes-at-dawn`. The on-call
operator owns backup and diagnosis; the release owner approves migration and
rollback; a product/support owner must approve recovery of an individual
player slot. Never edit `save_json` by hand.

- RPO: at most 24 hours for database loss; each successful overwrite also keeps
  server-side slot history.
- RTO: 60 minutes for database rollback, 15 minutes for one-slot history
  restore after the affected account is identified.
- Retention: keep daily encrypted database backups for 14 days. Autosave history
  keeps 10 prior revisions, manual slots keep 3, and idempotency operations keep
  at most 128 entries and 7 days per slot.

The commands below deliberately require explicit paths and identifiers. Run
them from the repository root on the host that owns the single SQLite writer.

## Consistent SQLite backup (including WAL)

1. Declare unique, explicit paths and reject unsafe values.

   ```bash
   export RPG_DB_PATH=/srv/hono-standard/data/sqlite.db
   export RPG_BACKUP_PATH=/srv/hono-standard/backups/sqlite-2026-08-11T140000Z.db
   test -f "$RPG_DB_PATH"
   test -n "$RPG_BACKUP_PATH" && test ! -e "$RPG_BACKUP_PATH"
   ```

2. Use SQLite's online backup operation. Do not copy only the main file while
   the application is running; committed data may still be in `-wal`.

   ```bash
   sqlite3 "$RPG_DB_PATH" ".timeout 10000" ".backup '$RPG_BACKUP_PATH'"
   sqlite3 -readonly "$RPG_BACKUP_PATH" "PRAGMA integrity_check;"
   ```

   The integrity result must be exactly `ok`. Encrypt and transfer the backup
   using the deployment platform's approved storage mechanism, then record its
   checksum, creation time, source release, and migration version.

## Migration rehearsal and rollout

1. Take and verify the online backup above.
2. Rehearse every pending migration on a separate file:

   ```bash
   export RPG_REHEARSAL_DB=/srv/hono-standard/rehearsal/sqlite-pre-release.db
   test -n "$RPG_REHEARSAL_DB" && test ! -e "$RPG_REHEARSAL_DB"
   cp "$RPG_BACKUP_PATH" "$RPG_REHEARSAL_DB"
   DATABASE_URL="$RPG_REHEARSAL_DB" bun run db:migrate
   sqlite3 -readonly "$RPG_REHEARSAL_DB" "PRAGMA integrity_check; PRAGMA foreign_key_check;"
   ```

3. Verify `game_saves`, `game_save_versions`, and `game_save_operations` counts
   and execute `bun run verify` against the release revision.
4. Stop accepting writes, set `DATABASE_URL` to the production file, run
   `bun run db:migrate`, start the application, and exercise load plus a test
   account save.
5. Roll back the application and restore the verified backup when migration
   fails, integrity/foreign-key checks return rows, or the smoke save cannot be
   loaded. Never run a down-migration against the only production copy.

## Read-only diagnosis for one slot

Set all identifiers explicitly. The 2D game ID is `echoes-at-dawn`; allowed
slots are `autosave`, `manual-1`, `manual-2`, and `manual-3`.

```bash
export RPG_DB_PATH=/srv/hono-standard/data/sqlite.db
export RPG_USER_ID=replace-with-user-uuid
export RPG_GAME_ID=echoes-at-dawn
export RPG_SLOT_ID=autosave
test -f "$RPG_DB_PATH" && test -n "$RPG_USER_ID" && test -n "$RPG_GAME_ID" && test -n "$RPG_SLOT_ID"
case "$RPG_USER_ID" in (*[!0-9A-Fa-f-]*|'') echo "invalid RPG_USER_ID" >&2; exit 2;; esac
test "$RPG_GAME_ID" = echoes-at-dawn
case "$RPG_SLOT_ID" in (autosave|manual-1|manual-2|manual-3) :;; (*) echo "invalid RPG_SLOT_ID" >&2; exit 2;; esac
sqlite3 -readonly -header -column "$RPG_DB_PATH" \
  "SELECT slot_id, revision, content_version, state_revision, saved_at, updated_at FROM game_saves WHERE user_id = '$RPG_USER_ID' AND game_id = '$RPG_GAME_ID' AND slot_id = '$RPG_SLOT_ID';"
sqlite3 -readonly -header -column "$RPG_DB_PATH" \
  "SELECT revision, content_version, state_revision, saved_at, checksum, created_at FROM game_save_versions WHERE user_id = '$RPG_USER_ID' AND game_id = '$RPG_GAME_ID' AND slot_id = '$RPG_SLOT_ID' ORDER BY revision DESC;"
sqlite3 -readonly -header -column "$RPG_DB_PATH" \
  "SELECT result_revision, idempotency_key, created_at FROM game_save_operations WHERE user_id = '$RPG_USER_ID' AND game_id = '$RPG_GAME_ID' AND slot_id = '$RPG_SLOT_ID' ORDER BY created_at DESC;"
```

Use an internal user UUID, never an email, in tickets and diagnostic output.
Do not print `save_json` or `result_save_json` into logs.

## Restore a verified historical revision

The normal path is player-visible recovery: a corrupt current save causes the
load endpoint to return the newest checksum-verified compatible history record;
the launcher shows **Restore checkpoint**. Selecting it performs an
optimistic-concurrency restore and retains the corrupt revision in history.

For an operator-assisted restore, first obtain the current and source revision
with the read-only queries, have the player sign in, and issue the authenticated
endpoint in that session:

```text
POST /api/games/echoes-at-dawn/saves/{slot}/history/{sourceRevision}/restore
{
  "protocolVersion": 2,
  "expectedRevision": {currentRevision},
  "idempotencyKey": "{new UUID}"
}
```

A `409` means the slot changed after diagnosis. Stop and inspect the latest
revision; do not retry with a changed expected revision without renewed
approval. After success, load the slot and confirm the returned revision and
checkpoint metadata. Preserve the pre-restore backup until the incident closes.

## Retention and corruption checks

For one explicit slot, verify the intended bounds with the read-only queries:

- `game_save_versions`: no more than 10 autosave or 3 manual rows after a new
  write triggers pruning.
- `game_save_operations`: no more than 128 rows and no rows older than 7 days
  after a new write triggers pruning.
- A 64-character history checksum is verified by the service before automatic
  recovery. `legacy:` backfill checksums are migratable history and are decoded
  and content-checked, but do not claim cryptographic verification.

## Content mismatch and deploy rollback

If a save is structurally valid but references missing maps, entrances, actors,
items, abilities, or encounters, do not modify the save. Compare the deployed
server content under `web/public/game-content` (or the matching `dist-web`
artifact) with the web release. Roll back server and web to the last artifact
that contains the save's `contentVersion`, or deploy a forward-compatible
content bundle. Re-run `bun run validate:game-content` before restoring traffic.

## Correlation IDs

Player-facing fatal runtime messages show IDs shaped like `rpg-001122aabbcc`.
Match that exact ID against the browser development collector or the configured
production diagnostics adapter. Diagnostic records contain only event code,
time buckets, session/revision/map identifiers, and bounded counters. They must
not contain email, token, cookie, save JSON, inventory/story flags, or dialogue.
Failure of diagnostics collection must never block save recovery.
