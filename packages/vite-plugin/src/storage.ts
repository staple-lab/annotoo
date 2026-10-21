import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export type Author = { id: string; name: string };
type Reply = { id: string; body: string; author: Author; createdAt: number };
type ThreadEvent = { id: string; type: 'resolved' | 'reopened' | 'assigned' | 'unassigned'; author: Author; createdAt: number; assignee?: Author };
export type Thread = {
  id: string; n: number;
  anchor: { selector: string; textSnippet: string; offset: { x: number; y: number } };
  title?: string; body: string; category?: 'note' | 'interaction' | 'content' | 'accessibility' | 'development';
  createdAt: number; updatedAt?: number; route?: string; author?: Author; updatedBy?: Author; assignee?: Author;
  replies?: Reply[]; status?: 'open' | 'resolved'; resolvedAt?: number; resolvedBy?: Author; events?: ThreadEvent[];
};
type RecordFile = { schemaVersion: 1; project: string; thread: Thread; deleted?: true };
export type Snapshot = { annotations: Thread[]; deletedIds: string[]; revision: string; records: Map<string, RecordFile> };
export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const CATEGORIES = new Set(['note', 'interaction', 'content', 'accessibility', 'development']);
const MAX_THREADS = 10000;
const MAX_REPLIES = 1000;
const MAX_EVENTS = 2000;
const IDENTITY_GUIDANCE = 'Set your Git identity in this repository with git config user.name "Your name" and git config user.email "you@example.com", then retry. Your email is used only to derive a stable author ID.';

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError(400, `${label} must be an object`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number, empty = true): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || value.includes('\0')) {
    throw new RequestError(400, `${label} must be ${empty ? 'a' : 'a nonempty'} string of at most ${max} characters`);
  }
  return value;
}
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ID.test(value)) throw new RequestError(400, `${label} must use 1–128 letters, numbers, underscores or hyphens`);
  return value;
}
function timestamp(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 8640000000000000) throw new RequestError(400, `${label} must be a valid nonnegative JavaScript Date timestamp`);
  return value;
}
function author(value: unknown, label: string): Author {
  const a = object(value, label);
  return { id: text(a.id, `${label}.id`, 200, false), name: text(a.name, `${label}.name`, 200, false) };
}
function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new RequestError(400, `${label} must be an array with at most ${max} entries`);
  return value;
}

/** Strict domain validation also bounds everything that eventually reaches a filename or HTML snapshot. */
export function validateThreads(value: unknown, stored = false): Thread[] {
  const threads = list(value, 'annotations', MAX_THREADS).map((entry, index): Thread => {
    const a = object(entry, `annotation ${index + 1}`);
    const anchor = object(a.anchor, 'anchor');
    const offset = object(anchor.offset, 'anchor.offset');
    if (typeof a.n !== 'number' || !Number.isSafeInteger(a.n) || a.n < 1) throw new RequestError(400, 'n must be a positive safe integer');
    if (typeof offset.x !== 'number' || typeof offset.y !== 'number' || !Number.isFinite(offset.x) || !Number.isFinite(offset.y) || offset.x < 0 || offset.x > 1 || offset.y < 0 || offset.y > 1) {
      throw new RequestError(400, 'anchor.offset coordinates must be finite numbers between 0 and 1');
    }
    if (a.category !== undefined && (typeof a.category !== 'string' || !CATEGORIES.has(a.category))) throw new RequestError(400, 'Unknown annotation category');
    if (a.status !== undefined && a.status !== 'open' && a.status !== 'resolved') throw new RequestError(400, 'Thread status must be open or resolved');
    const thread: Thread = {
      // Older public APIs allowed arbitrary string IDs. They remain readable/editable;
      // unsafe filename characters are hashed and only newly created IDs use ID above.
      id: text(a.id, 'Thread ID', 512, false), n: a.n,
      anchor: { selector: text(anchor.selector, 'anchor.selector', 2048, false), textSnippet: text(anchor.textSnippet, 'anchor.textSnippet', 500), offset: { x: offset.x, y: offset.y } },
      body: text(a.body, 'body', 20000), createdAt: timestamp(a.createdAt, 'createdAt'),
    };
    if (a.title !== undefined) thread.title = text(a.title, 'title', 200);
    if (a.route !== undefined) thread.route = text(a.route, 'route', 2048);
    if (a.category !== undefined) thread.category = a.category as Thread['category'];
    if (a.status !== undefined) thread.status = a.status;
    if (a.assignee !== undefined && a.assignee !== null) {
      thread.assignee = stored ? author(a.assignee, 'assignee') : { id: text(object(a.assignee, 'assignee').id, 'assignee.id', 200, false), name: '' };
    }
    if (a.replies !== undefined) {
      thread.replies = list(a.replies, 'replies', MAX_REPLIES).map((entry): Reply => {
        const reply = object(entry, 'reply');
        return {
          id: id(reply.id, 'Reply ID'), body: text(reply.body, 'reply.body', 20000, false),
          // Untrusted attribution is discarded before mutation; saved attribution is validated on reads.
          author: stored ? author(reply.author, 'reply.author') : { id: '', name: '' },
          createdAt: stored ? timestamp(reply.createdAt, 'reply.createdAt') : 0,
        };
      });
      if (new Set(thread.replies.map((r) => r.id)).size !== thread.replies.length) throw new RequestError(400, 'Reply IDs must be unique within a thread');
    }
    if (stored) {
      if (a.author !== undefined) thread.author = author(a.author, 'author');
      if (a.updatedBy !== undefined) thread.updatedBy = author(a.updatedBy, 'updatedBy');
      if (a.resolvedBy !== undefined) thread.resolvedBy = author(a.resolvedBy, 'resolvedBy');
      if (a.updatedAt !== undefined) thread.updatedAt = timestamp(a.updatedAt, 'updatedAt');
      if (a.resolvedAt !== undefined) thread.resolvedAt = timestamp(a.resolvedAt, 'resolvedAt');
      if (a.events !== undefined) thread.events = list(a.events, 'events', MAX_EVENTS).map((entry): ThreadEvent => {
        const event = object(entry, 'event');
        if (event.type !== 'resolved' && event.type !== 'reopened' && event.type !== 'assigned' && event.type !== 'unassigned') throw new RequestError(400, 'Unknown thread event');
        return { id: id(event.id, 'Event ID'), type: event.type, author: author(event.author, 'event.author'), createdAt: timestamp(event.createdAt, 'event.createdAt'), ...(event.assignee !== undefined ? { assignee: author(event.assignee, 'event.assignee') } : {}) };
      });
    }
    return thread;
  });
  if (new Set(threads.map((a) => a.id)).size !== threads.length) throw new RequestError(400, 'Thread IDs must be unique');
  return threads;
}

function git(root: string, args: string[], maxBuffer = 4096): string {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer }).trim(); }
  catch { return ''; }
}
export function gitRoot(viteRoot: string): string {
  return realpathSync(git(viteRoot, ['rev-parse', '--show-toplevel']) || viteRoot);
}
export function gitIdentity(root: string): { identity: Author | null; identityError?: string } {
  const name = git(root, ['config', '--get', 'user.name']);
  const email = git(root, ['config', '--get', 'user.email']).toLowerCase();
  if (!name || !email || name.length > 200 || !/^[^\s@]+@[^\s@]+$/.test(email)) return { identity: null, identityError: IDENTITY_GUIDANCE };
  return { identity: { id: `git:${createHash('sha256').update(email).digest('hex')}`, name } };
}

/** Only public display names and opaque IDs leave this development-only directory. */
export function collaborators(root: string, snapshot: Snapshot): Author[] {
  const known = new Map<string, Author>();
  const add = (person?: Author | null) => { if (person) known.set(person.id, person); };
  // The newest spelling wins for duplicate emails in history; saved discussion names
  // and the local identity take precedence over historical Git display names.
  const history = git(root, ['log', '-200', '--format=%an%x00%ae'], 1024 * 1024).split('\n').reverse();
  for (const line of history) {
    const [name, email] = line.split('\0');
    if (name && name.length <= 200 && email && /^[^\s@]+@[^\s@]+$/.test(email)) {
      add({ id: `git:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`, name });
    }
  }
  const threads = [...snapshot.annotations, ...[...snapshot.records.values()].map(record => record.thread)];
  for (const thread of threads) {
    add(thread.author); add(thread.updatedBy); add(thread.resolvedBy); add(thread.assignee);
    for (const reply of thread.replies ?? []) add(reply.author);
    for (const event of thread.events ?? []) { add(event.author); add(event.assignee); }
  }
  add(gitIdentity(root).identity);
  return [...known.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function relativePath(root: string, configured: string, label: string): string {
  if (!configured || isAbsolute(configured) || configured.split(/[\\/]/).some((p) => p === '..' || p === '.' || !p || p.toLowerCase() === '.git')) throw new Error(`[annotoo] ${label} must be a relative path inside the project, without .., Git internals or symlinks`);
  const path = resolve(root, configured);
  assertSafePath(root, path);
  return path;
}
/** Refuse symlinks in every component, including existing destinations, before reads or writes. */
export function assertSafePath(root: string, path: string): void {
  const rel = relative(root, path);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) throw new Error('[annotoo] Refusing a path outside the project');
  let current = root;
  for (const part of rel.split(sep)) {
    current = resolve(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error(`[annotoo] Refusing symlink path: ${relative(root, current)}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}
export function ensureLegacy(root: string, file: string): void {
  assertSafePath(root, file);
  if (existsSync(file)) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, '[]\n', { flag: 'wx' });
}

export function projectDirectory(commentsDir: string, project: string): string {
  return resolve(commentsDir, createHash('sha256').update(project).digest('hex').slice(0, 16));
}
function recordName(id: string): string {
  return `${ID.test(id) ? id : `legacy-${createHash('sha256').update(id).digest('hex')}`}.json`;
}
export function readSnapshot(root: string, file: string, commentsDir: string, project: string): Snapshot {
  assertSafePath(root, file);
  assertSafePath(root, commentsDir);
  const records = new Map<string, RecordFile>();
  const merged = new Map<string, Thread>();
  const hash = createHash('sha256');
  const parse = (raw: string, label: string): unknown => {
    try { return JSON.parse(raw); }
    catch { throw new Error(`[annotoo] Invalid JSON in ${label}. Fix or restore this file before saving comments.`); }
  };
  const legacyRaw = readFileSync(file, 'utf8');
  hash.update(`project:${project}\nlegacy:${legacyRaw}\n`);
  try { for (const thread of validateThreads(parse(legacyRaw, relative(root, file)), true)) merged.set(thread.id, thread); }
  catch (error) { throw new Error(`[annotoo] Cannot read ${relative(root, file)}: ${(error as Error).message}`); }
  const directories = project === '.' ? [commentsDir, projectDirectory(commentsDir, project)] : [projectDirectory(commentsDir, project)];
  for (const directory of directories) {
    assertSafePath(root, directory);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory).filter((name) => name.endsWith('.json')).sort()) {
      const path = resolve(directory, name);
      assertSafePath(root, path);
      const raw = readFileSync(path, 'utf8');
      hash.update(`${name}:${raw}\n`);
      try {
        const record = object(parse(raw, relative(root, path)), 'Comment file');
        if (record.schemaVersion !== 1) throw new Error('Expected schemaVersion: 1');
        if ((record.project ?? '.') !== project) throw new Error(`Expected project ${project}`);
        if (record.deleted !== undefined && record.deleted !== true) throw new Error('deleted must be true when present');
        const [thread] = validateThreads([record.thread], true);
        if (name !== recordName(thread.id)) throw new Error('Filename must match the thread ID (or its legacy ID hash)');
        const saved: RecordFile = { schemaVersion: 1, project, thread, ...(record.deleted ? { deleted: true } : {}) };
        records.set(thread.id, saved);
        if (saved.deleted) merged.delete(thread.id);
        else merged.set(thread.id, thread);
      } catch (error) { throw new Error(`[annotoo] Cannot read ${relative(root, path)}: ${(error as Error).message}. Fix or restore this comment file before saving.`); }
    }
  }
  const annotations = [...merged.values()].sort((a, b) => a.n - b.n || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  if (annotations.length > MAX_THREADS) throw new Error(`[annotoo] The project exceeds the ${MAX_THREADS} thread limit`);
  return { annotations, deletedIds: [...records].filter(([, record]) => record.deleted).map(([id]) => id), revision: `"${hash.digest('hex')}"`, records };
}

function editable(thread: Thread): unknown {
  return { anchor: thread.anchor, title: thread.title, body: thread.body, category: thread.category, route: thread.route };
}
export function prepareChanges(snapshot: Snapshot, requested: Thread[], actor: Author, project: string, directory: Author[] = [actor]): Map<string, RecordFile> {
  const changes = new Map<string, RecordFile>();
  const before = new Map(snapshot.annotations.map((thread) => [thread.id, thread]));
  const now = Date.now();
  let nextNumber = Math.max(0, ...snapshot.annotations.map((thread) => thread.n));
  for (const incoming of requested) {
    const tombstone = snapshot.records.get(incoming.id);
    const restoring = tombstone?.deleted === true;
    // A current-revision request can intentionally undo deletion. Start from the stored
    // thread so Undo cannot replace its authorship, replies or event history.
    const old = before.get(incoming.id) ?? (restoring ? tombstone.thread : undefined);
    if (!old && !ID.test(incoming.id)) throw new RequestError(400, 'New thread IDs must use 1–128 letters, numbers, underscores or hyphens');
    const oldReplies = new Map(old?.replies?.map((reply) => [reply.id, reply]) ?? []);
    const requestedReplies = incoming.replies ?? [];
    if ((old?.replies ?? []).some((reply, index) => requestedReplies[index]?.id !== reply.id || requestedReplies[index]?.body !== reply.body)) throw new RequestError(400, 'Existing replies are append-only and cannot be edited, removed or reordered');
    const replies = requestedReplies.map((reply) => oldReplies.get(reply.id) ?? { id: reply.id, body: reply.body, author: actor, createdAt: now });
    const assignee = incoming.assignee ? directory.find(person => person.id === incoming.assignee!.id) : undefined;
    if (incoming.assignee && !assignee) throw new RequestError(400, 'Unknown collaborator. Refresh comments and choose a known collaborator.');
    const assignmentChanged = old?.assignee?.id !== assignee?.id;
    const oldStatus = old?.status ?? 'open';
    const status = incoming.status ?? 'open';
    const changed = restoring || !old || JSON.stringify(editable(old)) !== JSON.stringify(editable(incoming)) || JSON.stringify(old.replies ?? []) !== JSON.stringify(replies) || oldStatus !== status || assignmentChanged;
    if (!changed) continue;
    const thread: Thread = {
      ...(old ?? {}), ...incoming,
      n: old?.n ?? ++nextNumber,
      createdAt: old?.createdAt ?? now,
      author: old?.author ?? (old ? undefined : actor),
      replies, status, assignee,
      events: old?.events?.slice() ?? [],
    };
    if (old) { thread.updatedAt = now; thread.updatedBy = actor; }
    if (oldStatus !== status) {
      if (thread.events!.length >= MAX_EVENTS) throw new RequestError(400, 'This thread has reached its event limit');
      thread.events!.push({ id: randomUUID(), type: status === 'resolved' ? 'resolved' : 'reopened', author: actor, createdAt: now });
    }
    if (assignmentChanged) {
      if (thread.events!.length >= MAX_EVENTS) throw new RequestError(400, 'This thread has reached its event limit');
      thread.events!.push({ id: randomUUID(), type: assignee ? 'assigned' : 'unassigned', author: actor, createdAt: now, ...(assignee ? { assignee } : old?.assignee ? { assignee: old.assignee } : {}) });
    }
    if (status === 'resolved') {
      thread.resolvedAt = oldStatus === status ? old?.resolvedAt : now;
      thread.resolvedBy = oldStatus === status ? old?.resolvedBy : actor;
    } else { delete thread.resolvedAt; delete thread.resolvedBy; }
    changes.set(thread.id, { schemaVersion: 1, project, thread });
    before.delete(thread.id);
  }
  const present = new Set(requested.map((thread) => thread.id));
  for (const old of snapshot.annotations) if (!present.has(old.id)) changes.set(old.id, { schemaVersion: 1, project, thread: { ...old, updatedAt: now, updatedBy: actor }, deleted: true });
  return changes;
}

/** Stage all files first, then publish atomic renames; restore earlier files if any publish fails. */
export function writeChanges(root: string, commentsDir: string, changes: Map<string, RecordFile>): void {
  if (!changes.size) return;
  assertSafePath(root, commentsDir);
  mkdirSync(commentsDir, { recursive: true });
  const transaction = resolve(commentsDir, `.annotoo-write-${randomUUID()}`);
  mkdirSync(transaction);
  const originals = new Map<string, string | null>();
  const published: string[] = [];
  let preserveRecovery = false;
  try {
    for (const [id, record] of changes) {
      const target = resolve(commentsDir, recordName(id));
      assertSafePath(root, target);
      originals.set(id, existsSync(target) ? readFileSync(target, 'utf8') : null);
      const original = originals.get(id);
      if (original !== null) writeFileSync(resolve(transaction, `backup-${recordName(id)}`), original!, { flag: 'wx' });
      writeFileSync(resolve(transaction, recordName(id)), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    }
    for (const id of changes.keys()) {
      const target = resolve(commentsDir, recordName(id));
      assertSafePath(root, target);
      renameSync(resolve(transaction, recordName(id)), target);
      published.push(id);
    }
  } catch (error) {
    const failures: string[] = [];
    for (const id of published.reverse()) {
      try {
        const target = resolve(commentsDir, recordName(id));
        assertSafePath(root, target);
        const original = originals.get(id);
        if (original === null) rmSync(target);
        else {
          const rollback = resolve(transaction, `rollback-${recordName(id)}`);
          writeFileSync(rollback, original!);
          renameSync(rollback, target);
        }
      } catch { failures.push(id); }
    }
    if (failures.length) {
      preserveRecovery = true;
      throw new Error(`[annotoo] Saving failed and rollback was incomplete for ${failures.join(', ')}. Originals are preserved in ${relative(root, transaction)}. Restore those comment files before retrying.`);
    }
    throw error;
  } finally { if (!preserveRecovery) rmSync(transaction, { recursive: true, force: true }); }
}

const locks = new Map<string, Promise<void>>();
type LockOwner = { pid: number; token: string };
function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}
function lockOwner(path: string): LockOwner | null {
  try {
    const value = JSON.parse(readFileSync(resolve(path, 'owner.json'), 'utf8')) as LockOwner;
    return typeof value.token === 'string' && typeof value.pid === 'number' ? value : null;
  } catch { return null; }
}
function removeOwnedRecovery(path: string, token: string): void {
  try { if (readFileSync(path, 'utf8') === token) rmSync(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
async function acquireFileLock(root: string, directory: string): Promise<() => void> {
  assertSafePath(root, directory);
  mkdirSync(directory, { recursive: true });
  const path = resolve(directory, '.annotoo-lock');
  const owner: LockOwner = { pid: process.pid, token: randomUUID() };
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    assertSafePath(root, path);
    try {
      mkdirSync(path);
      try { writeFileSync(resolve(path, 'owner.json'), JSON.stringify(owner), { flag: 'wx' }); }
      catch (error) { rmSync(path, { recursive: true, force: true }); throw error; }
      return () => {
        assertSafePath(root, path);
        if (lockOwner(path)?.token === owner.token) rmSync(path, { recursive: true, force: true });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const previousOwner = lockOwner(path);
    let stale = previousOwner ? !processIsAlive(previousOwner.pid) : false;
    try { if (!previousOwner && Date.now() - statSync(path).mtimeMs > 30000) stale = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    if (stale) {
      // Only one contender recovers a dead owner's directory. Recheck ownership
      // after claiming recovery so an old observation cannot remove a fresh lock.
      const recovery = resolve(path, 'recovering');
      try {
        writeFileSync(recovery, owner.token, { flag: 'wx' });
        const currentOwner = lockOwner(path);
        if (currentOwner?.token === previousOwner?.token && (!currentOwner || !processIsAlive(currentOwner.pid))) {
          const abandoned = resolve(directory, `.annotoo-abandoned-${owner.token}`);
          renameSync(path, abandoned);
          rmSync(abandoned, { recursive: true, force: true });
          continue;
        }
      } catch (error) {
        if (!['EEXIST', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      } finally { removeOwnedRecovery(recovery, owner.token); }
    }
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new RequestError(503, 'Another Annotoo process is saving comments. Retry shortly. If it stopped unexpectedly, inspect the .annotoo-lock directory.');
}
/** Serialize compare-and-swap across requests and separate dev-server processes. */
export async function withWriteLock<T>(root: string, key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((done) => { release = done; });
  locks.set(key, current);
  await previous;
  let releaseFile: (() => void) | undefined;
  try { releaseFile = await acquireFileLock(root, key); return await task(); }
  finally { try { releaseFile?.(); } finally { release(); if (locks.get(key) === current) locks.delete(key); } }
}
