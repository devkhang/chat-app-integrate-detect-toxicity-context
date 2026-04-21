import { debounce } from "lodash";
import { useEffect, useState } from "react";

const HF_TOKEN = process.env.EXPO_PUBLIC_HF_TOKEN;

// ==================== DANH SÁCH VIẾT TẮT TOXIC TIẾNG VIỆT ====================
const vietSlangMap: Record<string, string> = {
  // Rất phổ biến
  "vl": "vãi lồn",
  "vcl": "vãi cặc lồn",
  "vãi": "vãi lồn",
  "dcm": "đụ mẹ",
  "đm": "đụ mẹ",
  "dm": "đụ mẹ",
  "dmm": "đụ mẹ mày",
  "cc": "cặc",
  "cl": "cặc lồn",
  "clgt": "cặc lồn gì thế",
  "cmm": "cặc mẹ mày",
  "cmmn": "cặc mẹ mày ngu",
  "đéo": "không",
  "deo": "không",
  "đcm": "đụ con mẹ",
  "đmm": "đụ mẹ mày",

  // Các biến thể khác
  "vclz": "vãi cặc lồn",
  "vclzz": "vãi cặc lồn",
  "lolz": "vãi lồn",
  "lmao": "vãi lồn",
  "wtf": "đụ mẹ",
};

function normalizeVietnameseSlang(text: string): string {
  let normalized = text.toLowerCase();

  // Thay thế từng slang (ưu tiên thay dài trước ngắn)
  Object.entries(vietSlangMap)
    .sort(([a], [b]) => b.length - a.length) // thay từ dài trước
    .forEach(([slang, full]) => {
      // Thay cả từ có dấu cách hai bên để tránh thay nhầm (ví dụ "cc" trong "ccode")
      const regex = new RegExp(`\\b${slang}\\b`, "gi");
      normalized = normalized.replace(regex, full);
    });

  return normalized;
}

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
      // ==================== XỬ LÝ VIẾT TẮT TRƯỚC KHI GỬI API ====================
      const normalizedText = normalizeVietnameseSlang(inputText);
      console.log("🔄 Original:", inputText);
      console.log("🔄 Normalized (sau xử lý slang):", normalizedText);

      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/textdetox/xlmr-large-toxicity-classifier",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: normalizedText }),   // ← gửi text đã normalize
        }
      );

      const rawText = await response.text();
      console.log("🔍 Raw Response từ HF:", rawText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${rawText}`);
      }

      let data = JSON.parse(rawText);

      const scores = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;

      const toxicItem = scores.find((item: any) =>
        item.label === "toxic" ||
        item.label.toLowerCase().includes("toxic") ||
        item.label === "LABEL_1"
      );

      const toxicScore = toxicItem ? toxicItem.score : 0;
      const isToxic = toxicScore > 0.6;   // bạn có thể chỉnh thành 0.5 nếu muốn nhạy hơn

      setResult({
        isToxic,
        score: toxicScore,
        warningText: isToxic
          ? `⚠️ Toxic (${(toxicScore * 100).toFixed(0)}%) - Tin nhắn này có thể gây tổn thương.`
          : "",
      });

      setStatus('ready');
    } catch (err: any) {
      console.error("❌ Toxic Detection API error:", err.message);
      setResult(null);
      setStatus('error');
    } finally {
      setIsAnalyzing(false);
    }
  }, 400);

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