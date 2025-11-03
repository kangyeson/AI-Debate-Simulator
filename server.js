import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Gemini API 요청용

dotenv.config(); // .env 파일 불러오기

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 기본 경로
app.get("/", (req, res) => {
  res.send("AI Debate Simulator 서버 실행 중!");
});

// Gemini API와 연결 테스트용 엔드포인트
app.post("/api/ask-gemini", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    // 상태코드가 실패면 에러 바디를 그대로 반환
    if (!response.ok) {
      return res.status(response.status).json({ error: "Gemini API 오류", details: data });
    }

    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // candidates가 비어있으면 원본 응답을 함께 반환해 원인 파악
    if (!replyText) {
      return res.json({ reply: "응답 없음", raw: data });
    }

    res.json({ reply: replyText });
  } catch (error) {
    console.error("Gemini API 오류:", error);
    res.status(500).json({ error: "Gemini API 요청 실패" });
  }
});

app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
