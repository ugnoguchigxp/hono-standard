#!/bin/sh
set -eu

# The one-shot Compose service prepares the bind mount for the app's fixed UID.
# Only the directory and SQLite's own files need different ownership.
chown 10001:10001 /data
for file in /data/sqlite.db /data/sqlite.db-shm /data/sqlite.db-wal; do
	if [ -e "$file" ]; then
		chown -h 10001:10001 "$file"
	fi
done
