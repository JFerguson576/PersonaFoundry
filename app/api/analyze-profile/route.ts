import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
export const runtime = 'nodejs'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}


export async function GET() {
  return NextResponse.json({ ok: true, route: 'analyze-profile' })
}


async function extractTxt(file: File) {
  return normalizeText(await file.text())
}

async function extractDocx(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return normalizeText(result.value || '')
}

async function extractPdf(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)

  const pdf = await getDocumentProxy(uint8)
  const { text } = await extractText(pdf, { mergePages: true })

  return normalizeText(text || '')
}

function getExtension(filename: string) {
  const parts = filename.split('.')
  if (parts.length < 2) return ''
  return parts.pop()?.toLowerCase() || ''
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Max 10 MB.' },
        { status: 400 }
      )
    }

    const extension = getExtension(file.name)

    const isTxt = file.type === 'text/plain' || extension === 'txt'
    const isPdf = file.type === 'application/pdf' || extension === 'pdf'
    const isDocx =
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === 'docx'

    if (!isTxt && !isPdf && !isDocx) {
      return NextResponse.json(
        {
          error: 'Unsupported file type. Please upload a TXT, PDF, or DOCX file.',
        },
        { status: 400 }
      )
    }

    let extractedText = ''

    try {
      if (isTxt) {
        extractedText = await extractTxt(file)
      } else if (isPdf) {
        extractedText = await extractPdf(file)
      } else if (isDocx) {
        extractedText = await extractDocx(file)
      }
    } catch (parseError) {
      console.error('File parsing failed:', parseError)

      return NextResponse.json(
        {
          error:
            'The file was uploaded, but its text could not be extracted. Please try another TXT, PDF, or DOCX file.',
        },
        { status: 422 }
      )
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'No readable text was found in that file.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      text: extractedText,
      filename: file.name,
      size: file.size,
      mimeType: file.type || null,
    })
  } catch (error) {
    console.error('extract-profile-text failed:', error)

    return NextResponse.json(
      { error: 'Failed to extract text from file.' },
      { status: 500 }
    )
  }
}
