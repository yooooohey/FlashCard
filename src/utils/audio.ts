import { TTSConfig } from "../types";

export interface SpeakItem {
  text: string;
  langCode: string;
}

// Global browser TTS instance check
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudioElement: HTMLAudioElement | null = null;

export function stopAllSpeech(): void {
  // Stop browser synthesis
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  // Stop custom audio element synthesis
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.src = "";
    currentAudioElement = null;
  }
}

// 1. Play standard SpeechSynthesis with Promise
export function speakBrowserTTS(text: string, langKey: string, rate: number = 1.0): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }

    stopAllSpeech();

    const localeMap: Record<string, string> = {
      japanese: "ja-JP",
      english: "en-US",
      french: "fr-FR",
      chinese: "zh-CN",
      yaeyama: "ja-JP", // Yaeyama regional standard mapping
      notes: "ja-JP",
    };

    const locale = localeMap[langKey] || "ja-JP";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = rate;

    // Optional: slower rate for Yaeyama accent
    if (langKey === "yaeyama") {
      utterance.rate = rate * 0.85;
    }

    currentUtterance = utterance;

    utterance.onend = () => {
      currentUtterance = null;
      resolve();
    };

    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error details:", e);
      currentUtterance = null;
      resolve();
    };

    window.speechSynthesis.speak(utterance);

    // Hard fallback timeout just in case the browser SpeechSynthesis stalls
    const durationEstimate = (text.length * 400 * (1 / rate)) + 1500;
    setTimeout(() => {
      if (currentUtterance === utterance) {
        window.speechSynthesis.cancel();
        currentUtterance = null;
        resolve();
      }
    }, durationEstimate);
  });
}

// 2. Play base64 audio and resolve when audio ended
export function playBase64Audio(base64: string, mimeType: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      stopAllSpeech();

      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioElement = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
        resolve();
      };

      audio.onerror = (e) => {
        console.error("Audio tag playback failed:", e);
        URL.revokeObjectURL(url);
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
        resolve();
      };

      audio.play().catch((err) => {
        console.error("Audio playback prompt blocked or failed:", err);
        URL.revokeObjectURL(url);
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
        resolve();
      });
    } catch (err) {
      console.error("Base64 parsing failed in audio utility:", err);
      resolve();
    }
  });
}

// 3. Play high-quality Gemini voice translation over server proxy
export async function speakGeminiTTS(text: string, voiceName: string): Promise<void> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: voiceName }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || "Backend server TTS returned an invalid status.");
  }

  const data = await response.json();
  if (data.audio) {
    await playBase64Audio(data.audio, data.mimeType);
  } else {
    throw new Error("No inline audio data block found in the API response.");
  }
}

// 4. Sequential loop with 0.6s delay
export async function playTTSSequence(
  items: SpeakItem[],
  config: TTSConfig,
  onProgress?: (index: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.text?.trim()) continue;

    if (onProgress) {
      onProgress(i);
    }

    if (config.voiceModel === "gemini") {
      try {
        await speakGeminiTTS(item.text, config.geminiVoice);
      } catch (err) {
        console.warn("Gemini TTS failed, falling back gracefully to Browser Voice. Error:", err);
        await speakBrowserTTS(item.text, item.langCode, config.playSpeed);
      }
    } else {
      await speakBrowserTTS(item.text, item.langCode, config.playSpeed);
    }

    // Natural 0.6 seconds pause between consecutive fields to avoid overlapping
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
}

// 5. WakeLock screen keep-alive interface API
let wakeLockInstance: any = null;

export async function requestWakeLock(): Promise<void> {
  if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
    try {
      wakeLockInstance = await (navigator as any).wakeLock.request("screen");
      console.log("Device Screen WakeLock active successfully.");
    } catch (err: any) {
      console.warn("Failed to lock device screen keep-alive sentinel:", err.message);
    }
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (wakeLockInstance) {
    try {
      await wakeLockInstance.release();
      wakeLockInstance = null;
      console.log("Device Screen WakeLock released successfully.");
    } catch (err) {
      console.error("Error releasing WakeLock sentinel:", err);
    }
  }
}
