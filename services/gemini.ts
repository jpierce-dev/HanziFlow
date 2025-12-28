
import { GoogleGenAI, Modality } from "@google/genai";
import { HanziInfo, SearchResult } from "../types";

// 全局单例
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    // 修复：不强制指定 sampleRate，让 AudioContext 使用设备原生的采样率（通常是 44100 或 48000）
    // 强制指定 24000 在某些 Android 设备上会导致 Context 创建失败或无声
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

// Base64 解码
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// 解码音频数据
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  // 这里创建 Buffer 时指定 sampleRate 为 24000 (模型输出的频率)
  // Web Audio API 会自动处理重采样，使其适应 AudioContext 的硬件频率
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const getAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || "" });

export const searchCharactersByPinyin = async (pinyin: string): Promise<SearchResult[]> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `List 12 characters for pinyin "${pinyin}". Format: {"results": [{"char": "...", "pinyin": "...", "brief": "..."}]}`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || '{"results": []}').results || [];
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
};

export const getCharacterDetails = async (char: string): Promise<HanziInfo | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Details for "${char}". Format: {"character": "...", "pinyin": "...", "meaning": "...", "radical": "...", "strokes": 0, "examples": ["..."]}`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || 'null');
  } catch (error) {
    console.error("Detail error:", error);
    return null;
  }
};

export const speakText = async (text: string, ctx: AudioContext): Promise<void> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }], // 简化 Prompt，直接读内容
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' }, // 使用 Zephyr，通常更清晰
          },
        },
      },
    });

    const base64Data = response.candidates?.[0]?.content?.parts[0]?.inlineData?.data;
    if (!base64Data) return;

    const audioBytes = decodeBase64(base64Data);
    // 明确告诉解码器音频源是 24000Hz
    const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (error) {
    console.error("Audio Playback Error:", error);
  }
};

export { getAudioContext };
