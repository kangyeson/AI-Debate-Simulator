"use client"

import { Suspense } from "react"
import ResultsScreen from "@/components/results-screen"

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen gradient-bg flex items-center justify-center">
          <div className="text-foreground">로딩 중...</div>
        </div>
      }
    >
      <ResultsScreen />
    </Suspense>
  )
}
