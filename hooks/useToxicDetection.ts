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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('ready');

  const analyze = debounce(async (inputText: string) => {
    if (!inputText.trim()) {
      setResult(null);
      setStatus('ready');
      return;
    }

    setIsAnalyzing(true);
    setStatus('loading');

    try {
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/textdetox/xlmr-large-toxicity-classifier-v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: inputText }),
        }
      );

      const rawText = await response.text();
      console.log("🔍 Raw Response từ HF:", rawText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${rawText}`);
      }

      let data = JSON.parse(rawText);

      // Model này trả về mảng scores
      const scores = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;

      // Tìm nhãn toxic (thường là "toxic" hoặc "LABEL_1")
      const toxicItem = scores.find((item: any) => 
        item.label === "toxic" || 
        item.label.toLowerCase().includes("toxic") ||
        item.label === "LABEL_1"
      );
      
      const toxicScore = toxicItem ? toxicItem.score : 0;

      const isToxic = toxicScore > 0.6;

      setResult({
        isToxic,
        score: toxicScore,
        warningText: isToxic
          ? `✨ Toxic (${(toxicScore * 100).toFixed(0)}%) - Tin nhắn này có thể gây tổn thương.`
          : "",
      });

      setStatus('ready');
    } catch (err: any) {
      console.error("Toxic Detection API error:", err.message);
      setResult(null);
      setStatus('error');
    } finally {
      setIsAnalyzing(false);
    }
  }, 400);   // tăng nhẹ debounce vì model lớn

  useEffect(() => {
    analyze(text);
  }, [text]);

  const reset = () => {
    setText("");
    setResult(null);
    setStatus('ready');
  };

  return {
    text,
    setText,
    result,
    isAnalyzing,
    status,
    reset,
  };
}