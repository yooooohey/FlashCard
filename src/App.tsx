import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Menu,
  X,
  Plus,
  Play,
  Pause,
  RotateCw,
  Volume2,
  ArrowLeft,
  Globe,
  HelpCircle,
  RefreshCw,
  FileText,
  Check,
  Image as ImageIcon,
  Trash2,
  Sliders,
  LogOut,
  ChevronRight,
  Search,
  BookOpen,
  Calendar,
  Layers,
  Heart,
  Save,
  AlertCircle,
  Eye,
  Info,
  Frown,
  Smile,
  Zap,
  Edit3,
  Flag
} from "lucide-react";
import { Deck, Flashcard, DeckMode, TargetLanguageCode, TTSConfig, LANGUAGE_NAMES } from "./types";
import { defaultDecks, defaultCards } from "./defaultData";
import {
  speakBrowserTTS,
  speakGeminiTTS,
  playTTSSequence,
  stopAllSpeech,
  requestWakeLock,
  releaseWakeLock
} from "./utils/audio";

export default function App() {
  // --- Persistent Base State Models ---
  const [decks, setDecks] = useState<Deck[]>(() => {
    const local = localStorage.getItem("ankiflow_decks");
    return local ? JSON.parse(local) : defaultDecks;
  });

  const [cards, setCards] = useState<Flashcard[]>(() => {
    const local = localStorage.getItem("ankiflow_cards");
    return local ? JSON.parse(local) : defaultCards;
  });

  // --- TTS configuration state (Default parameters) ---
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>(() => {
    const local = localStorage.getItem("ankiflow_tts_config");
    return local ? JSON.parse(local) : {
      voiceModel: "browser",
      geminiVoice: "Kore",
      playSpeed: 1.0,
      autoplayDelaySec: 2,
    };
  });

  // --- Active environments context states ---
  const [selectedDeckId, setSelectedDeckId] = useState<string>(() => {
    const local = localStorage.getItem("ankiflow_selected_deck_id");
    if (local) return local;
    return defaultDecks[0]?.id || "";
  });

  // Navigation / Panel UI controls
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showConfigCheck, setShowConfigCheck] = useState(false);
  const [configStatus, setConfigStatus] = useState({ geminiInitialized: false, appUrl: "" });
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Active Deck Generation State
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);
  const [generateTheme, setGenerateTheme] = useState("");
  const [generateCount, setGenerateCount] = useState(5);
  const [generateMode, setGenerateMode] = useState<DeckMode>("word");

  // New deck creation forms
  const [showAddDeckForm, setShowAddDeckForm] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckMode, setNewDeckMode] = useState<DeckMode>("word");

  // Single card custom form parameters
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [newCardJapanese, setNewCardJapanese] = useState("");
  const [newCardEnglish, setNewCardEnglish] = useState("");
  const [newCardFrench, setNewCardFrench] = useState("");
  const [newCardChinese, setNewCardChinese] = useState("");
  const [newCardNotes, setNewCardNotes] = useState("");
  // Optional mode variables
  const [newCardYaeyama, setNewCardYaeyama] = useState("");
  const [newCardPhoto, setNewCardPhoto] = useState("");
  const [newCardScene, setNewCardScene] = useState("");
  const [imageGenerationPrompt, setImageGenerationPrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Active review session state structures
  const [activeSessionDeck, setActiveSessionDeck] = useState<Deck | null>(null);
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAutoplayRunning, setIsAutoplayRunning] = useState(false);
  const [ttsProgressIndex, setTtsProgressIndex] = useState<number>(-1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "due">("all");

  // AI detail explainer (Grounded search response drawer)
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [explainerContent, setExplainerContent] = useState("");
  const [explainerReferences, setExplainerReferences] = useState<any[]>([]);
  const [isLoadingExplainer, setIsLoadingExplainer] = useState(false);

  // Quick Pronunciation Preview Modal State (Automatic closing returner)
  const [quickPreviewCard, setQuickPreviewCard] = useState<Flashcard | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);

  // Spreadsheet GAS Configuration settings
  const [gasWebhookUrl, setGasWebhookUrl] = useState(() => {
    return localStorage.getItem("ankiflow_gas_url") || "";
  });
  const [syncJsonInput, setSyncJsonInput] = useState("");
  const [isSyncingGas, setIsSyncingGas] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Autoplay timers
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Storage synchronizer triggers ---
  useEffect(() => {
    localStorage.setItem("ankiflow_decks", JSON.stringify(decks));
  }, [decks]);

  useEffect(() => {
    localStorage.setItem("ankiflow_cards", JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    localStorage.setItem("ankiflow_tts_config", JSON.stringify(ttsConfig));
  }, [ttsConfig]);

  useEffect(() => {
    localStorage.setItem("ankiflow_selected_deck_id", selectedDeckId);
  }, [selectedDeckId]);

  useEffect(() => {
    localStorage.setItem("ankiflow_gas_url", gasWebhookUrl);
  }, [gasWebhookUrl]);

  // Check state of system key on boot
  useEffect(() => {
    fetch("/api/config-check")
      .then((r) => r.json())
      .then((data) => {
        setConfigStatus(data);
        if (!data.geminiInitialized) {
          // If gemini not initialized, switch default back to standard browser
          setTtsConfig((prev) => ({ ...prev, voiceModel: "browser" }));
        }
      })
      .catch((err) => console.warn("Failed config check fetching:", err));
  }, []);

  // Set transient toast notifications
  const triggerToast = (msg: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage({ msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const selectedDeck = decks.find((d) => d.id === selectedDeckId);
  const selectedDeckCards = cards.filter((c) => c.deckId === selectedDeckId);

  // Compute number of cards due today under SM-2 algorithm
  const getDueCardsCount = (deckId: string) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const deckCards = cards.filter((c) => c.deckId === deckId);
    if (!deckCards.length) return 0;
    
    return deckCards.filter((c) => {
      if (c.mode === "script") return false; // Script mode does not use due intervals
      return !c.nextReviewDate || c.nextReviewDate <= todayStr;
    }).length;
  };

  // --- Active Deck & Cards Management Actions ---
  const handleCreateDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      name: newDeckName.trim(),
      mode: newDeckMode,
      createdAt: new Date().toISOString(),
      targetLanguages: ["english"], // defaulted to English
    };

    setDecks((prev) => [...prev, newDeck]);
    setSelectedDeckId(newDeck.id);
    setNewDeckName("");
    setShowAddDeckForm(false);
    setIsDrawerOpen(false);
    triggerToast(`デッキ「${newDeck.name}」を作成しました`, "success");
  };

  const handleDeleteDeck = (deckId: string) => {
    if (window.confirm("このデッキと、すべての暗記カードを完全に削除しますか？")) {
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      setCards((prev) => prev.filter((c) => c.deckId !== deckId));
      if (selectedDeckId === deckId) {
        setSelectedDeckId(decks[0]?.id || "");
      }
      triggerToast("デッキと所属カードをすべて削除しました", "info");
    }
  };

  const deleteCard = (cardId: string) => {
    if (window.confirm("このフラッシュカードを削除しますか？")) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      triggerToast("カードを削除しました", "success");
    }
  };

  const deleteCardAndCloseEdit = (cardId: string) => {
    if (window.confirm("このフラッシュカードを削除しますか？")) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setEditingCard(null);
      triggerToast("カードを削除しました", "success");
    }
  };

  const handleUpdateCard = (updatedCard: Flashcard) => {
    if (!updatedCard.japanese.trim()) {
      triggerToast("日本語の入力は必須です", "error");
      return;
    }
    setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));
    setEditingCard(null);
    triggerToast("カードを更新しました", "success");
  };

  const handleCreateCardManually = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeck) return;
    if (!newCardJapanese.trim()) {
      triggerToast("日本語の入力は必須です", "error");
      return;
    }

    const newCard: Flashcard = {
      id: `card-${Date.now()}`,
      deckId: selectedDeckId,
      mode: selectedDeck.mode,
      japanese: newCardJapanese.trim(),
      english: newCardEnglish.trim(),
      french: newCardFrench.trim(),
      chinese: newCardChinese.trim(),
      notes: newCardNotes.trim(),
      yaeyama: selectedDeck.mode === "word" ? newCardYaeyama.trim() : undefined,
      photo: selectedDeck.mode === "word" ? newCardPhoto.trim() : undefined,
      scene: selectedDeck.mode === "script" ? newCardScene.trim() : undefined,
      
      interval: 1,
      easyFactor: 2.5,
      repetitions: 0,
      nextReviewDate: new Date().toISOString().split("T")[0],
    };

    setCards((prev) => [...prev, newCard]);
    // reset fields
    setNewCardJapanese("");
    setNewCardEnglish("");
    setNewCardFrench("");
    setNewCardChinese("");
    setNewCardNotes("");
    setNewCardYaeyama("");
    setNewCardPhoto("");
    setNewCardScene("");
    setShowAddCardForm(false);
    triggerToast("新規カードを1件追加しました", "success");
  };

  // AI illustration generation tool caller
  const triggerAIImageGeneration = async () => {
    if (!newCardJapanese.trim() && !imageGenerationPrompt.trim()) {
      triggerToast("イラストのイメージを掴むため、日本語単語、またはプロンプトを入力してください", "info");
      return;
    }

    const keyword = imageGenerationPrompt.trim() || newCardJapanese.trim();
    setIsGeneratingImage(true);
    triggerToast(`${keyword} の極簡イラストをAIで生成中...`, "info");

    try {
      const resp = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: keyword }),
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || "Image generation failure");
      }

      const data = await resp.json();
      if (data.imageUrl) {
        setNewCardPhoto(data.imageUrl);
        triggerToast("AIイラストの生成とバインドに成功しました！", "success");
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`画像生成エラー: ${err.message || "通信エラー"}`, "error");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Toggle selected training language tags
  const toggleLanguageOption = (lang: TargetLanguageCode) => {
    if (!selectedDeck) return;
    let updatedLangs = [...selectedDeck.targetLanguages];
    if (updatedLangs.includes(lang)) {
      if (updatedLangs.length === 1) {
        triggerToast("少なくとも1つの外国語を有効化してください", "info");
        return;
      }
      updatedLangs = updatedLangs.filter((l) => l !== lang);
    } else {
      updatedLangs.push(lang);
    }

    setDecks((prev) =>
      prev.map((d) => (d.id === selectedDeck.id ? { ...d, targetLanguages: updatedLangs } : d))
    );
    triggerToast("ターゲット言語構成を保存しました", "success");
  };

  // --- GAS & JSON Spreadsheet Double-Channel Synchronizers ---
  const handleJsonSyncImport = () => {
    try {
      const data = JSON.parse(syncJsonInput);
      if (Array.isArray(data.decks) && Array.isArray(data.cards)) {
        setDecks(data.decks);
        setCards(data.cards);
        triggerToast("JSONデータからすべてのデッキとカードを復元・インポートしました！", "success");
        setSyncModalOpen(false);
        setSyncJsonInput("");
      } else {
        triggerToast("フォーマットが不正です。decks と cards 配列が含まれているか確認してください。", "error");
      }
    } catch (err: any) {
      triggerToast("JSONパースに失敗しました。構文のエラーを修正してください。", "error");
    }
  };

  const copyCurrentBackupJson = () => {
    const fullObj = { decks, cards };
    navigator.clipboard.writeText(JSON.stringify(fullObj, null, 2));
    triggerToast("現在の全バックアップ用JSONをクリップボードにコピーしました！", "success");
  };

  // Send request to GAS deployment Web App
  const syncWithGasSpreadsheet = async (action: "sync_to_sheet" | "fetch_from_sheet") => {
    if (!gasWebhookUrl.trim()) {
      triggerToast("GAS WebアプリURLが未入力です。設定するか、安全なJSONバックアップをご利用ください。", "error");
      return;
    }

    setIsSyncingGas(true);
    triggerToast("Googleスプレッドシートへの通信を実行中...", "info");

    try {
      const requestPayload = {
        action,
        decks,
        cards,
      };

      const response = await fetch(gasWebhookUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain" }, // Avoid CORS Preflight options check safely
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error("HTTP connection failed or CORS blocked access.");
      }

      const responseText = await response.text();
      const output = JSON.parse(responseText);

      if (output.status === "success") {
        if (action === "sync_to_sheet") {
          triggerToast(`スプレッドシートへアプリ内データの一括同期に成功しました！(デッキ数: ${output.count})`, "success");
        } else {
          if (output.decks && output.cards) {
            setDecks(output.decks);
            setCards(output.cards);
            triggerToast(`スプレッドシートから最新データの取り込みに成功しました！ (${output.cards.length} 枚のカード)`, "success");
          } else {
            throw new Error("Invalid structure from spreadsheet response.");
          }
        }
        setSyncModalOpen(false);
      } else {
        throw new Error(output.message || "Internal GAS error.");
      }
    } catch (err: any) {
      console.error("Fetch synced err:", err);
      triggerToast(
        "通信エラー: CORS通信が遮断されました。GASの公開範囲が全員(Anyone)に設定されているかご確認ください。 または、下部のアプローチA: JSONコピペ同期をお試しください！",
        "error"
      );
    } finally {
      setIsSyncingGas(false);
    }
  };

  // --- AI Bulk Deck Generation Action using Gemini Model ---
  const handleAIBulkDeckGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateTheme.trim()) {
      triggerToast("生成したいテーマを入力してください (例: カフェでの接客, 基本旅行動詞, etc.)", "info");
      return;
    }

    setIsGeneratingDeck(true);
    triggerToast(`AIがテーマ「${generateTheme}」に基づき${generateCount}枚の精細カードを自動構築しています...`, "info");

    try {
      const response = await fetch("/api/generate-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: generateTheme,
          mode: generateMode,
          count: generateCount,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "AI Generation service error on backend.");
      }

      const responseJson = await response.json();
      if (responseJson && Array.isArray(responseJson.cards)) {
        // Create an elegant wrapper deck
        const newDeckId = `ai-deck-${Date.now()}`;
        const newDeck: Deck = {
          id: newDeckId,
          name: `✨ AI: ${generateTheme} (${generateMode === "word" ? "単語" : generateMode === "phrase" ? "翻訳フレーズ" : "台本戯曲"})`,
          mode: generateMode,
          createdAt: new Date().toISOString(),
          targetLanguages: ["english", "french", "chinese"],
        };

        const generatedList: Flashcard[] = responseJson.cards.map((c: any, index: number) => ({
          id: `ai-card-${Date.now()}-${index}`,
          deckId: newDeckId,
          mode: generateMode,
          japanese: c.japanese || "",
          english: c.english || "",
          french: c.french || "",
          chinese: c.chinese || "",
          yaeyama: c.yaeyama || "",
          notes: c.notes || "",
          scene: c.scene || "",
          photo: "", // Empty so users can trigger illustrations
          interval: 1,
          easyFactor: 2.5,
          repetitions: 0,
          nextReviewDate: new Date().toISOString().split("T")[0],
        }));

        setDecks((prev) => [...prev, newDeck]);
        setCards((prev) => [...prev, ...generatedList]);
        setSelectedDeckId(newDeckId);
        setGenerateTheme("");
        setIsDrawerOpen(false);
        triggerToast(`新しいAI構築デッキ「${newDeck.name}」を作成しました！(構築カード: ${generatedList.length} 件)`, "success");
      } else {
        throw new Error("Not a typical format array of cards.");
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`AIデッキ生成エラー: ${err.message || "通信エラー"}`, "error");
    } finally {
      setIsGeneratingDeck(false);
    }
  };

  // --- Active Interactive Card Review Engine & Sound loops ---
  const launchReviewSession = (modeOption: "all" | "due" = "all") => {
    if (!selectedDeck) return;
    setReviewFilter(modeOption);

    let subset = [...selectedDeckCards];
    
    // Sort logic
    if (selectedDeck.mode === "script") {
      // Script mode retains theatrical sequence order strictly
      subset.sort((a, b) => {
        const sceneA = a.scene || "";
        const sceneB = b.scene || "";
        return sceneA.localeCompare(sceneB, "ja");
      });
    } else {
      // Word/Phrase modes
      if (modeOption === "due") {
        const todayStr = new Date().toISOString().split("T")[0];
        subset = subset.filter((c) => !c.nextReviewDate || c.nextReviewDate <= todayStr);
      }
      
      // Shuffle slightly or sort based on intervals
      subset.sort((a, b) => (a.interval || 0) - (b.interval || 0));
    }

    if (!subset.length) {
      triggerToast(modeOption === "due" ? "本日中に復習する必要があるカードはありません！" : "デッキにカードが存在しません。", "info");
      return;
    }

    setActiveSessionDeck(selectedDeck);
    setSessionCards(subset);
    setCurrentSessionIndex(0);
    setIsFlipped(false);
    setTtsProgressIndex(-1);
    setIsSpeaking(false);
    stopAllSpeech();

    // Default ON: Autoplay mode is true immediately as requested!
    setIsAutoplayRunning(true);
  };

  const closeReviewSession = () => {
    stopAutoplayLoop();
    setActiveSessionDeck(null);
    setSessionCards([]);
    setCurrentSessionIndex(0);
    setIsFlipped(false);
    setTtsProgressIndex(-1);
    setIsSpeaking(false);
    releaseWakeLock();
    stopAllSpeech();
  };

  // Autoplay control loop effect
  useEffect(() => {
    if (activeSessionDeck) {
      if (isAutoplayRunning) {
        requestWakeLock();
        startAutoplayLoop();
      } else {
        stopAutoplayLoop();
        releaseWakeLock();
      }
    }
    return () => {
      stopAutoplayLoop();
    };
  }, [activeSessionDeck, isAutoplayRunning, currentSessionIndex, isFlipped]);

  // Initial card loaded TTS activation on session state transitions
  useEffect(() => {
    if (activeSessionDeck && sessionCards.length > 0) {
      triggerSpeechSynthesisForActiveSide();
    }
  }, [activeSessionDeck, currentSessionIndex, isFlipped]);

  const startAutoplayLoop = () => {
    stopAutoplayLoop();

    // Wait for voice playback to be completely finished, then transit standard wait delay
    // This is handled reactively by checking whether speaker loop is running.
  };

  const stopAutoplayLoop = () => {
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  };

  // Dynamic Sequential Voice Generator
  const triggerSpeechSynthesisForActiveSide = async () => {
    if (!activeSessionDeck || sessionCards.length === 0) return;
    const activeCard = sessionCards[currentSessionIndex];
    if (!activeCard) return;

    stopAllSpeech();
    setIsSpeaking(true);
    setTtsProgressIndex(-1);

    const checkLanguages = activeSessionDeck.targetLanguages || ["english"];
    const textQueue: { text: string; langCode: string }[] = [];

    if (!isFlipped) {
      // --- SURFACE SIDE PLAYBACK (Foreign Target Languages First) ---
      checkLanguages.forEach((lang) => {
        const val = activeCard[lang as keyof Flashcard];
        if (typeof val === "string" && val.trim()) {
          textQueue.push({ text: val, langCode: lang });
        }
      });
    } else {
      // --- BACK SIDE PLAYBACK (Japanese & Yaeyama & Notes) ---
      // 1. Japanese Always
      textQueue.push({ text: activeCard.japanese, langCode: "japanese" });
      
      // 2. Yaeyama Island Dialect if exists and Word Mode
      if (activeSessionDeck.mode === "word" && activeCard.yaeyama) {
        textQueue.push({ text: activeCard.yaeyama, langCode: "yaeyama" });
      }

      // Play structural explanatory notes
      if (activeCard.notes && activeCard.notes.trim()) {
        textQueue.push({ text: activeCard.notes, langCode: "notes" });
      }
    }

    try {
      await playTTSSequence(textQueue, ttsConfig, (idx) => {
        setTtsProgressIndex(idx);
      });
    } catch (err) {
      console.warn("TTS flow interrupted or completed:", err);
    } finally {
      setIsSpeaking(false);
      setTtsProgressIndex(-1);

      // Handle Autoplay Next transitions ONLY when speaking of current card completes
      if (isAutoplayRunning && activeSessionDeck) {
        stopAutoplayLoop();
        
        autoplayTimerRef.current = setTimeout(() => {
          if (!isFlipped) {
            // Flip to back
            setIsFlipped(true);
          } else {
            // Proceed to next card
            if (currentSessionIndex < sessionCards.length - 1) {
              setIsFlipped(false);
              setCurrentSessionIndex((prev) => prev + 1);
            } else {
              // Loop finished!
              triggerToast("全てのカードの学習サイクルが完了しました！", "success");
              setIsAutoplayRunning(false);
            }
          }
        }, ttsConfig.autoplayDelaySec * 1000);
      }
    }
  };

  // Review Spaced Repetition grade submitter (SuperMemo SM-2)
  const submitCardReviewGrade = (grade: number) => {
    if (!activeSessionDeck || sessionCards.length === 0) return;
    const activeCard = sessionCards[currentSessionIndex];
    if (!activeCard) return;

    // Recalculate intervals and scale parameters
    const updatedFactor = activeCard.easyFactor || 2.5;
    const prevRep = activeCard.repetitions || 0;
    const prevInt = activeCard.interval || 1;

    // calculate standard SuperMemo parameters
    const nextParams = calculateNextSM2Interval(grade, prevInt, updatedFactor, prevRep);

    const today = new Date();
    today.setDate(today.getDate() + nextParams.interval);
    const nextDateStr = today.toISOString().split("T")[0];

    setCards((prev) =>
      prev.map((c) =>
        c.id === activeCard.id
          ? {
              ...c,
              interval: nextParams.interval,
              easyFactor: nextParams.easyFactor,
              repetitions: nextParams.repetitions,
              nextReviewDate: nextDateStr,
              lastGrade: grade,
            }
          : c
      )
    );

    triggerToast(`次回の復習: ${nextParams.interval}日後 (EF: ${nextParams.easyFactor})`, "info");
    goToNextSessionCard();
  };

  const calculateNextSM2Interval = (
    grade: number,
    prevInterval: number,
    prevFactor: number,
    repetitions: number
  ) => {
    // Grade rating maps from 1 to 4:
    // 1: Again (FAIL)
    // 2: Hard (PASS with heavy review)
    // 3: Good (PASS standard)
    // 4: Easy (PASS absolute clear)
    
    let nextRepetitions = 0;
    let nextInterval = 1;
    let nextFactor = prevFactor;

    if (grade >= 2) {
      if (repetitions === 0) {
        nextInterval = 1;
      } else if (repetitions === 1) {
        nextInterval = 3;
      } else {
        nextInterval = Math.round(prevInterval * prevFactor);
      }
      nextRepetitions = repetitions + 1;
    } else {
      nextRepetitions = 0;
      nextInterval = 1;
    }

    // Map 1..4 to standard rating 2..5 to calculate standard EF shifts
    const q = grade + 1; 
    nextFactor = prevFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (nextFactor < 1.3) {
      nextFactor = 1.3;
    }

    return {
      interval: nextInterval,
      easyFactor: Number(nextFactor.toFixed(2)),
      repetitions: nextRepetitions,
    };
  };

  const goToNextSessionCard = () => {
    stopAutoplayLoop();
    if (currentSessionIndex < sessionCards.length - 1) {
      setIsFlipped(false);
      setCurrentSessionIndex((prev) => prev + 1);
    } else {
      triggerToast("学習完了！ダッシュボードへ戻ります", "success");
      closeReviewSession();
    }
  };

  const goToPrevSessionCard = () => {
    stopAutoplayLoop();
    if (currentSessionIndex > 0) {
      setIsFlipped(false);
      setCurrentSessionIndex((prev) => prev - 1);
    }
  };

  // --- Quick Preview with Automated Closure Returner ---
  const launchQuickPreview = (card: Flashcard) => {
    if (!selectedDeck) return;
    stopAllSpeech();
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    setQuickPreviewCard(card);

    // Audio target voice plays specifically on launch to maximize speed, ignoring standard standard
    const targetLangs = selectedDeck.targetLanguages || ["english"];
    const playLangsQueue: { text: string; langCode: string }[] = [];

    targetLangs.forEach((lang) => {
      const val = card[lang as keyof Flashcard];
      if (typeof val === "string" && val.trim()) {
        playLangsQueue.push({ text: val, langCode: lang });
      }
    });

    if (playLangsQueue.length > 0) {
      // Execute play queue for quick target testing
      playTTSSequence(playLangsQueue, ttsConfig);
    }

    // Set auto closing sentinel precisely after 3.5 seconds
    previewTimeoutRef.current = setTimeout(() => {
      setQuickPreviewCard(null);
      stopAllSpeech();
    }, 3500);
  };

  const closeQuickPreviewPrematurely = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    setQuickPreviewCard(null);
    stopAllSpeech();
  };

  // --- AI Grounded Search Explainer fetcher ---
  const triggerGroundedAIExplanation = async (card: Flashcard) => {
    setIsExplainerOpen(true);
    setIsLoadingExplainer(true);
    setExplainerContent("");
    setExplainerReferences([]);

    try {
      const resp = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card }),
      });

      if (!resp.ok) {
        throw new Error("Failed to receive structured search analysis from server");
      }

      const data = await resp.json();
      setExplainerContent(data.explanation || "No explanation text generated.");
      setExplainerReferences(data.references || []);
    } catch (err: any) {
      console.error(err);
      setExplainerContent(`解説作成中にエラーが発生しました: ${err.message || "通信エラー"}\nAPIキーが正しくSecretsに設定されているかご確認ください。`);
    } finally {
      setIsLoadingExplainer(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#020203] text-[#F9FAFB] font-sans flex flex-col overflow-x-hidden relative">
      
      {/* Immersive Theme Glowing background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[45%] h-[45%] bg-indigo-900/15 rounded-full blur-[140px]"></div>
        <div className="absolute top-[50%] -right-[5%] w-[35%] h-[35%] bg-emerald-950/10 rounded-full blur-[110px]"></div>
      </div>

      {/* --- FLOATING TOAST --- */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 bg-[#0a0a0c]/90 border border-white/10 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md max-w-sm animate-fade-in">
          {toastMessage.type === "success" && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />}
          {toastMessage.type === "error" && <div className="w-2.5 h-2.5 rounded-full bg-red-400" />}
          {toastMessage.type === "info" && <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />}
          <span className="text-xs font-medium tracking-wide text-white/90">{toastMessage.msg}</span>
        </div>
      )}

      {/* --- FLOATING QUICK PREVIEW MODAL (3.5 SEC DISMISSAL) --- */}
      {quickPreviewCard && (
        <div className="fixed inset-0 bg-[#020203]/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 animate-fade-in">
          <button 
            onClick={closeQuickPreviewPrematurely}
            className="absolute top-8 right-8 px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/60 tracking-widest uppercase transition-all"
          >
            閉じる (ESC)
          </button>
          
          <div className="text-center max-w-3xl space-y-10">
            <span className="px-5 py-1.5 rounded-full bg-white/5 border border-white/15 text-[10px] text-white/40 tracking-widest uppercase">
              極大発音プレビュー
            </span>

            <div className="space-y-6">
              {/* Center extreme scale foreign language translation */}
              <h2 className="text-5xl md:text-8xl font-bold tracking-tighter text-indigo-400 drop-shadow-[0_0_40px_rgba(99,102,241,0.25)] break-words">
                {selectedDeck?.targetLanguages.map((lang) => quickPreviewCard[lang as keyof Flashcard]).filter(Boolean).join(" / ") || "No Foreign Target Enabled"}
              </h2>

              {/* Japanese helper below */}
              <div className="space-y-2 mt-4">
                <p className="text-2xl font-light text-white/80">{quickPreviewCard.japanese}</p>
                {quickPreviewCard.yaeyama && (
                  <p className="text-lg italic text-emerald-400">島言葉: {quickPreviewCard.yaeyama}</p>
                )}
              </div>
            </div>

            <div className="h-0.5 w-24 bg-white/10 mx-auto"></div>

            <p className="text-xs text-white/35 tracking-widest uppercase animate-pulse">
              ターゲット外国語の再生中... 3秒後に自動的に帰還します
            </p>
          </div>
        </div>
      )}

      {/* --- IMMERSIVE FULL-SCREEN LEARNING VIEW --- */}
      {activeSessionDeck && sessionCards.length > 0 ? (
        <div className="fixed inset-0 bg-[#020203] text-[#F9FAFB] flex flex-col z-40 overflow-hidden animate-fade-in">
          
          {/* Subtle decoration elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[15%] -left-[10%] w-[50%] h-[50%] bg-indigo-950/25 rounded-full blur-[150px]"></div>
            <div className="absolute bottom-[10%] -right-[5%] w-[40%] h-[40%] bg-emerald-950/15 rounded-full blur-[130px]"></div>
          </div>

          {/* Session Header Controls - Hidden during autoplay for distraction-free view */}
          {!isAutoplayRunning ? (
            <div className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-white/5 bg-black/40 backdrop-blur-xl z-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={closeReviewSession}
                  className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:text-white cursor-pointer transition-all flex items-center justify-center shadow-sm"
                  title="離脱する"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-xs text-white/40 font-medium italic truncate max-w-[150px] sm:max-w-none">
                  {activeSessionDeck.name}
                </span>
              </div>

              {/* Live Autoplay State Indicator badge */}
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  onClick={() => setIsAutoplayRunning((prev) => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[10px] font-bold uppercase tracking-widest ${
                    isAutoplayRunning
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-white/5 border-white/10 text-white/40"
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  Auto-Play Off
                </button>

                <span className="text-xs text-white/40 uppercase tracking-widest text-[10px] hidden sm:inline">
                  {currentSessionIndex + 1} / {sessionCards.length} Cards
                </span>
              </div>
            </div>
          ) : (
            /* Floating controls absolute overhead during pristine autoplay experience */
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2 p-1">
              <span className="text-[10px] text-white/30 tracking-widest uppercase bg-black/55 border border-white/5 rounded-full px-3 py-1 font-mono">
                {currentSessionIndex + 1} / {sessionCards.length}
              </span>
              <button
                onClick={() => setIsAutoplayRunning(false)}
                className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-lg cursor-pointer transition-all flex items-center justify-center animate-pulse"
                title="一時停止"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Centered Primary Flashcard Body */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10 select-none">
            
            {/* Top metadata tracking index indicators */}
            {!isAutoplayRunning && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-4">
                <span className="px-4 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40 tracking-widest uppercase">
                  {activeSessionDeck.mode === "word" ? "名詞・単語" : activeSessionDeck.mode === "phrase" ? "トラベルフレーズ" : "台本演劇ストーリー"}
                </span>
                {sessionCards[currentSessionIndex].scene && (
                  <span className="px-4 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] text-indigo-300 tracking-wider">
                    {sessionCards[currentSessionIndex].scene}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-col items-center text-center space-y-4 md:space-y-8 max-w-4xl w-full px-4 py-2">
              
              {/* Optional Word Mode Custom AI Photo Asset on Front Side along with Foreign Language */}
              {!isFlipped && activeSessionDeck.mode === "word" && sessionCards[currentSessionIndex].photo && (
                <div className="w-32 h-32 md:w-56 md:h-56 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 flex items-center justify-center scale-95 transition-all">
                  <img
                    src={sessionCards[currentSessionIndex].photo}
                    alt="Card AID Illustration"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* CARD CONTENTS WITH MAXIMUM TYPOGRAPHY INTENSITY */}
              <div 
                className="space-y-4 md:space-y-6 cursor-pointer w-full group"
                onClick={() => setIsFlipped((prev) => !prev)}
                title="クリックでカードを反転"
              >
                {!isFlipped ? (
                  // --- FRONT SURFACE SIDE (Foreign Target Languages First, without Header Language name tags) ---
                  <div className="space-y-4 animate-fade-in">
                    <div className="space-y-4 md:space-y-6">
                      {activeSessionDeck.targetLanguages.map((lang) => {
                        const val = sessionCards[currentSessionIndex][lang as keyof Flashcard];
                        if (!val) return null;
                        return (
                          <div key={lang} className="py-1">
                            <h2 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-indigo-300 break-words drop-shadow-[0_0_40px_rgba(99,102,241,0.25)] leading-tight transition-transform group-hover:scale-102 duration-300">
                              {val}
                            </h2>
                          </div>
                        );
                      })}
                    </div>
                    
                    <p className="text-white/20 text-[10px] sm:text-xs tracking-widest uppercase pt-4 transition-opacity group-hover:opacity-100">
                      (画面タップで反転)
                    </p>
                  </div>
                ) : (
                  // --- BACK REVERSE SIDE (Japanese / Island Dialect / Notes) ---
                  <div className="space-y-4 md:space-y-6 animate-fade-in">
                    <div>
                      {!isAutoplayRunning && (
                        <span className="text-[10px] text-white/45 tracking-widest uppercase block mb-1 font-bold">
                          日本語
                        </span>
                      )}
                      <h2 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-white break-words">
                        {sessionCards[currentSessionIndex].japanese}
                      </h2>
                    </div>
                    
                    {/* Ryukyuan standard alignment placement below without label */}
                    {activeSessionDeck.mode === "word" && sessionCards[currentSessionIndex].yaeyama && (
                      <div className="mt-2 text-center">
                        {!isAutoplayRunning && (
                          <span className="text-[10px] text-emerald-400 tracking-widest uppercase block mb-1 font-bold">
                            島言葉
                          </span>
                        )}
                        <h3 className="text-xl sm:text-3xl md:text-4xl font-light italic text-emerald-400 tracking-tight">
                          {sessionCards[currentSessionIndex].yaeyama}
                        </h3>
                      </div>
                    )}

                    {/* Explanatory notes display center */}
                    {sessionCards[currentSessionIndex].notes && (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 max-w-xl mx-auto text-left mt-4 text-xs sm:text-sm">
                        {!isAutoplayRunning && (
                          <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest block mb-1">
                            補足解説メモ
                          </span>
                        )}
                        <p className="text-sm text-white/70 leading-relaxed font-light">
                          {sessionCards[currentSessionIndex].notes}
                        </p>
                      </div>
                    )}

                    <p className="text-indigo-400/50 text-[10px] tracking-widest uppercase pt-2">
                      (画面タップで表面に戻る)
                    </p>
                  </div>
                )}
              </div>

              <div className="h-px w-24 bg-white/10" />

              {/* Dynamic playing status tracker */}
              <div className="flex items-center gap-3">
                <Volume2 className={`w-4 h-4 ${isSpeaking ? "text-indigo-400 animate-bounce" : "text-white/20"}`} />
                <span className="text-white/40 text-xs tracking-widest uppercase">
                  {isSpeaking ? `音声合成再生中 (${ttsConfig.voiceModel === "gemini" ? "Gemini 高音質" : "ブラウザ標準"})` : "音声停止中"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Session Utility Bar and rating selectors - Hidden completely during pure continuous autoplay */}
          {!isAutoplayRunning && (
            <div className="py-4 px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 h-auto border-t border-white/5 bg-[#07070a]/90 backdrop-blur-md z-30">
              
              {/* Play/Pause controls on left side (Only Previous Card controls remain) */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => goToPrevSessionCard()}
                  disabled={currentSessionIndex === 0}
                  className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center cursor-pointer hover:bg-white/10 disabled:opacity-20 transition-all text-white/80"
                  title="前のカード"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>

              {/* SPACED REPETITION rating handlers / Flow buttons */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-center">
                {activeSessionDeck.mode === "script" ? (
                  // Script Mode utilizes linear sequence (Next / Previous story elements)
                  <button
                    onClick={() => {
                      if (currentSessionIndex < sessionCards.length - 1) {
                        goToNextSessionCard();
                      } else {
                        triggerToast("物語が終わりました！劇の学習完了です。", "success");
                        closeReviewSession();
                      }
                    }}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-widest uppercase text-[10px] md:text-xs shadow-lg transition-all"
                  >
                    {currentSessionIndex < sessionCards.length - 1 ? "次のセリフへ進む" : "完了してダッシュボードへ"}
                  </button>
                ) : (
                  // SM-2 Spaced Repetition evaluation controls
                  <div className="flex items-center gap-1.5 sm:gap-2 justify-center flex-wrap">
                    <button
                      onClick={() => submitCardReviewGrade(1)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-red-400/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer transition-all flex items-center justify-center shadow-sm"
                      title="もう一度"
                    >
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => submitCardReviewGrade(2)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-orange-400/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 cursor-pointer transition-all flex items-center justify-center shadow-sm"
                      title="難しい"
                    >
                      <Frown className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => submitCardReviewGrade(3)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-green-400/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 cursor-pointer transition-all flex items-center justify-center shadow-sm"
                      title="できた"
                    >
                      <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => submitCardReviewGrade(4)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-400/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 cursor-pointer transition-all flex items-center justify-center shadow-sm"
                      title="極易"
                    >
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* AI Explainer helper triggerer */}
              <div>
                <button
                  onClick={() => triggerGroundedAIExplanation(sessionCards[currentSessionIndex])}
                  className="flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 px-3.5 py-2.5 rounded-xl transition-all"
                >
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span className="text-[10px] md:text-xs font-semibold text-white/80">AI 詳細解説 / 検索</span>
                </button>
              </div>
            </div>
          )}

          {/* --- SLIDE-OUT PANEL FOR AI DEEP GROUNDED EXPLATION --- */}
          <div
            className={`fixed right-0 top-0 h-full w-full md:w-[480px] bg-[#07070a]/98 backdrop-blur-3xl border-l border-white/10 transition-transform duration-300 transform z-50 overflow-y-auto ${
              isExplainerOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/50">
                    Gemini Web-Search Grounded
                  </span>
                </div>
                <button
                  onClick={() => setIsExplainerOpen(false)}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/15"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isLoadingExplainer ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-xs text-white/40 uppercase tracking-widest">
                    Googleウェブ検索グラウンディング中...
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <span className="text-[11px] uppercase tracking-widest text-indigo-400 block mb-1 font-bold">
                      学習ターゲット
                    </span>
                    <h4 className="text-2xl font-bold text-white">
                      {sessionCards[currentSessionIndex]?.japanese}
                    </h4>
                  </div>

                  <div className="text-sm text-white/80 leading-relaxed font-light whitespace-pre-line border-t border-white/5 pt-4">
                    {explainerContent}
                  </div>

                  {/* Grounded sources references lists */}
                  {explainerReferences.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2 mt-4 text-left">
                      <span className="text-[9px] uppercase tracking-widest text-emerald-400 block font-bold mb-2">
                        参考グラウンディングソース (Google Search)
                      </span>
                      <ul className="space-y-1">
                        {explainerReferences.map((ref, i) => (
                          <li key={i} className="text-xs text-white/50 truncate">
                            🔗{" "}
                            <a
                              href={ref.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline hover:text-indigo-400 transition-colors"
                            >
                              {ref.title || ref.uri}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* --- SIDE HAMBURGER DRAWER MENU --- */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 transition-opacity" onClick={() => setIsDrawerOpen(false)}>
          <div
            className="w-80 h-full bg-[#07070a] border-r border-white/10 p-6 flex flex-col gap-6 z-50 animate-slide-right select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-white">
                八重山ガイド
              </h2>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-white/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-px bg-white/5" />

            {/* Deck Lists Shortcuts */}
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3 block font-bold">
                  マイデッキ一覧
                </label>
                <div className="space-y-2">
                  {decks.map((deck) => {
                    const active = deck.id === selectedDeckId;
                    const count = cards.filter((c) => c.deckId === deck.id).length;
                    const dueCount = getDueCardsCount(deck.id);

                    return (
                      <div
                        key={deck.id}
                        onClick={() => {
                          setSelectedDeckId(deck.id);
                          setIsDrawerOpen(false);
                        }}
                        className={`p-3 rounded-xl cursor-pointer flex items-center justify-between border transition-all ${
                          active
                            ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-100 ring-1 ring-indigo-500/20"
                            : "bg-white/5 border-white/5 text-white/75 hover:bg-white/10"
                        }`}
                      >
                        <div className="truncate pr-1">
                          <p className="font-medium text-xs truncate">{deck.name}</p>
                          <span className="text-[8px] uppercase tracking-wider text-white/40">
                            {deck.mode === "word" ? "Word Mode" : deck.mode === "phrase" ? "Phrase Mode" : "Script Mode"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {dueCount > 0 && deck.mode !== "script" && (
                            <span className="text-[8px] bg-red-500 px-1.5 py-0.5 rounded text-white font-bold">
                              {dueCount}
                            </span>
                          )}
                          <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">
                            {count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedDeck && (
                <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-3">
                  <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold block">
                    【学習ターゲット言語の個別選択】
                  </span>
                  
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-2 rounded bg-black/40 border border-white/5 hover:bg-white/5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedDeck.targetLanguages.includes("english")}
                        onChange={() => toggleLanguageOption("english")}
                        className="accent-indigo-500 rounded text-indigo-600"
                      />
                      <span>英語 (English)</span>
                    </label>

                    <label className="flex items-center gap-3 p-2 rounded bg-black/40 border border-white/5 hover:bg-white/5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedDeck.targetLanguages.includes("french")}
                        onChange={() => toggleLanguageOption("french")}
                        className="accent-indigo-500 rounded text-indigo-600"
                      />
                      <span>フランス語 (French)</span>
                    </label>

                    <label className="flex items-center gap-3 p-2 rounded bg-black/40 border border-white/5 hover:bg-white/5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedDeck.targetLanguages.includes("chinese")}
                        onChange={() => toggleLanguageOption("chinese")}
                        className="accent-indigo-500 rounded text-indigo-600"
                      />
                      <span>中国語 (Chinese)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action buttons list */}
              <div className="space-y-2 pt-4">
                <button
                  onClick={() => {
                    setShowAddDeckForm(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> 新規デッキを作成
                </button>

                <button
                  onClick={() => {
                    setSyncModalOpen(true);
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-400" /> スプレッドシート同期
                </button>

                <button
                  onClick={() => {
                    setHelpModalOpen(true);
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 text-xs font-semibold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                >
                  <HelpCircle className="w-4 h-4" /> GAS設定ヘルプ
                </button>
              </div>

              {/* --- ADVANCED AI DECK BULK GENERATION ENGINE IN SIDEBAR --- */}
              <div className="mt-8 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span className="text-[10px] tracking-widest uppercase font-bold text-indigo-300">
                    AI 一括デッキジェネレータ
                  </span>
                </div>
                
                <form onSubmit={handleAIBulkDeckGeneration} className="space-y-2">
                  <div>
                    <label className="text-[8px] uppercase tracking-widest text-white/40 block">テーマを入力</label>
                    <input
                      type="text"
                      required
                      placeholder="例: フランス流カフェ注文"
                      value={generateTheme}
                      onChange={(e) => setGenerateTheme(e.target.value)}
                      className="w-full text-xs bg-black border border-white/10 text-white px-3 py-2 rounded focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[8px] uppercase tracking-widest text-white/40 block">モード</label>
                      <select
                        value={generateMode}
                        onChange={(e) => setGenerateMode(e.target.value as DeckMode)}
                        className="w-full text-[10px] bg-black border border-white/10 text-white px-1.5 py-1.5 rounded focus:outline-none"
                      >
                        <option value="word">単語 (Word)</option>
                        <option value="phrase">フレーズ (Phrase)</option>
                        <option value="script">台本 (Script)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[8px] uppercase tracking-widest text-white/40 block">カード枚数</label>
                      <select
                        value={generateCount}
                        onChange={(e) => setGenerateCount(Number(e.target.value))}
                        className="w-full text-[10px] bg-black border border-white/10 text-white px-1.5 py-1.5 rounded focus:outline-none"
                      >
                        <option value={3}>3枚</option>
                        <option value={5}>5枚</option>
                        <option value={8}>8枚</option>
                        <option value={12}>12枚</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isGeneratingDeck}
                    className="w-full py-1.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] tracking-wider uppercase font-semibold transition-all flex items-center justify-center gap-2 border border-indigo-500/30 disabled:opacity-45"
                  >
                    {isGeneratingDeck ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" /> 生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" /> AI自動デッキ生成
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Footer and credit indicators inside drawer bottom */}
            <div className="mt-auto h-12 border-t border-white/5 pt-4 flex items-center justify-between text-white/30 text-[10px]">
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-indigo-400 uppercase text-xs">八重山ガイド</span>
                <span className="text-[8px] tracking-widest text-white/20 uppercase">v3.2.0 (PWA ACTIVE)</span>
              </div>
              <span className="uppercase text-[8px] tracking-widest">Off-line persistence</span>
            </div>
          </div>
        </div>
      )}

      {/* --- STANDARD NAV HEADER LAYOUT --- */}
      <nav className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-black/40 backdrop-blur-xl z-25 relative">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/5 hover:border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all"
            title="メニューを開く"
          >
            <Menu className="w-5 h-5 text-white/80" />
          </button>
          
          <h1 className="text-lg font-bold tracking-tight text-white">
            八重山ガイド
          </h1>
        </div>

        {/* Selected Deck statistics dashboard indicator header */}
        <div className="hidden md:flex items-center gap-4 text-xs font-semibold">
          {selectedDeck && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded bg-white/10 text-white/80 text-[10px] uppercase tracking-wide">
                デッキ: {selectedDeck.name}
              </span>
              
              <span className="px-3 py-1 rounded bg-indigo-500/10 text-indigo-300 text-[10px] uppercase tracking-wide border border-indigo-500/20">
                形式: {selectedDeck.mode === "word" ? "単語学習 (Word)" : selectedDeck.mode === "phrase" ? "翻訳フレーズ" : "台本演劇脚本"}
              </span>
            </div>
          )}
        </div>

        {/* Gemini TTS and Browser Synthesis select models trigger */}
        <div className="flex items-center gap-3">
          
          {/* Gemini Client state checklist indicators */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/40 uppercase tracking-widest hidden lg:inline">配備モード:</span>
            <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              <div className={`w-1.5 h-1.5 rounded-full ${configStatus.geminiInitialized ? "bg-indigo-400 animate-pulse" : "bg-orange-400"}`} />
              <span className="text-indigo-300 uppercase tracking-widest text-[9px] font-bold">
                {configStatus.geminiInitialized ? "Gemini TTS Active" : "Local Browser Only"}
              </span>
            </div>
          </div>

          <span className="text-white/40 uppercase tracking-widest text-[10px] hidden md:inline">v3.2.0</span>
        </div>
      </nav>

      {/* --- RECONSTRUCTED CENTRAL WORKSPACE --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 z-10 relative">
        
        {/* LEFT COLUMN: SELECTED DECK ACTIONS & STATE PREVIEW */}
        <div className="space-y-6 lg:col-span-1">
          {selectedDeck ? (
            <div className="p-6 rounded-2xl border border-white/5 bg-black/35 backdrop-blur-md space-y-6">
              
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white leading-tight">
                  {selectedDeck.name}
                </h2>
                <p className="text-[10px] text-white/40">
                  作成日時: {new Date(selectedDeck.createdAt).toLocaleDateString("ja-JP")}
                </p>
              </div>

              <div className="h-px bg-white/5" />



              {/* SM2 Forecast notification block */}
              {selectedDeck.mode !== "script" && (
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-xs text-indigo-200/90 leading-relaxed font-light italic">
                    "SM-2 算法は、本日このデッキで復習対象カードを{" "}
                    <span className="font-bold text-white text-sm underline">
                      {getDueCardsCount(selectedDeck.id)}枚
                    </span>{" "}
                    と判定しました。"
                  </p>
                </div>
              )}

              {/* Launch Learning session Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => launchReviewSession("all")}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-widest text-xs uppercase shadow-lg shadow-indigo-600/35 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> 全カードを自動再生学習 🚀
                </button>

                {selectedDeck.mode !== "script" && (
                  <button
                    onClick={() => launchReviewSession("due")}
                    className="w-full py-3.5 rounded-xl border border-rose-500/30 hover:border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold tracking-widest text-xs uppercase transition-all flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" /> 本日分のみを復習 ({getDueCardsCount(selectedDeck.id)}枚)
                  </button>
                )}
              </div>

              {/* Delete Active Deck button */}
              <button
                onClick={() => handleDeleteDeck(selectedDeck.id)}
                className="w-full py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 font-medium tracking-wide text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> このデッキを完全に消去
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-white/5 bg-black/40 text-center space-y-4">
              <Layers className="w-8 h-8 mx-auto text-white/20" />
              <p className="text-sm text-white/55">デッキがひとつも存在しません。上部のドロワーから新しい学習デッキを生成してください。</p>
            </div>
          )}

          {/* Sound Synthesizer Parameters */}
          <div className="p-6 rounded-2xl border border-white/5 bg-black/35 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold tracking-widest uppercase">発音TTSスピード・音声調律</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-white/40 block mb-1">音声エンジンモデル</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      if (!configStatus.geminiInitialized) {
                        triggerToast("Gemini APIキーがSecretsに設定されていません", "error");
                        return;
                      }
                      setTtsConfig((prev) => ({ ...prev, voiceModel: "gemini" }));
                    }}
                    className={`py-1.5 rounded font-bold transition-all ${
                      ttsConfig.voiceModel === "gemini"
                        ? "bg-indigo-600 text-white"
                        : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10"
                    }`}
                  >
                    Gemini API (特高音)
                  </button>
                  <button
                    onClick={() => setTtsConfig((prev) => ({ ...prev, voiceModel: "browser" }))}
                    className={`py-1.5 rounded font-bold transition-all ${
                      ttsConfig.voiceModel === "browser"
                        ? "bg-indigo-600 text-white"
                        : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10"
                    }`}
                  >
                    ブラウザ標準
                  </button>
                </div>
              </div>

              {ttsConfig.voiceModel === "gemini" && (
                <div>
                  <label className="text-white/40 block mb-1">Gemini ボイス選択</label>
                  <select
                    value={ttsConfig.geminiVoice}
                    onChange={(e) => setTtsConfig((prev) => ({ ...prev, geminiVoice: e.target.value as any }))}
                    className="w-full text-xs bg-black border border-white/10 text-white px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-400"
                  >
                    <option value="Kore">Kore (標準・心地よい女性)</option>
                    <option value="Zephyr">Zephyr (爽やかでクリアな男性)</option>
                    <option value="Puck">Puck (温かみのある男性)</option>
                    <option value="Charon">Charon (落ち着いた低音男性)</option>
                    <option value="Fenrir">Fenrir (深みのある大人の女性)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-white/40 block mb-1">話速テンポ ({ttsConfig.playSpeed}x)</label>
                <input
                  type="range"
                  min="0.6"
                  max="1.7"
                  step="0.1"
                  value={ttsConfig.playSpeed}
                  onChange={(e) => setTtsConfig((prev) => ({ ...prev, playSpeed: Number(e.target.value) }))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-white/40 block mb-1">
                  自動再生時のインターバル ({ttsConfig.autoplayDelaySec}秒)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={ttsConfig.autoplayDelaySec}
                  onChange={(e) => setTtsConfig((prev) => ({ ...prev, autoplayDelaySec: Number(e.target.value) }))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CARDS LIST TABLE & QUICK CREATION */}
        <div className="lg:col-span-3 space-y-6">
          
          {selectedDeck ? (
            <div className="p-6 rounded-2xl border border-white/5 bg-black/35 backdrop-blur-md space-y-6">
              
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-md font-semibold text-white">
                    カード一覧
                  </h3>
                  <p className="text-xs text-white/50">
                    カード数: {selectedDeckCards.length} 枚
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddCardForm((prev) => !prev)}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide flex items-center gap-2 transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" /> カードを個別追加
                  </button>
                </div>
              </div>

              {/* Card custom creator Form panel */}
              {showAddCardForm && (
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4 animate-fade-in relative">
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => setShowAddCardForm(false)}
                      className="text-white/40 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                    新規フラッシュカードの作成
                  </h4>

                  <form onSubmit={handleCreateCardManually} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {selectedDeck.mode === "script" && (
                        <div className="md:col-span-2">
                          <label className="text-white/50 block mb-1 font-semibold">演劇・会話シーン区分</label>
                          <input
                            type="text"
                            placeholder="例: Scene 1: 港の風のなかで"
                            value={newCardScene}
                            onChange={(e) => setNewCardScene(e.target.value)}
                            className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-white/50 block mb-1 font-semibold">表面 (日本語の文字・セリフ) *</label>
                        <input
                          type="text"
                          required
                          placeholder="例: こんにちは / 朝のご挨拶をします"
                          value={newCardJapanese}
                          onChange={(e) => setNewCardJapanese(e.target.value)}
                          className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      {selectedDeck.mode === "word" && (
                        <div>
                          <label className="text-white/50 block mb-1 font-semibold">島言葉 / 八重山方言 (※並列並置用)</label>
                          <input
                            type="text"
                            placeholder="例: はいさい / でーびる"
                            value={newCardYaeyama}
                            onChange={(e) => setNewCardYaeyama(e.target.value)}
                            className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-white/50 block mb-1 font-semibold">英語表現 (English translation)</label>
                        <input
                          type="text"
                          placeholder="例: Hello"
                          value={newCardEnglish}
                          onChange={(e) => setNewCardEnglish(e.target.value)}
                          className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div>
                        <label className="text-white/50 block mb-1 font-semibold">フランス語表現 (French translation)</label>
                        <input
                          type="text"
                          placeholder="例: Bonjour"
                          value={newCardFrench}
                          onChange={(e) => setNewCardFrench(e.target.value)}
                          className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div>
                        <label className="text-white/50 block mb-1 font-semibold">中国語表現 (Chinese translation)</label>
                        <input
                          type="text"
                          placeholder="例: 你好"
                          value={newCardChinese}
                          onChange={(e) => setNewCardChinese(e.target.value)}
                          className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-white/50 block mb-1 font-semibold">補足解説 / 文法メモ</label>
                        <textarea
                          placeholder="単語の品詞分解や、フランクに使う際のイントネーション・ニュアンス、お役立ちアドバイスを書き留めましょう"
                          value={newCardNotes}
                          rows={2}
                          onChange={(e) => setNewCardNotes(e.target.value)}
                          className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      {selectedDeck.mode === "word" && (
                        <div className="md:col-span-2 p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                          <label className="text-white/50 block mb-1 font-semibold">
                            単語ビジュアル写真 (Photo URL / またはAI自動生成)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="https://images.unsplash.com/... もしくはAI生成を活用"
                              value={newCardPhoto}
                              onChange={(e) => setNewCardPhoto(e.target.value)}
                              className="flex-1 bg-black/55 border border-white/10 text-white px-3 py-2 rounded focus:outline-none"
                            />
                            
                            <button
                              type="button"
                              onClick={triggerAIImageGeneration}
                              disabled={isGeneratingImage || (!newCardJapanese && !imageGenerationPrompt)}
                              className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 rounded flex items-center gap-1.5 transition-all disabled:opacity-30"
                            >
                              {isGeneratingImage ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> お絵描き中...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" /> AIイラスト生成
                                </>
                              )}
                            </button>
                          </div>
                          
                          <p className="text-[10px] text-white/35 leading-tight italic">
                            ※「AIイラスト生成」を押すと、Gemini Imageモデルがこの単語にふさわしい極簡のミニマリストベクターアイコンを完全自動で作成します！
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setShowAddCardForm(false)}
                        className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        キャンセル
                      </button>
                      
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                      >
                        カードを保存する
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Cards Tables List representation styled under "Immersive Design" with clean subtle borders */}
              {selectedDeckCards.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/25">
                  <table className="w-full text-left text-xs text-white/80 border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5 text-white/45">
                        <th className="p-4 uppercase tracking-wider text-[10px]">
                          学習言語
                        </th>
                        <th className="p-4 uppercase tracking-wider text-[10px] hidden md:table-cell">メモ</th>
                        <th className="p-4 uppercase tracking-wider text-[10px] text-center w-24">プレビュー</th>
                        <th className="p-4 uppercase tracking-wider text-[10px] text-center w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDeckCards.map((card) => {
                        return (
                          <tr
                            key={card.id}
                            className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                            onClick={() => launchQuickPreview(card)}
                          >
                            <td className="p-4">
                              {/* Upper section: active target foreign languages list */}
                              <div className="space-y-1 mb-2">
                                {selectedDeck.targetLanguages.map((lang) => {
                                  const v = card[lang as keyof Flashcard];
                                  if (!v) return null;
                                  const flagEmoji =
                                    lang === "english" ? "🇺🇸" :
                                    lang === "french" ? "🇫🇷" :
                                    lang === "chinese" ? "🇨🇳" : "🏳️";
                                  return (
                                    <div key={lang} className="flex items-center gap-2">
                                      <span className="text-base select-none" title={LANGUAGE_NAMES[lang]}>
                                        {flagEmoji}
                                      </span>
                                      <span className="font-semibold text-indigo-400 font-mono text-xs hidden">
                                        {LANGUAGE_NAMES[lang]}
                                      </span>
                                      <span className="font-semibold text-indigo-200 text-sm">{v}</span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Subtle line divider inside cell */}
                              <div className="h-px bg-white/5 max-w-sm mb-2" />

                              {/* Lower section: Japanese and island dialect */}
                              <div className="flex flex-col gap-0.5">
                                <p className="text-white text-xs font-semibold">{card.japanese}</p>
                                {card.yaeyama && (
                                  <span className="text-[10px] italic text-emerald-400">
                                    島言葉: {card.yaeyama}
                                  </span>
                                )}
                                {card.scene && (
                                  <span className="text-[9px] text-indigo-400 font-bold block mt-0.5">
                                    {card.scene}
                                  </span>
                                )}
                              </div>
                            </td>
                            
                            <td className="p-4 text-white/45 max-w-xs truncate hidden md:table-cell">
                              {card.notes || "無し"}
                            </td>

                            {/* Clicking card row opens preview modal trigger */}
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => launchQuickPreview(card)}
                                className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 inline-flex items-center justify-center mx-auto transition-all cursor-pointer"
                                title="プレビュー"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>

                            {/* Edit card trigger */}
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setEditingCard(card)}
                                className="p-2 text-white/40 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-colors"
                                title="カードを編集"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <Layers className="w-8 h-8 text-white/20 mx-auto" />
                  <p className="text-sm text-white/45 font-medium">
                    このデッキにはまだ暗記カードがありません！
                  </p>
                  <p className="text-xs text-white/30">
                    カードを個別に登録するか、または左ドロワーメニューの「AIデッキジェネレータ」でテーマに沿って一括自動生成させてください。
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center space-y-4 border border-white/5 bg-black/35 backdrop-blur-md rounded-2xl">
              <Sparkles className="w-12 h-12 text-indigo-400 animate-pulse mx-auto" />
              <h2 className="text-lg font-bold">八重山ガイドへようこそ！</h2>
              <p className="text-sm text-white/60 max-w-xl mx-auto">
                標準のブラウザTTSはもちろん、Geminiによる超高音質なAI音声合成（TTS）、AI自動翻訳、AI画像生成、およびGoogleスプレッドシートとの高度な一括同期機能を搭載した多言語および島言葉（八重山方言）のインタラクティブ学習ガイドです。
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs uppercase tracking-widest text-white transition-all shadow-md shadow-indigo-600/35"
                >
                  メニューを展開してデッキ作成
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- EXTRA CARD EDIT MODAL DIALOG OVERLAY (With integrated delete button) --- */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0b0e] border border-white/10 p-6 rounded-2xl max-w-2xl w-full space-y-5 animate-fade-in relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingCard(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-md font-bold text-white">
                フラッシュカードを編集
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDeck?.mode === "script" && (
                  <div className="md:col-span-2">
                    <label className="text-white/50 block mb-1 font-semibold">演劇・会話シーン区分</label>
                    <input
                      type="text"
                      value={editingCard.scene || ""}
                      onChange={(e) => setEditingCard({ ...editingCard, scene: e.target.value })}
                      className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                )}

                <div>
                  <label className="text-white/50 block mb-1 font-semibold">表面 (日本語の文字・セリフ) *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.japanese || ""}
                    onChange={(e) => setEditingCard({ ...editingCard, japanese: e.target.value })}
                    className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>

                {selectedDeck?.mode === "word" && (
                  <div>
                    <label className="text-white/50 block mb-1 font-semibold">島言葉 / 八重山方言 (※並列並置用)</label>
                    <input
                      type="text"
                      value={editingCard.yaeyama || ""}
                      onChange={(e) => setEditingCard({ ...editingCard, yaeyama: e.target.value })}
                      className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                )}

                <div>
                  <label className="text-white/50 block mb-1 font-semibold">英語表現 (English translation)</label>
                  <input
                    type="text"
                    value={editingCard.english || ""}
                    onChange={(e) => setEditingCard({ ...editingCard, english: e.target.value })}
                    className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="text-white/50 block mb-1 font-semibold">フランス語表現 (French translation)</label>
                  <input
                    type="text"
                    value={editingCard.french || ""}
                    onChange={(e) => setEditingCard({ ...editingCard, french: e.target.value })}
                    className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="text-white/50 block mb-1 font-semibold">中国語表現 (Chinese translation)</label>
                  <input
                    type="text"
                    value={editingCard.chinese || ""}
                    onChange={(e) => setEditingCard({ ...editingCard, chinese: e.target.value })}
                    className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-white/50 block mb-1 font-semibold">補足解説 / 文法メモ</label>
                  <textarea
                    value={editingCard.notes || ""}
                    rows={2}
                    onChange={(e) => setEditingCard({ ...editingCard, notes: e.target.value })}
                    className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>

                {selectedDeck?.mode === "word" && (
                  <div className="md:col-span-2">
                    <label className="text-white/50 block mb-1 font-semibold">単語ビジュアル写真 (Photo URL)</label>
                    <input
                      type="text"
                      value={editingCard.photo || ""}
                      onChange={(e) => setEditingCard({ ...editingCard, photo: e.target.value })}
                      className="w-full bg-black/55 border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => deleteCardAndCloseEdit(editingCard.id)}
                  className="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 flex items-center gap-2 font-semibold"
                >
                  <Trash2 className="w-4 h-4" /> 削除する
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCard(null)}
                    className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => handleUpdateCard(editingCard)}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    更新保存する
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD NEW DECK DIALOG OVERLAY --- */}
      {showAddDeckForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0b0e] border border-white/10 p-6 rounded-2xl max-w-md w-full space-y-5 animate-fade-in relative">
            <button
              onClick={() => setShowAddDeckForm(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              <h3 className="text-md font-bold text-white">
                新しい暗記対象デッキの作成
              </h3>
            </div>

            <form onSubmit={handleCreateDeck} className="space-y-4 text-xs">
              <div>
                <label className="text-white/50 block mb-1">デッキ名 (Deck Title)</label>
                <input
                  type="text"
                  required
                  placeholder="例: Okinawan standard Phrases"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  className="w-full bg-black border border-white/15 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-white/50 block mb-1">暗記カテゴリー (Deck Mode)</label>
                <div className="grid grid-cols-1 gap-2">
                  <label className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3 cursor-pointer hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all">
                    <input
                      type="radio"
                      name="new_deck_mode"
                      value="word"
                      checked={newDeckMode === "word"}
                      onChange={() => setNewDeckMode("word")}
                      className="mt-1 accent-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-white">① 単語学習 (Word Mode)</p>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        写真イラスト、日本語、英語、フランス語、中国語、八重山方言を含められる最も多機能な単語カード。
                      </p>
                    </div>
                  </label>

                  <label className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3 cursor-pointer hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all">
                    <input
                      type="radio"
                      name="new_deck_mode"
                      value="phrase"
                      checked={newDeckMode === "phrase"}
                      onChange={() => setNewDeckMode("phrase")}
                      className="mt-1 accent-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-white">② フレーズ学習 (Phrase Mode)</p>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        旅行の定番表現や長文フレーズ。日本語、英語、フランス語、中国語、メモに特化したスリムな構造。
                      </p>
                    </div>
                  </label>

                  <label className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3 cursor-pointer hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all">
                    <input
                      type="radio"
                      name="new_deck_mode"
                      value="script"
                      checked={newDeckMode === "script"}
                      onChange={() => setNewDeckMode("script")}
                      className="mt-1 accent-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-white">③ 台本暗記 (Script Mode)</p>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        演劇、セリフ、ナレーション。シーン別の区分けに対応し、最初から順番固定のシナリオ順で学習可能。
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDeckForm(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded hover:bg-white/10"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-500"
                >
                  作成する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SPREADSHEET SYNC MODAL OVERLAY --- */}
      {syncModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0b0e] border border-white/10 p-6 rounded-2xl max-w-2xl w-full space-y-6 animate-fade-in text-xs relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSyncModalOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              <h3 className="text-md font-bold text-white uppercase">
                スプレッドシート連携 ＆ バックアップ同期
              </h3>
            </div>

            {/* Approach A description */}
            <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 space-y-3">
              <h4 className="font-bold text-indigo-300 text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> アプローチA：JSON一括コピペ [100%安全・極めて信頼性が高い]
              </h4>
              <p className="text-white/60 leading-relaxed font-light">
                CORS制限やWebセキュリティ環境に一切左右されない、最も信頼のおける連携手法。コピーして保管しておけば即座に完全復元が可能です。
              </p>

              <div className="space-y-2">
                <textarea
                  placeholder='ここにコピーしたバックアップJSONを貼り付けて「インポート」を実行してください'
                  rows={4}
                  value={syncJsonInput}
                  onChange={(e) => setSyncJsonInput(e.target.value)}
                  className="w-full bg-black border border-white/10 text-white p-3 rounded font-mono text-[10px]"
                />
                
                <div className="flex justify-between gap-2">
                  <button
                    onClick={copyCurrentBackupJson}
                    className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/20 font-bold"
                  >
                    現在の全デッキJSONをコピー出力 📤
                  </button>

                  <button
                    onClick={handleJsonSyncImport}
                    disabled={!syncJsonInput.trim()}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded disabled:opacity-30"
                  >
                    JSONからデータを一括インポート 📥
                  </button>
                </div>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Approach B description */}
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-3">
              <h4 className="font-bold text-emerald-300 text-xs flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" /> アプローチB：GAS（Google Apps Script）一括双方向同期 [Webオート同期]
              </h4>
              <p className="text-white/60 leading-relaxed font-light">
                スプレッドシートに配置したGASに1つのWebアプリURLを発行させて同期を行います。アプリ内のデッキが、そのままシート名（タブ）として自動的に生み出され個別管理されます。
              </p>

              <div className="space-y-2">
                <label className="text-white/40 block mb-1">スプレッドシートGAS WebアプリURL:</label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={gasWebhookUrl}
                  onChange={(e) => setGasWebhookUrl(e.target.value)}
                  className="w-full bg-black border border-white/10 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-emerald-400"
                />
                
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => syncWithGasSpreadsheet("fetch_from_sheet")}
                    disabled={isSyncingGas || !gasWebhookUrl.trim()}
                    className="px-4 py-2 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/35 disabled:opacity-30"
                  >
                    スプレッドシートから取り込み 📥
                  </button>

                  <button
                    onClick={() => syncWithGasSpreadsheet("sync_to_sheet")}
                    disabled={isSyncingGas || !gasWebhookUrl.trim()}
                    className="px-5 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-30"
                  >
                    {isSyncingGas ? "一括同期送信中..." : "スプレッドシートへ流し込み送信 📤"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- GAS INTEGRATION GUIDE MODAL --- */}
      {helpModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0b0e] border border-white/10 p-6 rounded-2xl max-w-3xl w-full space-y-4 animate-fade-in text-xs relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setHelpModalOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              <h3 className="text-md font-bold text-white uppercase">
                Google Apps Script (GAS) 構築マニュアル
              </h3>
            </div>

            <p className="text-white/60 leading-relaxed font-light">
              お使いのスプレッドシートへ一括書き出し・取り込みに対応させるには、以下のスクリプトを登録します。
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="font-bold text-white">【設定の流れ】</p>
                <p className="text-white/50">1. スプレッドシートを開き、「開発」➔「Extensions」➔「Apps Script」を起動します。</p>
                <p className="text-white/50">2. 開いたエディタに下記コードをそのままコピー＆ペーストして保存します。</p>
                <p className="text-white/50">3. 画面右上の「デプロイ」➔「Webアプリ」を選択します。</p>
                <p className="text-white/50">4. 実行ユーザーを「自分」、アクセスできる人を「全員(Anyone)」に設定してデプロイを実行します。</p>
                <p className="text-white/50">5. 発行された「URL」をコピーし、本アプリの連携設定へ貼付すれば稼働します！</p>
              </div>

              <div className="relative">
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-indigo-500/10 text-indigo-300 font-bold text-[8px] uppercase tracking-widest rounded border border-indigo-500/20">
                  GASソース
                </span>
                <pre className="bg-black border border-white/5 text-white/70 p-4 rounded-xl font-mono text-[9px] overflow-auto max-h-60 whitespace-pre">
{`// GAS Web App Webhook Script (スプレッドシート記述用)
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.action === "sync_to_sheet") {
      var decks = data.decks;
      var cards = data.cards;
      
      decks.forEach(function(deck) {
        var sheetName = deck.name;
        // シートが存在しない場合は追加
        var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
        sheet.clear();
        
        var deckCards = cards.filter(function(c) { return c.deckId === deck.id; });
        var headers = ["ID", "Japanese", "English", "French", "Chinese", "Yaeyama", "Notes", "Photo", "Scene", "Interval", "EF", "Reps"];
        sheet.appendRow(headers);
        
        deckCards.forEach(function(card) {
          sheet.appendRow([
            card.id,
            card.japanese || "",
            card.english || "",
            card.french || "",
            card.chinese || "",
            card.yaeyama || "",
            card.notes || "",
            card.photo || "",
            card.scene || "",
            card.interval || 1,
            card.easyFactor || 2.5,
            card.repetitions || 0
          ]);
        });
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: decks.length }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "fetch_from_sheet") {
      var sheets = ss.getSheets();
      var responseDecks = [];
      var responseCards = [];
      
      sheets.forEach(function(sheet, index) {
        var name = sheet.getName();
        var dataRange = sheet.getDataRange();
        if (dataRange.getNumRows() < 2) return;
        var values = dataRange.getValues();
        
        var mode = "word";
        if (name.indexOf("台本") !== -1 || name.indexOf("Script") !== -1) mode = "script";
        else if (name.indexOf("フレーズ") !== -1 || name.indexOf("Phrase") !== -1) mode = "phrase";
        
        var deckId = "deck-ss-" + index;
        responseDecks.push({
          id: deckId,
          name: name,
          mode: mode,
          createdAt: new Date().toISOString(),
          targetLanguages: ["english", "french", "chinese"]
        });
        
        for (var r = 1; r < values.length; r++) {
          var row = values[r];
          var cardObj = {
            id: row[0] || ("card-ss-" + index + "-" + r),
            deckId: deckId,
            mode: mode,
            japanese: String(row[1] || ""),
            english: String(row[2] || ""),
            french: String(row[3] || ""),
            chinese: String(row[4] || ""),
            yaeyama: String(row[5] || ""),
            notes: String(row[6] || ""),
            photo: String(row[7] || ""),
            scene: String(row[8] || ""),
            interval: Number(row[9]) || 1,
            easyFactor: Number(row[10]) || 2.5,
            repetitions: Number(row[11]) || 0,
            nextReviewDate: new Date().toISOString().split('T')[0]
          };
          responseCards.push(cardObj);
        }
      });
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", decks: responseDecks, cards: responseCards }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary bottom line indicator slider */}
      <footer className="h-10 mt-auto border-t border-white/5 flex items-center justify-between px-8 text-[10px] text-white/20 select-none z-10 relative">
        <span>八重山ガイド © Multi-Language Interactive Study Application</span>
        <span>Version v3.2.0 • Built with Gemini AI Assist</span>
      </footer>

    </div>
  );
}
