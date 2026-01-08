import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedTradeData {
  entryPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
}

export const extractTradeParamsFromImage = async (base64Image: string): Promise<ExtractedTradeData | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing from environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

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
              mimeType: "image/png",
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
       const parsed = JSON.parse(text);
       return parsed as ExtractedTradeData;
    }

    return null;

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    throw new Error(error.message || "Failed to analyze image.");
  }
};