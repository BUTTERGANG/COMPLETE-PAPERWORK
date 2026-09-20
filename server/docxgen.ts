import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from 'docx';
import { buildNoteDocument, type NoteSection } from './noteTemplate';
import { eventFileName } from '../src/lib/eventFilename';

function buildTable(section: NoteSection): Table {
  const rows = section.rows.map(
    (row) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: row.label, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: row.value || 'NA' })] })],
          }),
        ],
      }),
  );
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function buildSectionParagraphs(section: NoteSection): (Paragraph | Table)[] {
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: section.heading, bold: true })],
  });
  return [heading, buildTable(section)];
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
    children: [new TextRun({ text: 'DJ Event Notes', bold: true })],
  });

  const body: (Paragraph | Table)[] = [title];
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
