import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { buildNoteDocument, type NoteSection } from './noteTemplate';
import { eventFileName } from '../src/lib/eventFilename';

// Render label/value as plain paragraphs with explicit colors (same approach
// as the run sheet). Table-based layouts render blank in some dark-mode
// viewers; paragraphs with explicit run colors render everywhere.
const TEXT = '1A1A1A';
const MUTED = '555555';

function buildSectionParagraphs(section: NoteSection): Paragraph[] {
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text: section.heading, bold: true, color: '111111' })],
  });
  const rows = section.rows.map((row) => {
    const value = row.value && row.value !== 'NA' ? row.value : '—';
    return new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${row.label}: `, bold: true, color: MUTED }),
        new TextRun({ text: value, color: TEXT }),
      ],
    });
  });
  return [heading, ...rows];
}

export async function generateNoteDocx(
  event: Record<string, unknown>,
  notes: { title?: string | null; content?: string }[],
): Promise<Buffer> {
  const sections = buildNoteDocument(event, notes);

  const title = new Paragraph({
    alignment: AlignmentType.CENTER,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 300 },
    children: [new TextRun({ text: 'DJ Event Notes', bold: true, color: '111111' })],
  });

  const body: Paragraph[] = [title];
  for (const section of sections) {
    body.push(...buildSectionParagraphs(section));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 }, // 11pt
        },
      },
    },
    sections: [{ children: body }],
  });

  return Packer.toBuffer(doc);
}

/** Filename for the downloaded .docx — date-first + couple key for Drive sorting. */
export function noteDocxFilename(event: Record<string, unknown>): string {
  return eventFileName(event as { event_date?: string | null; client_name?: string | null; bride_name?: string | null; groom_name?: string | null }, { suffix: 'notes' });
}
