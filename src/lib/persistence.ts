import { toPng } from 'html-to-image';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, sanitizeDocument, serializeDocument } from './diagram';
import { readImportedDocument } from './import';
import type { DiagramDocument, SavedDiagramRecord } from '../types';

const LIBRARY_KEY = 'flowcraft.editor.library.v1';
const DATABASE_NAME = 'flowcraft-local-db';
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = 'documents';

function download(name: string, blob: Blob): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function loadStoredDocument(): DiagramDocument {
  return loadStoredDocumentOrNull() ?? sanitizeDocument(null);
}

function loadStoredDocumentOrNull(): DiagramDocument | null {
  if (typeof window === 'undefined') return null;

  try {
    const next = window.localStorage.getItem(STORAGE_KEY);
    if (next) {
      return sanitizeDocument(JSON.parse(next));
    }

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      return sanitizeDocument(JSON.parse(legacy));
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  return null;
}

function buildRecord(document: DiagramDocument): SavedDiagramRecord {
  return {
    id: document.meta.id,
    name: document.meta.name,
    updatedAt: document.meta.updatedAt,
    nodeCount: document.nodes.length,
    edgeCount: document.edges.length,
    document,
  };
}

function sortRecords(records: SavedDiagramRecord[]): SavedDiagramRecord[] {
  return [...records].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function writeLegacyLibrary(records: SavedDiagramRecord[]): void {
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(sortRecords(records)));
}

function readLegacyLibrary(): SavedDiagramRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sortRecords(parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const record = entry as Partial<SavedDiagramRecord> & { document?: unknown };
      if (!record.document) return [];
      const document = sanitizeDocument(record.document);
      return [buildRecord(document)];
    }));
  } catch {
    window.localStorage.removeItem(LIBRARY_KEY);
    return [];
  }
}

export async function saveStoredDocument(document: DiagramDocument): Promise<void> {
  const serialized = serializeDocument(document);
  const storedDocument = sanitizeDocument(JSON.parse(serialized));
  window.localStorage.setItem(STORAGE_KEY, serialized);

  const nextRecord = buildRecord(storedDocument);
  const records = readLegacyLibrary().filter((record) => record.id !== nextRecord.id);
  writeLegacyLibrary([nextRecord, ...records]);
  await upsertStoredRecord(nextRecord);
}

export async function listStoredDocuments(): Promise<SavedDiagramRecord[]> {
  const records = await readStoredRecords();
  if (records.length) return records;

  const legacyLibrary = readLegacyLibrary();
  if (legacyLibrary.length) {
    await writeStoredRecords(legacyLibrary);
    return legacyLibrary;
  }

  const current = loadStoredDocumentOrNull();
  if (!current) return [];

  const record = buildRecord(current);
  writeLegacyLibrary([record]);
  await upsertStoredRecord(record);
  return [record];
}

export async function deleteStoredDocument(id: string): Promise<void> {
  const remaining = readLegacyLibrary().filter((record) => record.id !== id);
  writeLegacyLibrary(remaining);

  if (typeof window !== 'undefined') {
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (current) {
        const parsed = sanitizeDocument(JSON.parse(current));
        if (parsed.meta.id === id) {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  await deleteStoredRecord(id);
}

export function downloadDocument(document: DiagramDocument): void {
  download(
    `${document.meta.name.toLowerCase().replace(/\s+/g, '-') || 'flowcraft'}.json`,
    new Blob([serializeDocument(document)], { type: 'application/json' }),
  );
}

export async function readDocumentFromFile(file: File): Promise<DiagramDocument> {
  return readImportedDocument(file);
}

export async function exportCanvasToPng(element: HTMLElement, document: DiagramDocument): Promise<void> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    backgroundColor: '#FFFFFF',
    pixelRatio: 2,
  });

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  download(
    `${document.meta.name.toLowerCase().replace(/\s+/g, '-') || 'flowcraft'}.png`,
    blob,
  );
}

function supportsIndexedDb(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!supportsIndexedDb()) {
    throw new Error('IndexedDB is not available in this browser.');
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
        database.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the local diagram database.'));
  });
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

async function upsertStoredRecord(record: SavedDiagramRecord): Promise<void> {
  if (!supportsIndexedDb()) return;

  const database = await openDatabase();

  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
    transaction.objectStore(DOCUMENT_STORE).put(record);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

async function deleteStoredRecord(id: string): Promise<void> {
  if (!supportsIndexedDb()) return;

  const database = await openDatabase();

  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
    transaction.objectStore(DOCUMENT_STORE).delete(id);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

async function writeStoredRecords(records: SavedDiagramRecord[]): Promise<void> {
  if (!supportsIndexedDb() || !records.length) return;

  const database = await openDatabase();

  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
    const store = transaction.objectStore(DOCUMENT_STORE);
    records.forEach((record) => {
      store.put(record);
    });
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

async function readStoredRecords(): Promise<SavedDiagramRecord[]> {
  if (!supportsIndexedDb()) return [];

  const database = await openDatabase();

  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readonly');
    const records = await toPromise(transaction.objectStore(DOCUMENT_STORE).getAll());
    return sortRecords(records.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const record = entry as Partial<SavedDiagramRecord> & { document?: unknown };
      if (!record.document) return [];
      const document = sanitizeDocument(record.document);
      return [buildRecord(document)];
    }));
  } finally {
    database.close();
  }
}
