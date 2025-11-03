"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Shuffle, Settings2 } from "lucide-react"
import { useRouter } from "next/navigation"

const DEBATE_STYLES = [
  { id: "emotional", label: "감정형", description: "공감/감정 중심. 감정 단어, 예시, 인간적 사례 활용" },
  { id: "logical", label: "논리형", description: "근거, 반례, 통계 중심 구조" },
  { id: "philosophical", label: "철학형", description: "질문과 가치 탐구 중심" },
]

const SAMPLE_TOPICS = [
  "인공지능은 인간의 일자리를 빼앗는가?",
  "소셜 미디어는 사회를 더 연결시키는가, 분열시키는가?",
  "기본소득제는 실현 가능한가?",
  "원격 근무가 미래의 표준이 되어야 하는가?",
  "우주 탐사에 막대한 예산을 투자해야 하는가?",
  "동물 실험은 윤리적으로 정당화될 수 있는가?",
]

const CHARACTER_PRESETS = {
  pro: [
    {
      id: "kant",
      label: "📜 칸트 (이성 중심 철학자)",
      prompt: "당신은 이마누엘 칸트입니다. 이성과 도덕 법칙을 중심으로 논리적이고 체계적으로 주장을 전개하세요.",
    },
    {
      id: "ceo",
      label: "💼 스타트업 CEO",
      prompt: "당신은 혁신과 효율을 중시하는 스타트업 CEO입니다. 실용적이고 미래지향적인 관점에서 주장하세요.",
    },
    {
      id: "scientist",
      label: "🔬 과학자",
      prompt: "당신은 데이터와 실증을 중시하는 과학자입니다. 객관적 근거와 연구 결과를 바탕으로 논리를 전개하세요.",
    },
  ],
  con: [
    {
      id: "hobbes",
      label: "⚙️ 홉스 (인간 본성 중심 철학자)",
      prompt: "당신은 토마스 홉스입니다. 인간의 본성과 현실적 제약을 중심으로 비판적으로 분석하세요.",
    },
    {
      id: "worker",
      label: "👷 평범한 중소기업 노동자",
      prompt: "당신은 현장에서 일하는 평범한 노동자입니다. 실생활의 어려움과 현실적 문제점을 중심으로 주장하세요.",
    },
    {
      id: "activist",
      label: "📢 사회운동가",
      prompt: "당신은 사회 정의를 추구하는 운동가입니다. 약자의 입장과 사회적 불평등 문제를 중심으로 비판하세요.",
    },
  ],
}

export default function HomePage() {
  const router = useRouter()
  const [topic, setTopic] = useState("")
  const [selectedStyle, setSelectedStyle] = useState<string>("logical")
  const [turnCount, setTurnCount] = useState<number>(6)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [proCharacter, setProCharacter] = useState("논리적 분석가로서 체계적이고 근거 기반의 주장을 전개하세요.")
  const [conCharacter, setConCharacter] = useState("비판적 사고가 강한 토론가로서 반론과 문제점을 날카롭게 지적하세요.")
  const [proStance, setProStance] = useState("")
  const [conStance, setConStance] = useState("")

  const handleRandomTopic = () => {
    const randomTopic = SAMPLE_TOPICS[Math.floor(Math.random() * SAMPLE_TOPICS.length)]
    setTopic(randomTopic)
  }
  const handleStartDebate = async () => {
    if (topic) {
      const stanceResponse = await fetch("/api/generate-stances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      })

      const stances = await stanceResponse.json()

      const params = new URLSearchParams({
        topic,
        style: selectedStyle,
        turnCount: turnCount.toString(),
        proStance: stances.proStance,
        conStance: stances.conStance,
      })
      router.push(`/debate?${params.toString()}`)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-balance">AI 논쟁 시뮬레이터</h1>
          </div>
        </div>

        {/* Main Card */}
        <Card className="p-8 space-y-6 backdrop-blur-sm bg-card/80 shadow-[0_0_15px] shadow-primary/30 border-border/50">
          {/* Topic Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">토론 주제</label>
            <div className="flex gap-2">
              <Input
                placeholder="토론하고 싶은 주제를 입력하세요..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="flex-1 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleRandomTopic}
                className="shrink-0 border-border hover:bg-secondary bg-transparent"
              >
                <Shuffle className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Debate Style Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">토론 스타일</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {DEBATE_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedStyle === style.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:border-border/80"
                  }`}
                >
                  <div className="font-semibold text-foreground">{style.label}</div>
                  <div className="text-sm text-muted-foreground mt-1">{style.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">토론 턴 수</label>
            <div className="flex gap-3">
              {[6, 8, 10].map((turn) => (
                <button
                  key={turn}
                  onClick={() => setTurnCount(turn)}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 text-sm ${
                    turnCount === turn
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                      : "bg-secondary/50 text-foreground hover:bg-secondary border border-border hover:border-primary/50"
                  }`}
                >
                  {turn}턴
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">AI 캐릭터 설정</label>
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Settings2 className="w-4 h-4" />
                    커스터마이징
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>AI 캐릭터 커스터마이징</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-6 py-4">
                    {/* Pro Side */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-pro" />
                        <h3 className="font-semibold text-foreground">찬성 측 AI</h3>
                      </div>

                      <Textarea
                        value={proCharacter}
                        onChange={(e) => setProCharacter(e.target.value)}
                        placeholder="찬성 측 AI의 성격과 논증 스타일을 설명하세요..."
                        className="min-h-[100px] bg-secondary/50"
                      />

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">프리셋 선택:</p>
                        <div className="flex flex-wrap gap-2">
                          {CHARACTER_PRESETS.pro.map((preset) => (
                            <Button
                              key={preset.id}
                              variant="outline"
                              size="sm"
                              onClick={() => setProCharacter(preset.prompt)}
                              className="text-sm"
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Con Side */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-con" />
                        <h3 className="font-semibold text-foreground">반대 측 AI</h3>
                      </div>

                      <Textarea
                        value={conCharacter}
                        onChange={(e) => setConCharacter(e.target.value)}
                        placeholder="반대 측 AI의 성격과 논증 스타일을 설명하세요..."
                        className="min-h-[100px] bg-secondary/50"
                      />

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">프리셋 선택:</p>
                        <div className="flex flex-wrap gap-2">
                          {CHARACTER_PRESETS.con.map((preset) => (
                            <Button
                              key={preset.id}
                              variant="outline"
                              size="sm"
                              onClick={() => setConCharacter(preset.prompt)}
                              className="text-sm"
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Button onClick={() => setIsModalOpen(false)} className="w-full">
                      적용하기
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-sm text-muted-foreground">찬성: 논리적 분석가 | 반대: 비판적 토론가</p>
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStartDebate}
            disabled={!topic}
            className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            토론 시작하기
          </Button>
        </Card>

        {/* Sample Topics */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">추천 주제</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {SAMPLE_TOPICS.slice(0, 4).map((sampleTopic, index) => (
              <button
                key={index}
                onClick={() => setTopic(sampleTopic)}
                className="px-3 py-1.5 text-sm rounded-full bg-secondary/50 hover:bg-secondary text-foreground border border-border/50 transition-colors"
              >
                {sampleTopic}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
