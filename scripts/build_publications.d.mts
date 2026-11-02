export type PublicationEntry = {
  sha: string;
  date: string;
  pr: number | null;
  title: string;
  technical: string | null;
};
export function publicationEntry(
  sha: string,
  date: string,
  subject: string,
  body: string,
): PublicationEntry | null;
export function journalEntries(root: string, days?: number): { date: string; items: string[] }[];
