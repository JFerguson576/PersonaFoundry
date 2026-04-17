import { NextResponse } from "next/server"
import { extractTextFromCareerUpload } from "@/lib/career-upload"
import { getRequestAuth } from "@/lib/supabase/auth"

export async function POST(req: Request) {
  try {
    const { user, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 })
    }

    const text = await extractTextFromCareerUpload(file)

    if (!text) {
      return NextResponse.json({ error: "We could not extract readable text from that file" }, { status: 400 })
    }

    return NextResponse.json({
      title: file.name.replace(/\.[^.]+$/, ""),
      content_text: text,
      file_name: file.name,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
