"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Play, Pause, SkipForward, Send } from "lucide-react"

type Message = {
  id: string
  side: "pro" | "con" | "user"
  content: string
  timestamp: number
}

const PRESET_PROMPTS = [
  "이 부분을 더 설명해줘",
  "구체적인 근거를 제시해줘",
  "반대 의견은 어떻게 반박할 수 있어?",
  "실제 사례를 들어줘",
]

export default function DebateScreen() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const topic = searchParams.get("topic") || ""
  const style = searchParams.get("style") || "logical"
  const maxTurns = 4//Number.parseInt(searchParams.get("turnCount") || "6", 10)
  const proCharacter = searchParams.get("proCharacter") || "논리적 분석가"
  const conCharacter = searchParams.get("conCharacter") || "비판적 토론가"
  const proStance = searchParams.get("proStance") || "찬성"
  const conStance = searchParams.get("conStance") || "반대"

  const [messages, setMessages] = useState<Message[]>([])
  const [currentTurn, setCurrentTurn] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [displayedContent, setDisplayedContent] = useState<string>("")
  const [isTyping, setIsTyping] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [userIntervention, setUserIntervention] = useState<string>("")
  const [showInterventionInput, setShowInterventionInput] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [isDebateComplete, setIsDebateComplete] = useState(false)
  const [debateId, setDebateId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const interventionInputRef = useRef<HTMLTextAreaElement>(null)

  const progress = (currentTurn / maxTurns) * 100

  // 타이핑 애니메이션
  useEffect(() => {
    if (isTyping && displayedContent.length < messages[messages.length - 1]?.content.length) {
      const timer = setTimeout(() => {
        const fullContent = messages[messages.length - 1].content
        setDisplayedContent(fullContent.slice(0, displayedContent.length + 1))
      }, 30)
      return () => clearTimeout(timer)
    } else if (isTyping) {
      setIsTyping(false)
    }
  }, [displayedContent, isTyping, messages])

  // Intervention input focus
  useEffect(() => {
    if (showInterventionInput && interventionInputRef.current) {
      interventionInputRef.current.focus()
    }
  }, [showInterventionInput])

  // AI 응답 생성
  const generateAIResponse = async (side: "pro" | "con", controller: AbortController) => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          side,
          character: side === "pro" ? proCharacter : conCharacter,
          style,
          conversationHistory: messages,
          userIntervention: userIntervention || null,
          debateId, // 기존 debateId 전달
          turn: {
            index: currentTurn + 1,
            total: maxTurns,
            isFinal: currentTurn + 1 === maxTurns,
            speaker: side,
          },
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error("Response failed")
      const data = await response.json()

      // 최초 debateId 저장
      if (!debateId && data.debateId) setDebateId(data.debateId)

      return data.text
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("[Debate] AI response generation cancelled by user")
        return null
      }
      console.error("[Debate] Error generating AI response:", error)
      return "죄송합니다. 응답을 생성하는 중 오류가 발생했습니다."
    } finally {
      setIsGenerating(false)
    }
  }

  // 턴 진행
  useEffect(() => {
    if (isPlaying && currentTurn < maxTurns && !isTyping && !isGenerating) {
      const timer = setTimeout(async () => {
        const side = currentTurn % 2 === 0 ? "pro" : "con"
        const controller = new AbortController()
        setAbortController(controller)
        setShowInterventionInput(true)

        const content = await generateAIResponse(side, controller)

        if (content === null) {
          setShowInterventionInput(true)
          return
        }

        if (content) {
          const newMessage: Message = {
            id: Date.now().toString(),
            side,
            content,
            timestamp: Date.now(),
          }
          setMessages((prev) => [...prev, newMessage])
          setDisplayedContent("")
          setIsTyping(true)
          setCurrentTurn((prev) => prev + 1)
          setUserIntervention("")
          setShowInterventionInput(true)
        }
      }, 1000)
      return () => clearTimeout(timer)
    } else if (currentTurn >= maxTurns && !isTyping && !isGenerating) {
      setIsPlaying(false)
      setIsDebateComplete(true)
      setShowInterventionInput(false)
    }
  }, [
    isPlaying,
    currentTurn,
    messages,
    isTyping,
    isGenerating,
    topic,
    style,
    proCharacter,
    conCharacter,
    maxTurns,
  ])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, displayedContent])

  const handleTogglePlay = () => setIsPlaying(!isPlaying)

  const handleSkip = async () => {
    if (currentTurn < maxTurns && !isTyping && !isGenerating) {
      const side = currentTurn % 2 === 0 ? "pro" : "con"
      const controller = new AbortController()
      const content = await generateAIResponse(side, controller)

      if (content) {
        const newMessage: Message = {
          id: Date.now().toString(),
          side,
          content,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, newMessage])
        setDisplayedContent(content)
        setCurrentTurn((prev) => prev + 1)
        setUserIntervention("")
        setShowInterventionInput(true)
      }
    }
  }

  const handleInterventionSubmit = async () => {
    if (!userIntervention.trim()) return
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }

    const interventionMessage: Message = {
      id: Date.now().toString(),
      side: "user",
      content: userIntervention,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, interventionMessage])
    setShowInterventionInput(false)
    setIsGenerating(false)
    setIsTyping(false)
    setDisplayedContent("")
    setTimeout(() => setIsPlaying(true), 500)
  }

  const handlePresetPrompt = (prompt: string) => {
    setUserIntervention(prompt)
    setTimeout(() => {
      if (abortController) {
        abortController.abort()
        setAbortController(null)
      }
      const interventionMessage: Message = {
        id: Date.now().toString(),
        side: "user",
        content: prompt,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, interventionMessage])
      setShowInterventionInput(false)
      setIsGenerating(false)
      setIsTyping(false)
      setDisplayedContent("")
      setUserIntervention("")
      setTimeout(() => setIsPlaying(true), 500)
    }, 100)
  }

  const handleViewResults = () => {
    if (!debateId) return alert("Debate ID가 없습니다.")
      router.push(
        `/results?debateId=${debateId}` +
          `&proCharacter=${encodeURIComponent(proCharacter)}` +
          `&conCharacter=${encodeURIComponent(conCharacter)}`
      )
  }

  const handleStartOver = () => router.push("/")

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" /> 돌아가기
          </Button>
          <h2 className="text-lg font-semibold text-foreground text-balance text-center flex-1 px-4">{topic}</h2>
          <div className="w-24 text-right text-sm text-muted-foreground">{currentTurn}/{maxTurns} 턴</div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-4 justify-center text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pro" />
            <span>찬성({proStance})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-con" />
            <span>반대({conStance})</span>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-4">
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1
            const content = isLastMessage && isTyping ? displayedContent : message.content
            return (
              <div key={message.id} className={`flex gap-4 ${message.side === "con" ? "flex-row-reverse" : ""} ${message.side === "user" ? "justify-center" : ""}`}>
                {message.side !== "user" && (
                  <Avatar className={`shrink-0 ${message.side === "pro" ? "bg-pro/20" : "bg-con/20"}`}>
                    <AvatarFallback className={message.side === "pro" ? "text-pro" : "text-con"}>
                      {message.side === "pro" ? "찬" : "반"}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`flex-1 ${message.side === "user" ? "max-w-xl" : "max-w-2xl"}`}>
                  {message.side !== "user" && (
                    <div
                      className={`text-xs text-muted-foreground mb-1 ${
                        message.side === "con" ? "text-right" : "text-left"
                      }`}
                    >
                      {message.side === "pro" ? proCharacter : conCharacter}
                    </div>
                  )}
                  <Card
                    className={`p-4 ${
                      message.side === "pro"
                        ? "bg-pro/10 border-pro/30"
                        : message.side === "con"
                          ? "bg-con/10 border-con/30"
                          : "bg-secondary/50 border-secondary"
                    }`}
                  >
                    <p className="text-foreground leading-relaxed">
                      {message.side === "user" && (
                        <span className="text-xs text-muted-foreground mr-2">👤 사용자:</span>
                      )}
                      {content}
                      {isLastMessage && isTyping && <span className="animate-pulse">|</span>}
                    </p>
                  </Card>
                </div>
              </div>
            )
          })}
          {isGenerating && (
            <div className="flex justify-center py-6">
              <div className="text-sm text-muted-foreground animate-pulse">AI가 응답을 생성하고 있습니다...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          {showInterventionInput && !isDebateComplete && (
            <div className="space-y-3 pb-2">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">사회자 영역 - 토론에 개입하기</p>
              </div>

              {/* Intervention Input */}
              <div className="space-y-3">
                {(isGenerating || !isPlaying) && (
                  <p className="text-xs text-muted-foreground text-center">
                    {isGenerating
                      ? "AI 응답 생성 중 개입하거나 아래 프리셋을 선택하세요"
                      : "토론을 일시정지 중입니다. 개입 내용을 입력하거나 재생을 눌러주세요"}
                  </p>
                )}
                <textarea
                  ref={interventionInputRef}
                  value={userIntervention}
                  onChange={(e) => setUserIntervention(e.target.value)}
                  placeholder="당신의 의견을 입력하면 AI 응답이 중단되고, 다음 턴에 반영됩니다..."
                  className="w-full p-3 bg-secondary border border-border/50 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                />
                <Button
                  onClick={handleInterventionSubmit}
                  disabled={!userIntervention.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Send className="w-4 h-4 mr-2" />
                  개입하기
                </Button>
              </div>

              {/* Preset Prompts - AI 생성 중에만 비활성화 */}
              <div className="flex flex-wrap gap-2 justify-center">
                {PRESET_PROMPTS.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetPrompt(prompt)}
                    disabled={isGenerating}
                    className={`text-sm border-border text-foreground bg-transparent ${
                      isGenerating ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"
                    }`}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {isDebateComplete && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">토론이 완료되었습니다!</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleViewResults} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  토론 결과 보기
                </Button>
                <Button
                  onClick={handleStartOver}
                  variant="outline"
                  className="border-border hover:bg-secondary text-foreground bg-transparent"
                >
                  다시하기
                </Button>
              </div>
            </div>
          )}

          {/* Play Controls - 토론 진행 중일 때만 표시, AI 생성 중 비활성화 */}
          {!isDebateComplete && (
            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleTogglePlay}
                disabled={currentTurn >= maxTurns || isTyping || isGenerating}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    일시정지
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    재생
                  </>
                )}
              </Button>
              <Button
                onClick={handleSkip}
                disabled={currentTurn >= maxTurns || isTyping || isGenerating}
                variant="outline"
                className="border-border hover:bg-secondary text-foreground"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                다음 턴
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
