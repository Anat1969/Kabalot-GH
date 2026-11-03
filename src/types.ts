export interface Receipt {
  id: string;
  /** What was bought: the main key the whole app is organised by. */
  item: string;
  store: string;
  category: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  amount: number | null;
  returnDays: number | null;
  warrantyMonths: number | null;
  notes: string;
  /** Full text read from the receipt, searchable. */
  ocrText: string;
  fileId: string | null;
  fileType: string;
  /** Small JPEG data URL for lists and the table. */
  thumb: string;
  /** Fields that were filled by reading the receipt and still need a look. */
  auto: Partial<Record<'item' | 'store' | 'date' | 'amount', boolean>>;
  demo?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StoredFile {
  id: string;
  /** The original file as it came from the phone (photo or PDF). */
  original: Blob;
  /** An image to show: the photo itself, or the first page of a PDF. */
  display: Blob;
  name: string;
}

export type Status = 'return' | 'warranty' | 'expired' | 'none';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
