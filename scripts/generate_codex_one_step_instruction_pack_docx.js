const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require("docx");

const cwd = process.cwd();
const mdPath = path.join(cwd, "CODEX_ONE_STEP_INSTRUCTION_PACK.md");
const outPath = path.join(cwd, "CODEX_ONE_STEP_INSTRUCTION_PACK.docx");

const lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
const paragraphs = [];

for (const rawLine of lines) {
  const line = rawLine.trimEnd();
  if (!line.trim()) { paragraphs.push(new Paragraph({ text: "" })); continue; }
  if (line.startsWith("# ")) { paragraphs.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: line.replace(/^#\s+/, ""), bold: true })] })); continue; }
  if (line.startsWith("## ")) { paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: line.replace(/^##\s+/, ""), bold: true })] })); continue; }
  if (line.startsWith("### ")) { paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line.replace(/^###\s+/, ""), bold: true })] })); continue; }
  if (line.startsWith("- ")) { paragraphs.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: line.replace(/^-\s+/, "") })] })); continue; }
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: line })] }));
}

const doc = new Document({ sections: [{ children: paragraphs }] });
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  process.stdout.write(`Created ${outPath}\n`);
}).catch((err) => {
  process.stderr.write(String(err));
  process.exit(1);
});
