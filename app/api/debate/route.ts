export const runtime = "nodejs"
export const maxDuration = 60

import { v4 as uuidv4 } from "uuid"
import { sql } from "@/lib/db"

export async function POST(req: Request) {
  const { topic, side, character, style, newMessage, debateId, userIntervention, turn } = await req.json()

  const stylePrompts = {
    emotional: "감정과 공감을 중심으로 인간적 사례와 감정적 단어를 활용하여 주장하세요.",
    logical: "논리와 근거를 중심으로 데이터, 통계, 반례를 활용하여 체계적으로 주장하세요.",
    philosophical: "철학적 질문과 가치 탐구를 중심으로 깊이 있게 사고하며 주장하세요.",
  }

  const isFinalTurn = turn?.isFinal === true
  const systemPrompt = `당신은 "${topic}"에 대해 ${side === "pro" ? "찬성" : "반대"} 입장을 취하는 토론자입니다.

  페르소나 설정: ${character}
  이 캐릭터의 말투, 태도, 가치관, 사고방식을 일관되게 유지하세요.
  이 캐릭터는 자신의 성격과 관점을 반영하여 의견을 표현해야 합니다.
  (예: 냉철한 철학자는 차분하고 논리적인 어휘를, 열정적인 환경운동가는 감정적이고 단호한 어조를 사용)

토론 스타일: ${stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.logical}

중요 규칙 (반드시 지킬 것):
1. 답변은 반드시 2-3문장, 최대 100단어 이내로 매우 간결하게 작성하라.
2. 불필요한 설명이나 장황한 표현은 피하고 핵심 주장만 명확히 전달하라.
3. 상대방의 주장에 반박하거나 보완하라.
4. 구체적인 근거나 예시는 처음 주장 때 1-2개만 들어 설득력을 높이라.
5. 근거나 예시를 찾을 수 없거나 없어도 주장이 보편적으로 합리적이고 납득 가능하면 생략하라.
6. ${side === "pro" ? "찬성" : "반대"} 입장을 일관되게 유지하라.
7. 생각 과정을 최소화하고 바로 답변에 집중하라.
${isFinalTurn ? "8. 이번 턴이 마지막 턴이므로, 최종적으로 자신의 주장을 요약하며 강한 설득으로 마무리하라." : ""}`

  // 이전 대화는 DB에서 가져오기
  let previousMessages: any[] = []

  try {
    if (debateId) {
      const res = await sql`SELECT messages FROM debates WHERE id = ${debateId}`
      previousMessages = res[0]?.messages || []
    }
  } catch (err) {
    console.error("DB fetch error:", err)
  }

  const conversationContext =
    previousMessages.length > 0
      ? `\n\n이전 대화:\n${previousMessages
          .map((msg: any) => `${msg.side === "pro" ? "찬성" : msg.side === "con" ? "반대" : "사용자"}: ${msg.content}`)
          .join("\n")}`
      : ""

  const interventionContext = userIntervention
    ? `\n\n사용자의 개입: ${userIntervention}\n사용자의 개입을 고려하여 당신의 입장에서 답변하세요.`
    : ""

  const rawPrompt = systemPrompt + conversationContext + interventionContext + "\n\n이제 당신의 차례입니다. 주장을 펼치세요:"
  const MAX_PROMPT_CHARS = 8000
  const prompt = rawPrompt.length > MAX_PROMPT_CHARS ? rawPrompt.slice(0, MAX_PROMPT_CHARS) : rawPrompt

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), { status: 500 })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1500, topP: 0.9 },
    }

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    const data = await res.json()

    if (!res.ok || !data?.candidates?.length) {
      console.error("Gemini API Error:", data)
      return new Response(JSON.stringify({ error: "Gemini API error", details: data }), { status: 500 })
    }

    const candidate = data.candidates[0]
    const parts = candidate?.content?.parts
    const text = parts && parts.length > 0 ? parts[0]?.text : null
    if (!text) return new Response(JSON.stringify({ error: "No text generated" }), { status: 500 })

    // debateId가 없으면 신규 생성
    const finalDebateId = debateId || uuidv4()

    if (!debateId) {
      // 새 토론 생성
      await sql`
        INSERT INTO debates (id, topic, messages)
        VALUES (${finalDebateId}, ${topic}, ${JSON.stringify([{ side, content: text }])})
      `
    } else {
      // 기존 토론에 메시지 append
      await sql`
        UPDATE debates
        SET messages = messages || ${JSON.stringify([{ side, content: text }])}::jsonb
        WHERE id = ${finalDebateId}
      `
    }

    return Response.json({ text, debateId: finalDebateId })
  } catch (e: any) {
    console.error("❌ Debate API Error:", e)
    return new Response(JSON.stringify({ error: e?.message || "Request failed" }), { status: 500 })
  }
}
