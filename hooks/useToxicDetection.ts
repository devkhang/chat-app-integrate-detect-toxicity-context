import { debounce } from "lodash";
import { useEffect, useState } from "react";

const HF_TOKEN = process.env.EXPO_PUBLIC_HF_TOKEN;

export function useToxicDetection() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    isToxic: boolean;
    score: number;
    warningText: string;
  } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ==================== NÂNG CẤP STATUS ====================
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [progress, setProgress] = useState(0);   // có thể dùng sau nếu muốn
  // ========================================================

  const analyze = debounce(async (inputText: string) => {
    if (!inputText.trim()) {
      setResult(null);
      setErrorMsg("");
      setStatus('ready');
      return;
    }

    // Bắt đầu phân tích
    setIsAnalyzing(true);
    setStatus('loading');
    setErrorMsg("");

    try {
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/unitary/toxic-bert",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: inputText }),
        },
      );

      const rawText = await response.text();
      console.log("🔍 Raw Response từ HF:", rawText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${rawText}`);
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error("Response không phải JSON");
      }

      let scores: { label: string; score: number }[] = [];

      if (Array.isArray(data) && Array.isArray(data[0])) {
        scores = data[0];
      } else if (Array.isArray(data)) {
        scores = data;
      }

      const toxicItem = scores.find((item) => item.label === "toxic");
      const toxicScore = toxicItem ? toxicItem.score : 0;

      const isToxic = toxicScore > 0.6;

      setResult({
        isToxic,
        score: toxicScore,
        warningText: isToxic
          ? `✨ Toxic (${(toxicScore * 100).toFixed(0)}%) - Your comment may be hurtful. Please consider revising it.`
          : "",
      });

      setStatus('ready');   // ← Thành công
    } catch (err: any) {
      console.error("Toxic-BERT API error:", err.message);
      setErrorMsg(err.message);
      setResult(null);
      setStatus('error');   // ← Lỗi
    } finally {
      setIsAnalyzing(false);
    }
  }, 300);

  useEffect(() => {
    analyze(text);
  }, [text]);

  const reset = () => {
    setText("");
    setResult(null);
    setErrorMsg("");
    setStatus('ready');
  };

  return {
    text,
    setText,
    result,
    isAnalyzing,
    errorMsg,
    reset,
    status,      // ← đã hoạt động thật
    progress,
  };
}