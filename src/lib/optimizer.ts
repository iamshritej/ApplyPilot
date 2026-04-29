import { extractKeywords, inferJobDetails } from "@/lib/keywords";
import { callOpenAIJson } from "@/lib/openai";
import type { CareerAdvice, MatchResult, OptimizationResult, ResumeRecord } from "@/lib/types";

const optimizationSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["optimizedText", "summary", "addedKeywords", "improvedBullets", "jobTitle", "companyName"],
  properties: {
    optimizedText: { type: "string" },
    summary: { type: "string" },
    addedKeywords: {
      type: "array",
      items: { type: "string" }
    },
    improvedBullets: {
      type: "array",
      items: { type: "string" }
    },
    jobTitle: { type: "string" },
    companyName: { type: "string" }
  }
};

const adviceSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["shouldApply", "reasoning", "growthPotentialScore", "skillGapAnalysis", "suggestedFocus"],
  properties: {
    shouldApply: { type: "boolean" },
    reasoning: { type: "string" },
    growthPotentialScore: { type: "number" },
    skillGapAnalysis: {
      type: "array",
      items: { type: "string" }
    },
    suggestedFocus: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export async function optimizeResume(input: {
  resume: ResumeRecord;
  jd: string;
  match?: MatchResult;
  jobTitle?: string;
  companyName?: string;
}): Promise<OptimizationResult> {
  const jobDetails = inferJobDetails(input.jd);
  const jobTitle = input.jobTitle || jobDetails.jobTitle;
  const companyName = input.companyName || jobDetails.companyName;
  const missingKeywords =
    input.match?.missingKeywords.length ? input.match.missingKeywords : getMissingKeywords(input.jd, input.resume.text);

  const aiResult = await callOpenAIJson<OptimizationResult>({
    schemaName: "optimized_resume",
    schema: optimizationSchema,
    system: [
      "You are an expert ATS resume editor.",
      "Edit only resume text content while preserving the source resume's section order, voice, and formatting intent.",
      "Do not invent employers, credentials, degrees, dates, metrics, or tools.",
      "Add only truthful, JD-relevant keywords that are supported by the resume context.",
      "Keep the result concise enough for one page, around 450 to 650 words maximum.",
      "Return JSON only."
    ].join(" "),
    user: JSON.stringify({
      jobTitle,
      companyName,
      jobDescription: input.jd,
      currentResumeText: input.resume.text,
      missingKeywords,
      requiredRules: [
        "ATS-friendly text",
        "one page only",
        "preserve section order",
        "preserve bullet style as much as plain text allows",
        "no font or layout instructions in the text"
      ]
    })
  }).catch(() => null);

  if (aiResult?.optimizedText) {
    return {
      ...aiResult,
      optimizedText: trimToOnePage(aiResult.optimizedText),
      jobTitle,
      companyName
    };
  }

  return fallbackOptimization(input.resume.text, input.jd, missingKeywords, jobTitle, companyName);
}

export async function generateCareerAdvice(input: {
  jd: string;
  resume?: ResumeRecord | null;
  match?: MatchResult | null;
}): Promise<CareerAdvice> {
  const jdKeywords = extractKeywords(input.jd, 35);
  const resumeText = input.resume?.text ?? "";
  const resumeKeywords = extractKeywords(resumeText, 35);
  const missing = jdKeywords.filter((keyword) => !resumeKeywords.includes(keyword)).slice(0, 8);
  const score = input.match?.score ?? Math.max(35, 86 - missing.length * 7);

  const aiResult = await callOpenAIJson<CareerAdvice>({
    schemaName: "career_advice",
    schema: adviceSchema,
    system: [
      "You are a practical career advisor.",
      "Use the JD and available resume evidence to decide whether the user should apply.",
      "Be direct, realistic, and concise.",
      "Return JSON only."
    ].join(" "),
    user: JSON.stringify({
      jobDescription: input.jd,
      resumeText,
      matchScore: input.match?.score,
      missingKeywords: missing
    })
  }).catch(() => null);

  if (aiResult) {
    return {
      ...aiResult,
      growthPotentialScore: clampScore(aiResult.growthPotentialScore)
    };
  }

  return {
    shouldApply: score >= 58,
    reasoning:
      score >= 72
        ? "The resume already overlaps with the JD on core responsibilities and keywords."
        : score >= 58
          ? "The role is reachable with targeted resume optimization and a focused application."
          : "The JD shows several gaps that may weaken the application unless there is unstated experience.",
    growthPotentialScore: clampScore(score + Math.min(12, missing.length * 2)),
    skillGapAnalysis: missing.length ? missing.map((keyword) => `Make ${keyword} visible if you have real experience.`) : ["No major keyword gaps detected."],
    suggestedFocus: missing.slice(0, 4)
  };
}

function fallbackOptimization(
  resumeText: string,
  jd: string,
  missingKeywords: string[],
  jobTitle: string,
  companyName: string
): OptimizationResult {
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const keywordsToAdd = missingKeywords.slice(0, 8);
  const improvedLines: string[] = [];
  let addedKeywordIndex = 0;
  const bulletPrefix = /^(\s*[-*•]\s+)/;

  for (const line of lines) {
    const match = line.match(bulletPrefix);
    if (match && addedKeywordIndex < keywordsToAdd.length && line.length < 180) {
      const keyword = keywordsToAdd[addedKeywordIndex];
      addedKeywordIndex += 1;
      improvedLines.push(`${match[1]}${strengthenBullet(line.replace(bulletPrefix, ""), keyword)}`);
      continue;
    }

    improvedLines.push(line);
  }

  if (keywordsToAdd.length > addedKeywordIndex) {
    improvedLines.push("CORE KEYWORDS");
    improvedLines.push(keywordsToAdd.slice(addedKeywordIndex).join(" | "));
  }

  return {
    optimizedText: trimToOnePage(improvedLines.join("\n")),
    summary: `Optimized toward ${jobTitle} at ${companyName} with targeted JD keywords.`,
    addedKeywords: keywordsToAdd,
    improvedBullets: keywordsToAdd.slice(0, addedKeywordIndex),
    jobTitle,
    companyName
  };
}

function strengthenBullet(text: string, keyword: string) {
  const trimmed = text.trim();
  if (trimmed.toLowerCase().includes(keyword.toLowerCase())) {
    return trimmed;
  }

  return `${trimmed}; aligned work with ${keyword}`;
}

function getMissingKeywords(jd: string, resumeText: string) {
  const jdKeywords = extractKeywords(jd, 35);
  const resumeKeywords = new Set(extractKeywords(resumeText, 45));
  return jdKeywords.filter((keyword) => !resumeKeywords.has(keyword)).slice(0, 12);
}

export function trimToOnePage(text: string) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words.length <= 680) {
    return text.trim();
  }

  return `${words.slice(0, 680).join(" ")}\n\nAdditional older detail removed to keep this version to one page.`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
