export const runtime = "nodejs"
export const maxDuration = 60

type SideSummary = {
  항목: string
  핵심주장: string
  주요논거: string
  뒷받침사례: string
  최종변론: string
}

async function callGemini(apiKey: string, prompt: string, maxOutputTokens = 800, model = "gemini-2.5-flash") {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // ⏱ 30초로 연장

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
  const match = rawText.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    const cleaned = match[0]
      .replace(/(\r\n|\n|\r)/gm, " ")
      .replace(/\t/g, " ")
      .replace(/,\s*}/g, "}")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")

    return JSON.parse(cleaned)
  } catch {
    console.warn("extractAndParseJson failed:", rawText.slice(0, 100))
    return null
  }
}

// ✅ 토론 로그 저장 구조 (세션별, 진영별)
const debateLogs: Record<
  string,
  { pro: string[]; con: string[]; all: string[] }
> = {}

async function generateEvaluation(
  apiKey: string,
  topic: string,
  proSummary: SideSummary,
  conSummary: SideSummary
) {
  // ✅ 완전히 비어있는 경우 AI 호출 방지
  const allEmpty =
    !proSummary.핵심주장 && !conSummary.핵심주장 &&
    !proSummary.주요논거 && !conSummary.주요논거

  if (allEmpty) {
    return { morePersuasive: "판단불가", reasoning: "요약 데이터가 부족하여 평가할 수 없습니다." }
  }

  const prompt = `
당신은 공정한 토론 사회자입니다.
주제 "${topic}"에 대한 두 입장을 분석하여 더 설득력 있는 쪽을 판단하세요.
반드시 아래 JSON 형식으로만 답변하세요.

{
  "morePersuasive": "찬성" 또는 "반대" 또는 "판단불가",
  "reasoning": "2문장 이내 이유"
}

찬성 요약:
${JSON.stringify(proSummary, null, 2)}

반대 요약:
${JSON.stringify(conSummary, null, 2)}
`.trim()

  const res = await callGemini(apiKey, prompt, 600)
  if (res.ok && res.text) {
    const parsed = extractAndParseJson(res.text)
    if (parsed) {
      // 🧹 후처리: 문장형 응답 교정
      let mp = parsed.morePersuasive?.replace(/[^찬성반대판단불가]/g, "") || "판단불가"
      if (!["찬성", "반대", "판단불가"].includes(mp)) mp = "판단불가"

      return {
        morePersuasive: mp,
        reasoning: parsed.reasoning || "AI가 이유를 제공하지 않았습니다.",
      }
    }
  }
  return { morePersuasive: "판단불가", reasoning: "평가 생성 실패" }
}

export async function POST(req: Request) {
  try {
    const { topic, proSummary, conSummary } = await req.json()

    if (!proSummary || !conSummary) {
      return Response.json({ error: "Missing summaries" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 })
    }

    const evaluation = await generateEvaluation(apiKey, topic || "주제 미정", proSummary, conSummary)
    console.debug("[moderator-evaluate]", evaluation)

    return Response.json(evaluation, { status: 200 })
  } catch (e: any) {
    console.error("Error in /evaluate:", e)
    return Response.json({ morePersuasive: "판단불가", reasoning: "서버 오류 발생" }, { status: 500 })
  }
}
