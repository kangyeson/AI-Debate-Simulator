export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  const { topic, side, character, style, conversationHistory, userIntervention, turn } = await req.json()

  const stylePrompts = {
    emotional: "감정과 공감을 중심으로 인간적 사례와 감정적 단어를 활용하여 주장하세요.",
    logical: "논리와 근거를 중심으로 데이터, 통계, 반례를 활용하여 체계적으로 주장하세요.",
    philosophical: "철학적 질문과 가치 탐구를 중심으로 깊이 있게 사고하며 주장하세요.",
  }

  const isFinalTurn = turn?.isFinal === true
  const systemPrompt = `당신은 "${topic}"에 대해 ${side === "pro" ? "찬성" : "반대"} 입장을 취하는 토론자입니다.

캐릭터 설정: ${character}

토론 스타일: ${stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.logical}

중요 규칙 (반드시 지킬 것):
1. 답변은 반드시 2-3문장, 최대 100단어 이내로 매우 간결하게 작성하라.
2. 불필요한 설명이나 장황한 표현은 피하고 핵심 주장만 명확히 전달하라.
3. 상대방의 주장에에 반박하거나 보완하라.
4. 구체적인 근거나 예시는 처음 주장 때 1-2개만 들어 설득력을 높이라. 
5. 근거나 예시를 찾을 수 없거나 없어도 주장이 보편적으로 합리적이고 납득할 수 있다면 생략하라.
6. ${side === "pro" ? "찬성" : "반대"} 입장을 일관되게 유지하라.
7. 생각 과정을 최소화하고 바로 답변에 집중하라.
${isFinalTurn ? "8. 이번 턴이 마지막 턴이므로, 최종적으로 자신의 주장을 요약하며 강한 설득으로 마무리하라." : ""}`

  // 대화가 길어지면 응답 지연/타임아웃을 유발할 수 있으므로 최근 N개만 포함
  const recentHistory = Array.isArray(conversationHistory)
    ? conversationHistory.slice(-4)
    : []
  const conversationContext =
    recentHistory.length > 0
      ? `\n\n이전 대화:\n${conversationHistory.map((msg: any) => `${msg.side === "pro" ? "찬성" : msg.side === "con" ? "반대" : "사용자"}: ${msg.content}`).join("\n")}`
      : ""

  const interventionContext = userIntervention
    ? `\n\n사용자의 개입: ${userIntervention}\n사용자의 개입을 고려하여 당신의 입장에서 답변하세요.`
    : ""

  // 프롬프트 길이 과도 시 모델 실패를 유발할 수 있어 하드 제한
  const rawPrompt = systemPrompt + conversationContext + interventionContext + "\n\n이제 당신의 차례입니다. 주장을 펼치세요:"
  const MAX_PROMPT_CHARS = 8000
  const prompt = rawPrompt.length > MAX_PROMPT_CHARS ? rawPrompt.slice(0, MAX_PROMPT_CHARS) : rawPrompt

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), { status: 500 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500, // 생각 과정(thoughts) 토큰을 고려하여 충분히 증가
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
      console.error("Gemini API Error:", {
        status: res.status,
        statusText: res.statusText,
        error: data,
      })
      return new Response(
        JSON.stringify({ error: "Gemini API error", status: res.status, details: data }),
        { status: res.status }
      )
    }

    // candidates가 없는 경우 확인
    if (!data?.candidates || data.candidates.length === 0) {
      console.error("No candidates in response:", data)
      return new Response(
        JSON.stringify({ error: "No candidates in response", raw: data }),
        { status: 500 }
      )
    }

    const candidate = data.candidates[0]

    // 안전성 필터 체크
    if (candidate.safetyRatings) {
      const blocked = candidate.safetyRatings.some(
        (rating: any) => rating.probability === "HIGH" || rating.probability === "MEDIUM"
      )
      if (blocked) {
        console.warn("Content blocked by safety filter:", candidate.safetyRatings)
      }
    }

    // 텍스트 추출 (parts 배열이 있는지 확인)
    const parts = candidate?.content?.parts
    const text = parts && parts.length > 0 ? parts[0]?.text : null

    if (!text) {
      // MAX_TOKENS인 경우 부분 응답이라도 반환 시도
      if (candidate.finishReason === "MAX_TOKENS") {
        console.warn("Response truncated due to MAX_TOKENS", {
          thoughtsTokenCount: data.usageMetadata?.thoughtsTokenCount,
          totalTokenCount: data.usageMetadata?.totalTokenCount,
        })
        return new Response(
          JSON.stringify({
            error: "응답이 토큰 제한으로 인해 완전히 생성되지 않았습니다.",
            finishReason: candidate.finishReason,
            suggestion: "더 짧고 간결한 답변을 요청하거나 maxOutputTokens를 증가시켜주세요.",
          }),
          { status: 500 }
        )
      }
      
      console.error("No text in response:", {
        finishReason: candidate.finishReason,
        hasParts: !!parts,
        partsLength: parts?.length,
      })
      return new Response(
        JSON.stringify({
          error: "No text generated",
          finishReason: candidate.finishReason,
        }),
        { status: 500 }
      )
    }
    
    // MAX_TOKENS이지만 텍스트가 있는 경우 (부분 응답) 경고만 출력하고 반환
    if (candidate.finishReason === "MAX_TOKENS" && text) {
      console.warn("Response truncated but returning partial text")
    }

    return Response.json({ text })
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "Request failed", name: e?.name, message: e?.message, cause: e?.cause }),
      { status: 500 }
    )
  }
}
