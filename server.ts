import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Lazy initializer for Gemini client to prevent crashing if environment key is missing on startup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. Health and Configuration state check
app.get("/api/config-check", (req, res) => {
  const client = getGeminiClient();
  res.json({
    geminiInitialized: !!client,
    appUrl: process.env.APP_URL || "http://localhost:3000",
  });
});

// 2. High-Quality Gemini TTS endpoint
app.post("/api/tts", async (req: express.Request, res: express.Response) => {
  try {
    const { text, voice } = req.body;
    if (!text) {
      res.status(400).json({ error: "Text is required for TTS." });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "Gemini API key is not configured. Falling back to browser SpeechSynthesis.",
      });
      return;
    }

    // Call gemini-3.1-flash-tts-preview
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say clearly with natural pronunciation and appropriate feelings: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "audio/pcm;rate=24000";

    if (!base64Audio) {
      res.status(500).json({ error: "No audio generated from Gemini TTS service." });
      return;
    }

    res.json({
      audio: base64Audio,
      mimeType: mimeType,
    });
  } catch (error: any) {
    console.error("TTS generation error:", error);
    res.status(500).json({ error: error.message || "TTS synthesis failed." });
  }
});

// 3. AI Bulk Deck Generator with Structured JSON Schema
app.post("/api/generate-deck", async (req: express.Request, res: express.Response) => {
  try {
    const { theme, mode, count } = req.body;
    if (!theme || !mode) {
      res.status(400).json({ error: "Theme and Mode are required." });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "Gemini API key is missing. Please set GEMINI_API_KEY in Secrets context.",
      });
      return;
    }

    const itemCount = Math.min(Math.max(Number(count) || 5, 2), 15);

    let systemInstruction = "";
    let properties: any = {};
    let requiredFields: string[] = [];

    if (mode === "word") {
      systemInstruction = `You are a professional multi-language lexicographer specializing in words or expressions learning.
Generate exactly ${itemCount} flashcard items related to "${theme}" in Word Mode.
For each item, provide translations in English, French, Chinese, and optionally approximate or standard sound-alike translations/greetings for the Yaeyama dialect (八重山方言/島言葉), alongside rich notes about grammar, nuance, or dialect background.`;
      
      properties = {
        japanese: { type: Type.STRING, description: "Normal standard Japanese term or noun." },
        english: { type: Type.STRING, description: "English translation." },
        french: { type: Type.STRING, description: "French translation." },
        chinese: { type: Type.STRING, description: "Chinese translation." },
        yaeyama: { type: Type.STRING, description: "島言葉 (八重山方言/沖縄島言葉) level translation, e.g. にーふぁいゆー for standard ありがとうございます." },
        notes: { type: Type.STRING, description: "Helpful grammar guidelines, cultural context, or pronunciation nuance in Japanese." },
      };
      requiredFields = ["japanese", "english", "french", "chinese", "yaeyama", "notes"];
    } else if (mode === "phrase") {
      systemInstruction = `You are a stellar bilingual phrases instructor.
Generate exactly ${itemCount} high-quality traveling or casual everyday expressions/sentences related to "${theme}" in Phrase Mode.`;
      properties = {
        japanese: { type: Type.STRING, description: "Japanese phrase." },
        english: { type: Type.STRING, description: "English translation of the phrase." },
        french: { type: Type.STRING, description: "French translation of the phrase." },
        chinese: { type: Type.STRING, description: "Chinese translation of the phrase." },
        notes: { type: Type.STRING, description: "Short breakdown or tips about when to use this phrase in Japanese." },
      };
      requiredFields = ["japanese", "english", "french", "chinese", "notes"];
    } else {
      // script
      systemInstruction = `You are an elegant theatrical scene storyliner and script writer.
Generate exactly ${itemCount} dialogue lines/cards related to the play theme: "${theme}" in Script Mode.
Ensure sequential theatrical flows and divide dialogue steps elegantly. Define scenes in scene field, e.g., "Scene 1: Cafe".`;
      properties = {
        scene: { type: Type.STRING, description: "Scene title, e.g., 'Scene 1: Airport Departure' or 'Scene 2: Cafe Terrace'." },
        japanese: { type: Type.STRING, description: "The actor script dialogue in Japanese." },
        english: { type: Type.STRING, description: "English translation of dialogue." },
        french: { type: Type.STRING, description: "French translation of dialogue." },
        chinese: { type: Type.STRING, description: "Chinese translation of dialogue." },
        notes: { type: Type.STRING, description: "Actor information, feelings context or stage directions in Japanese like 【話者：Aさん】嬉しそうに." },
      };
      requiredFields = ["scene", "japanese", "english", "french", "chinese", "notes"];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Please generate the cards list for the theme: ${theme}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties,
                required: requiredFields,
              },
            },
          },
          required: ["cards"],
        },
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Deck bulk generation failure:", error);
    res.status(500).json({ error: error.message || "Failed to generate deck items." });
  }
});

// 4. AI Search Grounded Explainer Endpoint
app.post("/api/explain", async (req: express.Request, res: express.Response) => {
  try {
    const { card } = req.body;
    if (!card) {
      res.status(400).json({ error: "Card information is required." });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "Gemini API key is not configured. Rich grounded explanation is unavailable.",
      });
      return;
    }

    const cardDetails = `
Mode: ${card.mode}
Japanese: ${card.japanese}
English: ${card.english}
French: ${card.french}
Chinese: ${card.chinese}
${card.yaeyama ? `Yaeyama Dialect: ${card.yaeyama}` : ""}
Notes: ${card.notes}
`;

    const prompt = `Based on this card definitions:
${cardDetails}

Please query the web source to search for correct cultural context, grammar specifics, real-life conversation alternatives, and background facts related to this language card. Especially, if it features a regional dialect like Yaeyama dialect (島言葉) or unique French/Chinese idiom, explain the literal meaning and standard variations in beautiful Japanese.
Use a helpful, warm, informative tone. Provide:
1. 【言葉のニュアンスと文化的背景】：Detailed explanation.
2. 【日常日常での自然な実用例文】：Provide 2 natural sample dialogues with Japanese translations.
3. 【豆知識・方言解説】：Tips or dialect breakdowns.
Make sure to include real actual examples and structure it nicely with markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // Extract URLs to display sources
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const references = chunks.map((chunk: any) => ({
      title: chunk.web?.title || "Web Reference",
      uri: chunk.web?.uri || "",
    })).filter((ref: any) => ref.uri);

    res.json({
      explanation: response.text,
      references: references,
    });
  } catch (error: any) {
    console.error("AI Explainer generation failure:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI analysis." });
  }
});

// 5. AI Image Generation via gemini-2.5-flash-image
app.post("/api/generate-image", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required for image generation." });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "Gemini API key is required to generate illustration.",
      });
      return;
    }

    // Call gemini-2.5-flash-image
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `Create a clean, beautiful, ultra-minimalist vector illustration/icon representation suitable as a learning flashcard aid. It should be on a plain white background, simple, elegant, with no words or letters typed. Concept: ${prompt}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    let base64Image = "";
    if (response?.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      res.status(500).json({ error: "No image inline data returned from Gemini Image API." });
      return;
    }

    res.json({
      imageUrl: `data:image/png;base64,${base64Image}`,
    });
  } catch (error: any) {
    console.error("AI Image Generation failure:", error);
    res.status(500).json({ error: error.message || "Failed to generate image artifact." });
  }
});

// Setup development server middleware, and handle production assets
async function buildApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving from dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AnkiFlow PRO backend server listening on http://0.0.0.0:${PORT}`);
  });
}

buildApp().catch((err) => {
  console.error("Server build bootstrap error:", err);
});
