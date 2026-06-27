import { env } from "./config/environment.js";

export const aiService = {
  async explainRoadmap(missingSkills: string[]) {
    if (!env.GEMINI_API_KEY) return `This roadmap prioritizes ${missingSkills.slice(0, 3).join(", ") || "role fundamentals"}, then builds proof through projects and interview practice.`;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `In 60 words, explain a career roadmap focused on: ${missingSkills.join(", ")}` }] }] })
      });
      if (!response.ok) throw new Error("AI provider failed");
      const json: any = await response.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text || "Follow the phases in order and validate each skill with practical evidence.";
    } catch {
      return "Start with the highest-weight missing skills, apply them in a project, then reinforce them through interview practice.";
    }
  },
  summarizeFeedback(text: string) {
    return text.split(/[.!?]\s+/).filter(Boolean).slice(0, 4).map(item => item.trim());
  },
  extractResumeSkills(text: string, known: string[]) {
    const normalized = text.toLowerCase();
    return known.filter(skill => normalized.includes(skill.toLowerCase()));
  }
};
