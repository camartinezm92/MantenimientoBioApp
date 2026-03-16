import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function improveAllTechnicalTexts(fields: Record<string, string>): Promise<Record<string, string>> {
  const entries = Object.entries(fields).filter(([_, value]) => value.trim().length > 0);
  if (entries.length === 0) return fields;

  try {
    const prompt = `Eres un experto Ingeniero Biomédico. Mejora la redacción y coherencia de los siguientes campos de un reporte técnico de mantenimiento. 
    Los textos deben ser técnicos, específicos, profesionales y sin sobrecargar la información. Mantén la esencia de lo que el técnico escribió.
    
    Campos a mejorar:
    ${entries.map(([name, text]) => `- ${name}: "${text}"`).join('\n')}
    
    Responde estrictamente en formato JSON con las mismas llaves proporcionadas y los valores mejorados. No incluyas explicaciones.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    return { ...fields, ...result };
  } catch (error) {
    console.error("Error improving texts with AI:", error);
    return fields;
  }
}
