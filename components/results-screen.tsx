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
  overall: string
  pro: string
  con: string
  morePersuasive: string
  reasoning: string
}

export default function ResultsScreen() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const debateId = searchParams.get("debateId") || ""
  const proCharacter = searchParams.get("proCharacter") || "찬성"
  const conCharacter = searchParams.get("conCharacter") || "반대"
  const proStance = searchParams.get("proStance") || "찬성"
  const conStance = searchParams.get("conStance") || "반대"

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false)

  // 페이지 진입 시 요약 요청
  useEffect(() => {
    if (!debateId) {
      console.error("debateId가 없습니다.")
      setIsLoadingSummary(false)
      return
    }
  
    async function fetchModeratorSummary() {
      setIsLoadingSummary(true)
      try {
        const res = await fetch("/api/moderator/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ debateId, proCharacter, conCharacter }),
        })
        if (!res.ok) throw new Error("Failed to fetch moderator summary")
  
        const data = await res.json()
        setSummaryData({
          topic: data.topic || "토론 주제 없음",
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
  }, [debateId, proCharacter, conCharacter])  

  

  // ✅ 평가 생성 (버튼 클릭 시)
  // ✅ 평가 생성 (버튼 클릭 시)
  async function handleShowEvaluation() {
    if (!summaryData) return
    setIsLoadingEvaluation(true)

    try {
      const res = await fetch("/api/moderator/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debateId,
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

      // ✅ 영어 키 기준으로 안전하게 매핑
      setEvaluation({
        overall: data?.overall ?? "평가 없음",
        pro: data?.pro ?? "",
        con: data?.con ?? "",
        morePersuasive: data?.morePersuasive ?? "판단불가",
        reasoning: data?.reasoning ?? "평가 생성 실패",
      })
    } catch (err) {
      console.error("Error loading evaluation:", err)
      setEvaluation({
        overall: "평가 생성 실패",
        pro: "",
        con: "",
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
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="analyzing-badge p-8 rounded-full border-2 border-primary/50">
            <svg className="floating-icon w-16 h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">AI 사회자가 토론 내용을 분석 중입니다...</h2>
            <p className="text-muted-foreground">잠시만 기다려주세요</p>
          </div>

          <div className="flex gap-2 justify-center mt-4">
            <div className="loading-dot w-2 h-2 bg-primary rounded-full"></div>
            <div className="loading-dot w-2 h-2 bg-primary rounded-full"></div>
            <div className="loading-dot w-2 h-2 bg-primary rounded-full"></div>
          </div>
        </div>
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
          <Card className="p-8 space-y-6 backdrop-blur-sm bg-card/80 shadow-[0_0_20px] shadow-primary/30 border-border/50">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">AI 사회자 평가</h2>
              <span className="px-3 py-1 text-sm rounded-full bg-primary/20 text-primary font-medium">
                토론 종합 리포트
              </span>
            </div>

            {/* 전체 평가 */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-primary">🧭 전체 평가</h3>
              <p className="text-foreground/90 leading-relaxed">
                {evaluation.overall}
              </p>
            </section>

            <div className="grid md:grid-cols-2 gap-6">
              {/* 찬성측 평가 */}
              <section className="p-4 rounded-xl bg-foreground/5 border border-border/30">
                <h4 className="text-base font-semibold text-green-400 mb-2">찬성측 평가</h4>
                <p className="text-foreground/90 whitespace-pre-line">
                  {evaluation.pro}
                </p>
              </section>

              {/* 반대측 평가 */}
              <section className="p-4 rounded-xl bg-foreground/5 border border-border/30">
                <h4 className="text-base font-semibold text-red-400 mb-2">반대측 평가</h4>
                <p className="text-foreground/90 whitespace-pre-line">
                  {evaluation.con}
                </p>
              </section>
            </div>

            {/* 설득력 있는 주장 */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-yellow-400">🏆 설득력 있는 주장</h3>
              <p className="text-foreground/90">
                {evaluation.morePersuasive}
              </p>
            </section>

            {/* 선정 이유 */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-blue-400">📋 선정 이유</h3>
              <p className="text-foreground/90 whitespace-pre-line">
                {evaluation.reasoning}
              </p>
            </section>
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
