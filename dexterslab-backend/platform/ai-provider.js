import { GoogleGenAI } from '@google/genai';

export class AIProvider {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.genai = null;

    if (this.geminiApiKey) {
      this.genai = new GoogleGenAI({ apiKey: this.geminiApiKey });
      console.log('[Platform] AI Provider initialized (Gemini)');
    } else {
      console.warn('[Platform] ⚠️ No GEMINI_API_KEY — LLM features disabled');
    }
  }

  isAvailable() {
    return this.genai !== null;
  }

  getGenAI() {
    return this.genai;
  }
}
