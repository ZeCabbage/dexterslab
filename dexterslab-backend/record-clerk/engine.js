import { GoogleGenAI } from '@google/genai';

export class RecordClerkEngine {
  constructor(options = {}) {
    this.genai = options.genai;
    this.latestFrame = null;
    this.catalog = [];
    this._broadcastFn = null;
    
    // Clerk internal state broadcast to frontend
    this.state = {
      emotion: 'smiling',
      mouthState: 'closed', // open/closed for lip sync
      overlayText: '',
      isListening: false,
    };
  }
  
  start(broadcastFn) {
    this._broadcastFn = broadcastFn;
    this.fetchCatalog();
    this.tickInterval = setInterval(() => this._tick(), 16); // 60fps
    console.log('🌼 The Record Clerk Engine started');
  }
  
  stop() {
    clearInterval(this.tickInterval);
  }
  
  _tick() {
    if (this._broadcastFn) {
      this._broadcastFn(this.state);
    }
  }

  setMouthState(state) {
    this.state.mouthState = state;
  }

  async fetchCatalog() {
    try {
      const res = await fetch('https://dandelionrecords.ca/products.json?limit=250');
      const data = await res.json();
      this.catalog = data.products.map(p => ({
        title: p.title,
        id: p.id,
        tags: p.tags,
        product_type: p.product_type,
        vendor: p.vendor,
        handle: p.handle
      }));
      console.log(`🌼 Catalog loaded: ${this.catalog.length} items.`);
    } catch (e) {
      console.error('🌼 Failed to fetch catalog:', e);
    }
  }

  async processFrame(jpegBuffer) {
    this.latestFrame = jpegBuffer;
    // We could do basic face tracking here, but for now just cache the frame.
  }

  async handleConversation(text) {
    console.log('[Clerk] Heard:', text);
    this.state.overlayText = text;

    if (!this.genai) {
      return { response: "I'm sorry, my brain is unplugged currently." };
    }

    // Capture the latest frame
    const frameData = this.latestFrame ? Buffer.from(this.latestFrame).toString('base64') : null;

    // Use only a sample of the catalog so we don't blow up the prompt size
    // We shuffle it or just take the first 50
    const catalogSubset = [...this.catalog].sort(() => 0.5 - Math.random()).slice(0, 50);
    const catalogSummary = catalogSubset.map(c => `- ${c.title}`).join('\n');
    
    const prompt = `You are The Record Clerk, a friendly digital assistant at Dandelion Records. You are a literal Dandelion character on a screen. 
The user is speaking to you. You can see them through the camera frame provided.
If they are holding up a vinyl record, identify it from the image! Be specific and knowledgeable.
Give insights into the music and genre.
Recommend exactly one similar record from our current catalogue based on their interests. Try to match the vibe.
Keep your response short and conversational (2-3 sentences). Act naturally!

Dandelion Records Current Catalogue Sample:
${catalogSummary}

User said: "${text}"`;

    const contents = [ { text: prompt } ];
    if (frameData) {
      contents.push({
        inlineData: {
          data: frameData,
          mimeType: 'image/jpeg',
        }
      });
    }

    try {
      this.state.emotion = 'thinking';
      
      const response = await this.genai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: contents,
        config: { temperature: 0.7 }
      });
      
      const responseText = response.text;
      this.state.emotion = 'talking';
      
      // Simulate lip sync duration based on text length (approx 50ms per character)
      setTimeout(() => { this.state.emotion = 'smiling'; }, responseText.length * 50);

      this.state.overlayText = responseText;
      return { response: responseText };
    } catch (e) {
      console.error('🌼 Clerk AI error:', e);
      this.state.emotion = 'sad';
      this.state.overlayText = "Oh dear, I had a little brain fade. Could you ask me again?";
      return { response: "Oh dear, I had a little brain fade. Could you ask me again?" };
    }
  }
}
