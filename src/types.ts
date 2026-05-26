export type DeckMode = "word" | "phrase" | "script";

export type TargetLanguageCode = "english" | "french" | "chinese";

export interface Flashcard {
  id: string;
  deckId: string;
  mode: DeckMode;
  
  // Fields compatible with all modes
  japanese: string;
  english: string;
  french: string;
  chinese: string;
  notes: string;
  
  // Mode-specific optional fields
  photo?: string;       // Word mode (image URL or base64)
  yaeyama?: string;     // Word mode (八重山方言)
  scene?: string;       // Script mode (シーン)
  
  // SM-2 Spaced Repetition (Used for Word and Phrase modes)
  interval: number;       // Days until next review
  easyFactor: number;     // Difficulty factor (defaults to 2.5)
  repetitions: number;    // Number of consecutive correct reviews
  nextReviewDate: string; // ISO date string (YYYY-MM-DD)
  lastGrade?: number;     // Last rating given by user (0-3 or 1-4)
}

export interface Deck {
  id: string;
  name: string;
  mode: DeckMode;
  createdAt: string;
  // User study configuration for this deck
  targetLanguages: TargetLanguageCode[]; // User selected target languages (e.g. ["english", "french"])
}

export interface AppState {
  decks: Deck[];
  cards: Flashcard[];
}

export type VoiceModelType = "browser" | "gemini";

export interface TTSConfig {
  voiceModel: VoiceModelType;     // "browser" or "gemini"
  geminiVoice: "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir"; // Default voice name
  playSpeed: number;              // 1.0, etc.
  autoplayDelaySec: number;       // Wait seconds between front and back, and next card
}

// Maps of languages to HTML5 SpeechSynthesis locales
export const LANGUAGE_LOCALES: Record<string, string> = {
  japanese: "ja-JP",
  english: "en-US",
  french: "fr-FR",
  chinese: "zh-CN",
  yaeyama: "ja-JP", // Yaeyama relies on Japanese TTS if standard, cooked with accent or slow tempo
  notes: "ja-JP",
};

export const LANGUAGE_NAMES: Record<string, string> = {
  japanese: "日本語",
  english: "英語",
  french: "フランス語",
  chinese: "中国語",
  yaeyama: "八重山方言 (島言葉)",
  notes: "解説メモ",
};
