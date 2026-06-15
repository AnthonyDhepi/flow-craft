import { toPng } from 'html-to-image';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, sanitizeDocument, serializeDocument } from './diagram';
import type { DiagramDocument, SavedDiagramRecord } from '../types';

const LIBRARY_KEY = 'flowcraft.editor.library.v1';

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

function writeLibrary(records: SavedDiagramRecord[]): void {
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(sortRecords(records)));
}

function readLibrary(): SavedDiagramRecord[] {
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

export function saveStoredDocument(document: DiagramDocument): void {
  const serialized = serializeDocument(document);
  const storedDocument = sanitizeDocument(JSON.parse(serialized));
  window.localStorage.setItem(STORAGE_KEY, serialized);

  const nextRecord = buildRecord(storedDocument);
  const records = readLibrary().filter((record) => record.id !== nextRecord.id);
  writeLibrary([nextRecord, ...records]);
}

export function listStoredDocuments(): SavedDiagramRecord[] {
  const library = readLibrary();
  if (library.length) return library;

  const current = loadStoredDocumentOrNull();
  if (!current) return [];

  const record = buildRecord(current);
  writeLibrary([record]);
  return [record];
}

export function downloadDocument(document: DiagramDocument): void {
  download(
    `${document.meta.name.toLowerCase().replace(/\s+/g, '-') || 'flowcraft'}.json`,
    new Blob([serializeDocument(document)], { type: 'application/json' }),
  );
}

export async function readDocumentFromFile(file: File): Promise<DiagramDocument> {
  const text = await file.text();
  return sanitizeDocument(JSON.parse(text));
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
