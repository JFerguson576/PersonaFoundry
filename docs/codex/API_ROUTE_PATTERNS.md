# API Route Patterns

## Standard POST Route

```ts
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body) {
      return NextResponse.json(
        { error: "Missing request body" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: null,
    })
  } catch (error) {
    console.error("API route error:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

## OpenAI Route Rules
- OpenAI calls must happen server-side.
- Do not expose the API key to the browser.
- Validate input before calling OpenAI.
- Return structured JSON.
- Keep prompts in clear helper functions if they become large.

## Supabase Route Rules
- Authenticate the user.
- Filter by `user_id`.
- Handle missing user gracefully.
- Return clean errors.

## Error Response Shape

```ts
return NextResponse.json(
  {
    success: false,
    error: "Clear user-safe error message",
  },
  { status: 400 }
)
```

## Success Response Shape

```ts
return NextResponse.json({
  success: true,
  data,
})
```
