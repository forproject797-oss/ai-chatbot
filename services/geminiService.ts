
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. The application may not function correctly.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export function createChatSession(): Chat {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: SYSTEM_PROMPT,
        }
    });
}

export async function sendMessageToAI(chat: Chat, message: string): Promise<string> {
    try {
        const response: GenerateContentResponse = await chat.sendMessage({ message });
        return response.text;
    } catch (error) {
        console.error("Error sending message to Gemini:", error);
        return "I'm sorry, but I'm having trouble connecting right now. Please try again later.";
    }
}
