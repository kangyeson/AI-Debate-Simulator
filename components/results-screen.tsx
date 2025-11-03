"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Home, RotateCcw, Loader2 } from "lucide-react"

interface SummaryData {
  topic: string
  proMain: string
  proReasoning: string
  proExample: string
  proFinal: string
  conMain: string
  conReasoning: string
  conExample: string
  conFinal: string
}

interface EvaluationData {
  morePersuasive: string
  reasoning: string
}

export default function ResultsScreen() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const topic = searchParams.get("topic") || ""
  const messagesJson = searchParams.get("messages") || "[]"
  const proCharacter = searchParams.get("proCharacter") || "찬성"
  const conCharacter = searchParams.get("conCharacter") || "반대"
  const proStance = searchParams.get("proStance") || "찬성"
  const conStance = searchParams.get("conStance") || "반대"

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false)

  // ✅ 안전한 디코딩
  function decodeURIComponentSafe(str: string) {
    try {
      return decodeURIComponent(str)
    } catch {
      return str
    }
  }

  // ✅ 안전한 JSON 파싱
  function safeJsonParse(str: string) {
    try {
      return JSON.parse(str)
    } catch {
      return []
    }
  }

  // ✅ 페이지 진입 시 요약 요청
  useEffect(() => {
    async function fetchModeratorSummary() {
      setIsLoadingSummary(true)
      try {
        const decoded = decodeURIComponentSafe(messagesJson)
        const messages = safeJsonParse(decoded)

        const res = await fetch("/api/moderator/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, messages, proCharacter, conCharacter }),
        })

        if (!res.ok) throw new Error("Failed to fetch moderator summary")

        const data = await res.json()

        setSummaryData({
          topic: data.topic || topic,
          proMain: data.pro?.핵심주장 || "",
          proReasoning: data.pro?.주요논거 || "",
          proExample: data.pro?.뒷받침사례 || "",
          proFinal: data.pro?.최종변론 || "",
          conMain: data.con?.핵심주장 || "",
          conReasoning: data.con?.주요논거 || "",
          conExample: data.con?.뒷받침사례 || "",
          conFinal: data.con?.최종변론 || "",
        })
      } catch (err) {
        console.error("Error loading moderator summary:", err)
      } finally {
        setIsLoadingSummary(false)
      }
    }

    fetchModeratorSummary()
  }, [topic, messagesJson, proCharacter, conCharacter])

  

  // ✅ 평가 생성 (버튼 클릭 시)
  async function handleShowEvaluation() {
    if (!summaryData) return
    setIsLoadingEvaluation(true)
    try {
      const res = await fetch("/api/moderator/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          proSummary: {
            핵심주장: summaryData.proMain,
            주요논거: summaryData.proReasoning,
            뒷받침사례: summaryData.proExample,
            최종변론: summaryData.proFinal,
          },
          conSummary: {
            핵심주장: summaryData.conMain,
            주요논거: summaryData.conReasoning,
            뒷받침사례: summaryData.conExample,
            최종변론: summaryData.conFinal,
          },
        }),
      })

      if (!res.ok) throw new Error("Failed to fetch evaluation")

      const data = await res.json()
      setEvaluation({
        morePersuasive: data.morePersuasive || "판단불가",
        reasoning: data.reasoning || "평가 생성 실패",
      })
    } catch (err) {
      console.error("Error loading evaluation:", err)
      setEvaluation({
        morePersuasive: "판단불가",
        reasoning: "평가 생성 실패",
      })
    } finally {
      setIsLoadingEvaluation(false)
    }
  }

  const handleRestart = () => {
    router.push("/")
  }

  if (isLoadingSummary || !summaryData) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-foreground text-lg">AI 사회자가 토론 내용을 분석 중입니다...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">토론 결과</h1>
        </div>

        {/* 요약표 */}
        <Card className="p-8 space-y-6 backdrop-blur-sm bg-card/80 shadow-[0_0_15px] shadow-primary/30 border-border/50">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground text-center pb-4 border-b border-border">
              {summaryData.topic}
            </h2>

            <h3 className="text-lg font-semibold text-foreground">토론 요약</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-foreground font-semibold">항목</th>
                    <th className="text-left p-3 text-pro font-semibold">찬성({proStance})</th>
                    <th className="text-left p-3 text-con font-semibold">반대({conStance})</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-semibold text-foreground">핵심 주장</td>
                    <td className="p-3 text-foreground/80">{summaryData.proMain}</td>
                    <td className="p-3 text-foreground/80">{summaryData.conMain}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-semibold text-foreground">주요 논거</td>
                    <td className="p-3 text-foreground/80">{summaryData.proReasoning}</td>
                    <td className="p-3 text-foreground/80">{summaryData.conReasoning}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-semibold text-foreground">뒷받침 사례</td>
                    <td className="p-3 text-foreground/80">{summaryData.proExample}</td>
                    <td className="p-3 text-foreground/80">{summaryData.conExample}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-foreground">최종 변론</td>
                    <td className="p-3 text-foreground/80">{summaryData.proFinal}</td>
                    <td className="p-3 text-foreground/80">{summaryData.conFinal}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ✅ 평가 요청 버튼 */}
            <Button
              onClick={handleShowEvaluation}
              disabled={isLoadingEvaluation}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
            >
              {isLoadingEvaluation ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  평가 생성 중...
                </>
              ) : (
                "AI 사회자 평가 생성"
              )}
            </Button>
          </div>
        </Card>

        {/* ✅ 평가 결과 표시 */}
        {evaluation && (
          <Card className="p-8 space-y-6 backdrop-blur-sm bg-card/80 border-border/50">
            <h2 className="text-xl font-semibold text-foreground">AI 사회자 평가</h2>
            <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {evaluation.morePersuasive} 측이 더 설득력 있음
              {"\n"}이유: {evaluation.reasoning}
            </div>
          </Card>
        )}

        {/* 하단 버튼 */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={handleRestart} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <RotateCcw className="w-4 h-4 mr-2" />
            다시 시작하기
          </Button>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="border-border hover:bg-secondary text-foreground bg-transparent"
          >
            <Home className="w-4 h-4 mr-2" />
            홈으로
          </Button>
        </div>
      </div>
    </div>
  )
}
