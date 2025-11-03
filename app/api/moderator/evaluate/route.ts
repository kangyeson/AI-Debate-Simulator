export const runtime = "nodejs"
export const maxDuration = 60

import { sql } from "@/lib/db"

async function callGemini(apiKey: string, prompt: string, maxOutputTokens = 800, model = "gemini-2.0-flash") {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens, topP: 0.9 },
        }),
        signal: controller.signal,
      }
    )

    clearTimeout(timeout)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    return { ok: res.ok, status: res.status, text, raw: data }
  } catch (err: any) {
    clearTimeout(timeout)
    console.error("callGemini error:", err?.message || err)
    return { ok: false, status: 500, text: "", raw: err }
  }
}

async function evaluateDebate(apiKey: string, messages: string[]) {
  const prompt = `
당신은 토론 사회자입니다.
다음은 찬성/반대 양측의 대화 기록입니다.
각 발언을 참고하여 토론 전반에 대한 평가와 피드백을 JSON 형식으로 작성하세요.
JSON 외에는 출력하지 마세요.

{
  "전체평가": "토론의 강점과 약점, 논리적 완결성 평가 3~4문장",
  "찬성측평가": "찬성측 주장의 명확성, 근거, 사례 평가 2~3문장",
  "반대측평가": "반대측 주장의 명확성, 근거, 사례 평가 2~3문장",
  "추천조언": "다음 토론을 위한 구체적 조언 1~2문장"
}

대화 기록:
${messages.length > 0 ? messages.join("\n---\n") : "발언 없음"}
`.trim()

  const res = await callGemini(apiKey, prompt, 1000)
  return res
}

export async function POST(req: Request) {
  try {
    const { debateId } = await req.json()
    if (!debateId) {
      return new Response(JSON.stringify({ error: "Missing debateId" }), { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), { status: 500 })
    }

    // DB에서 debateId로 메시지 조회
    const debate = await sql`
      SELECT messages
      FROM debates
      WHERE id = ${debateId}
    ` as { messages: string }[]

    if (!debate?.[0]?.messages) {
      return new Response(JSON.stringify({ error: "Debate not found" }), { status: 404 })
    }

    // messages 안전하게 처리
    let messagesObj: { side: string; content: string }[]
    if (typeof debate[0].messages === "string") {
      messagesObj = JSON.parse(debate[0].messages)
    } else {
      messagesObj = debate[0].messages
    }

    const messagesContent = messagesObj.map(
      (m) =>
        `${m.side === "pro" ? "찬성" : m.side === "con" ? "반대" : "사용자"}: ${m.content}`
    )
    
    const evaluation = await evaluateDebate(apiKey, messagesContent)

    return new Response(JSON.stringify({ evaluation }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("Error in moderator evaluate route:", e)
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 })
  }
}
