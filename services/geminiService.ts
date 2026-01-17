
import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedTradeData {
  entryPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
}

export const extractTradeParamsFromImage = async (base64Image: string, apiKey: string): Promise<ExtractedTradeData | null> => {
  if (!apiKey) {
    throw new Error("Gemini API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Extract MIME type if present, default to png if raw base64 provided
  let mimeType = "image/png";
  const match = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  if (match && match[1]) {
    mimeType = match[1];
  }

  // Remove the data URL prefix if present to get raw base64
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            text: `Analyze this screenshot of a TradingView position tool. 
                   Extract the following specific values:
                   1. "Entry price"
                   2. The Price value under the "PROFIT LEVEL" section (Take Profit)
                   3. The Price value under the "STOP LEVEL" section (Stop Loss)
                   
                   Ignore all other ticks, percentages, or account sizes. Only return the price values.`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            entryPrice: { type: Type.NUMBER },
            takeProfit: { type: Type.NUMBER },
            stopLoss: { type: Type.NUMBER }
          },
          required: ["entryPrice", "takeProfit", "stopLoss"]
        }
      }
    });

    const text = response.text;
    if (text) {
       // Robust cleanup for markdown code blocks (```json ... ```)
       const cleanedText = text.replace(/```json|```/g, '').trim();
       const parsed = JSON.parse(cleanedText);
       return parsed as ExtractedTradeData;
    }

    return null;

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    throw new Error(error.message || "Failed to analyze image.");
  }
};
