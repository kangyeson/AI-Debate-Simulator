export const runtime = "nodejs"
export const maxDuration = 60

import { sql } from "@/lib/db"

type SideSummary = {
  항목: string
  핵심주장: string
  주요논거: string
  뒷받침사례: string
  최종변론: string
}

const DEFAULT_SIDE: SideSummary = {
  항목: "",
  핵심주장: "",
  주요논거: "",
  뒷받침사례: "",
  최종변론: "",
}

async function callGemini(apiKey: string, prompt: string, maxOutputTokens = 800, model = "gemini-2.5-flash") {
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

function extractAndParseJson(rawText: string) {
  if (!rawText || typeof rawText !== "string") return null
  const matches = rawText.match(/\{[\s\S]*\}/g)
  if (!matches) return null

  const candidate = matches[matches.length - 1]
  const cleaned = candidate
    .replace(/(\r\n|\n|\r)/gm, " ")
    .replace(/\t/g, " ")
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

  try {
    return JSON.parse(cleaned)
  } catch {
    console.warn("extractAndParseJson failed")
    return null
  }
}

async function summarizeSide(apiKey: string, sideLabel: "찬성" | "반대", messages: string[], proConCharacter?: string): Promise<SideSummary> {
  const prompt = `
당신은 토론 사회자입니다.
다음은 "${sideLabel}" 측의 발언입니다.
이 발언들을 분석해 아래 JSON 형식으로 요약하세요.
JSON 외의 문장은 절대 출력하지 마세요.

{
  "항목": "${sideLabel} (${proConCharacter || ""} 입장 요약)",
  "핵심주장": "이 입장의 중심 주장 2문장 이내",
  "주요논거": "핵심 논리나 근거 2~3문장",
  "뒷받침사례": "구체적 사례 1~2문장",
  "최종변론": "마무리 요약 1문장"
}

발언들:
${messages.length > 0 ? messages.join("\n---\n") : "발언 없음"}
`.trim()

  const res = await callGemini(apiKey, prompt, 1000)
  if (res.ok && res.text) {
    const parsed = extractAndParseJson(res.text)
    if (parsed) return { ...DEFAULT_SIDE, ...parsed }
  }
  return { ...DEFAULT_SIDE }
}

export async function POST(req: Request) {
  try {
    const { debateId, proCharacter, conCharacter } = await req.json()
    if (!debateId) {
      return new Response(JSON.stringify({ error: "debateId is required" }), { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), { status: 500 })
    }

    // ✅ DB에서 debateId로 messages(JSONB) 조회
    const debate = (await sql`
      SELECT messages
      FROM debates
      WHERE id = ${debateId}
    `) as { messages: string }[]

    if (!debate || debate.length === 0) {
      return new Response(JSON.stringify({ error: "Debate not found" }), { status: 404 })
    }

    // JSON 문자열을 배열로 변환
    let messages: { side: "pro" | "con" | "user"; content: string }[] = [];
    try {
      if (typeof debate[0].messages === "string") {
        messages = JSON.parse(debate[0].messages);
      } else if (Array.isArray(debate[0].messages)) {
        messages = debate[0].messages;
      } else {
        console.warn("Unexpected messages format:", debate[0].messages);
      }
    } catch (err) {
      console.error("Failed to parse messages:", err);
      messages = [];
    }
    

    // 이제 filter 사용 가능
    const proMessages = messages.filter((m) => m.side === "pro").map((m) => m.content)
    const conMessages = messages.filter((m) => m.side === "con").map((m) => m.content)


    const [proSummary, conSummary] = await Promise.all([
      summarizeSide(apiKey, "찬성", proMessages, proCharacter),
      summarizeSide(apiKey, "반대", conMessages, conCharacter),
    ])

    const result = {
      pro: { ...DEFAULT_SIDE, ...proSummary },
      con: { ...DEFAULT_SIDE, ...conSummary },
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("Error in moderator summary route:", e)
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 })
  }
}
