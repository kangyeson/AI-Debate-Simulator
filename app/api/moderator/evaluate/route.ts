export const runtime = "nodejs"
export const maxDuration = 60

import { sql } from "@/lib/db"

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

async function evaluateDebate(apiKey: string, proSummary: any, conSummary: any) {
  const prompt = `
당신은 객관적이고 분석적인 토론 사회자입니다.
다음은 찬성 측과 반대 측의 요약 정보입니다.
이를 토대로 토론의 논리적 완성도, 설득력, 근거의 적절성을 평가하고 가장 설득력 있는 주장을 선정하세요.

반드시 아래 JSON 형식에 맞추어 출력하세요.
JSON 외의 다른 텍스트(설명, 주석 등)는 절대 포함하지 마세요.
{
  "전체평가": "토론의 강점과 약점, 논리적 완결성 평가 (3~4문장)",
  "찬성측평가": "찬성측 주장의 명확성, 근거, 사례에 대한 평가 (2~3문장)",
  "반대측평가": "반대측 주장의 명확성, 근거, 사례에 대한 평가 (2~3문장)",
  "설득력있는 주장": "찬성측 또는 반대측 중 반드시 하나를 선택 (예: '찬성측')",
  "선정이유": "선정한 주장이 어느 부분에서 설득력이 높은지 구체적으로 설명 (2~3문장)"
}

대화 기록:
찬성 측 요약:
${JSON.stringify(proSummary, null, 2)}

반대 측 요약:
${JSON.stringify(conSummary, null, 2)}
`.trim()

  const res = await callGemini(apiKey, prompt, 1000)
  console.log("Gemini raw:", res.raw, "text:", res.text)
  return res
}

export async function POST(req: Request) {
  try {
    const { debateId, proSummary, conSummary } = await req.json()
    if (!debateId || !proSummary || !conSummary) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (debateId, proSummary, conSummary)" }),
        { status: 400 }
      )
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
    ` as { messages: string | any }[]

    if (!debate?.[0]?.messages) {
      return new Response(JSON.stringify({ error: "Debate not found" }), { status: 404 })
    }

    // messages 처리
    let messagesObj: { side: string; content: string }[]
    if (typeof debate[0].messages === "string") {
      messagesObj = JSON.parse(debate[0].messages)
    } else {
      messagesObj = debate[0].messages
    }
    
    // Gemini API 호출
    const evaluationRes = await evaluateDebate(apiKey, proSummary, conSummary)

    // text 안에 ```json ... ``` 제거 후 파싱
    let parsedEvaluation: any = {}
    try {
      const cleanText = evaluationRes.text?.replace(/```json|```/g, '').trim() || ""
      const raw = cleanText ? JSON.parse(cleanText) : {}

      // ✅ 한국어 키 → 영어 키로 통일
      parsedEvaluation = {
        overall: raw["전체평가"] || "평가 없음",
        pro: raw["찬성측평가"] || "",
        con: raw["반대측평가"] || "",
        morePersuasive: raw["설득력있는 주장"] || raw["설득력있는주장선정"] || "판단불가",
        reasoning: raw["선정이유"] || raw["주장선정이유"] || "",
      }
    } catch (e) {
      console.error("Failed to parse evaluation text:", e)
      parsedEvaluation = {
        전체평가: "평가 생성 실패",
        찬성측평가: "",
        반대측평가: "",
        설득력있는주장선정: "판단불가",
        주장선정이유: "JSON 파싱 오류 또는 API 응답 없음",
      }
    }

    return new Response(JSON.stringify(parsedEvaluation), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("Error in moderator evaluate route:", e)
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 })
  }
}
