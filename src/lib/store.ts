import * as SQLite from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import type { Bill } from './types';

const db = SQLite.openDatabaseSync('due.db');
db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    due_date TEXT,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS bills_status_due ON bills (status, due_date);
`);

let snapshot: Bill[] = load();
const listeners = new Set<() => void>();

function load(): Bill[] {
  return db
    .getAllSync<{ data: string }>('SELECT data FROM bills ORDER BY due_date IS NULL, due_date')
    .map((r) => JSON.parse(r.data) as Bill);
}

function changed() {
  snapshot = load();
  listeners.forEach((l) => l());
}

export function saveBill(bill: Bill) {
  db.runSync('INSERT OR REPLACE INTO bills (id, status, due_date, data) VALUES (?, ?, ?, ?)', [
    bill.id,
    bill.status,
    bill.dueDate,
    JSON.stringify(bill),
  ]);
  changed();
}

export function deleteBill(id: string) {
  db.runSync('DELETE FROM bills WHERE id = ?', [id]);
  changed();
}

export function getBills(): Bill[] {
  return snapshot;
}

export function getBill(id: string): Bill | undefined {
  return snapshot.find((b) => b.id === id);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** All bills, open ones ordered by due date. Re-renders on every write. */
export function useBills(): Bill[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function useBill(id: string | undefined): Bill | undefined {
  const bills = useBills();
  return bills.find((b) => b.id === id);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Re-files bills stuck in "other" whose biller now has a known category (keywords or an earlier choice). */
export function recategorizeOthers(guess: (b: Bill) => Bill['category']) {
  for (const b of snapshot.filter((x) => x.category === 'other')) {
    const c = guess(b);
    if (c !== 'other') saveBill({ ...b, category: c });
  }
}
