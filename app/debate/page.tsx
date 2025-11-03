"use client"

import { Suspense } from "react"
import DebateScreen from "@/components/debate-screen"

export default function DebatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen gradient-bg flex items-center justify-center">
          <div className="text-foreground">로딩 중...</div>
        </div>
      }
    >
      <DebateScreen />
    </Suspense>
  )
}
