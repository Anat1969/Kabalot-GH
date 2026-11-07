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
  /** Link to the digital receipt, when it came in a text message. */
  link?: string;
  source?: 'photo' | 'message' | 'email';
  /** Where it came from, for de-duplication on import (e.g. "gmail:<messageId>"). */
  sourceId?: string;
  /** A recurring charge (monthly subscription) or a one-time purchase. */
  kind?: 'subscription' | 'one-time';
  /** Currency of the original charge. `amount` is always in shekels. */
  currency?: 'ILS' | 'USD' | 'EUR';
  /** The amount in the original currency, when it is not shekels. */
  amountOrig?: number | null;
  /** Bank of Israel representative rate used for the conversion, and its date. */
  rate?: number | null;
  rateDate?: string;
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
