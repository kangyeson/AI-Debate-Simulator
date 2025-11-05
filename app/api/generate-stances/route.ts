export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { topic } = await req.json()

    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "Invalid or missing topic" }), { status: 400 })
    }

    const systemPrompt = `
        당신은 토론 주제의 핵심 쟁점을 정리하는 전문 토론 분석가입니다.
        아래 주제에 대해 찬성 측과 반대 측의 핵심 주장을 각각 한 문장으로 매우 간결하게 정의하세요.

        출력 형식은 반드시 아래 JSON 형태만 반환해야 합니다:
        {
          "pro": "찬성 측의 핵심 주장 (한 문장)",
          "con": "반대 측의 핵심 주장 (한 문장)"
        }

        예시:
        주제: "인공지능은 인간의 일자리를 빼앗는가?"
        {
          "pro": "AI가 일자리를 빼앗는다",
          "con": "AI는 일자리를 빼앗지 않는다"
        }
        `.trim()

    const fullPrompt = `${systemPrompt}\n\n주제: "${topic}"`

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), { status: 500 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const requestBody = {
      contents: [
        {
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 400,
        topP: 0.9,
      },
    }

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)

    const data = await res.json()

    if (!res.ok) {
      console.error("Gemini API Error:", data)
      return new Response(
        JSON.stringify({ error: "Gemini API error", status: res.status, details: data }),
        { status: res.status }
      )
    }

    const candidate = data?.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text?.trim()

    if (!text) {
      throw new Error("No text returned from Gemini API")
    }

    // JSON 추출 시 유효성 검사
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Invalid response format")
    }

    const result = JSON.parse(jsonMatch[0])

    return Response.json({
      proStance: result.pro,
      conStance: result.con,
    })
  } catch (error: any) {
    console.error("[Gemini] Error generating stances:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to generate stances",
        message: error?.message || "Unknown error",
      }),
      { status: 500 }
    )
  }
}
