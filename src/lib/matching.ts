import { embedTexts } from "@/lib/openai";
import { extractKeywords, inferJobDetails, tokenize } from "@/lib/keywords";
import type { MatchResult, ResumeRecord } from "@/lib/types";

export async function rankResumes(jd: string, resumes: ResumeRecord[]): Promise<MatchResult[]> {
  const jdKeywords = extractKeywords(jd, 45);
  const embeddings = await embedTexts([jd, ...resumes.map((resume) => resume.text)]).catch(() => null);
  const jdEmbedding = embeddings?.[0];
  const resumeEmbeddings = embeddings?.slice(1) ?? [];
  const jobDetails = inferJobDetails(jd);

  const matches = resumes.map((resume, index) => {
    const resumeKeywords = resume.keywords.length > 0 ? resume.keywords : extractKeywords(resume.text, 45);
    const resumeKeywordSet = new Set(resumeKeywords);
    const matchedKeywords = jdKeywords.filter((keyword) => resumeKeywordSet.has(keyword)).slice(0, 18);
    const missingKeywords = jdKeywords.filter((keyword) => !resumeKeywordSet.has(keyword)).slice(0, 12);
    const keywordScore = jdKeywords.length ? matchedKeywords.length / jdKeywords.length : 0;
    const skillsScore = getSkillScore(jdKeywords, resumeKeywords);
    const roleScore = getRoleScore(jobDetails.jobTitle, resume.text);
    const semanticScore =
      jdEmbedding && resumeEmbeddings[index]?.length
        ? cosineSimilarity(jdEmbedding, resumeEmbeddings[index])
        : lexicalSimilarity(jd, resume.text);

    const blendedScore = clamp01(
      semanticScore * 0.42 + keywordScore * 0.28 + skillsScore * 0.2 + roleScore * 0.1
    );

    return {
      resumeId: resume.id,
      resumeName: resume.originalName,
      score: Math.round(blendedScore * 100),
      skillsScore: Math.round(skillsScore * 100),
      keywordScore: Math.round(keywordScore * 100),
      roleScore: Math.round(roleScore * 100),
      semanticScore: Math.round(semanticScore * 100),
      matchedKeywords,
      missingKeywords,
      rationale: buildRationale(blendedScore, matchedKeywords, missingKeywords, resume.kind)
    } satisfies MatchResult;
  });

  return matches.sort((a, b) => b.score - a.score);
}

function getSkillScore(jdKeywords: string[], resumeKeywords: string[]) {
  const jdSkillTerms = jdKeywords.filter((keyword) => keyword.includes(".") || keyword.length > 3);
  if (jdSkillTerms.length === 0) {
    return 0;
  }

  const resumeSet = new Set(resumeKeywords);
  const hits = jdSkillTerms.filter((keyword) => resumeSet.has(keyword));
  return hits.length / jdSkillTerms.length;
}

function getRoleScore(jobTitle: string, resumeText: string) {
  const roleTokens = tokenize(jobTitle);
  if (roleTokens.length === 0) {
    return 0.5;
  }

  const resumeTokens = new Set(tokenize(resumeText));
  const hits = roleTokens.filter((token) => resumeTokens.has(token)).length;
  return hits / roleTokens.length;
}

function lexicalSimilarity(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  const vectorA = termVector(aTokens);
  const vectorB = termVector(bTokens);
  const terms = new Set([...vectorA.keys(), ...vectorB.keys()]);
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const term of terms) {
    const av = vectorA.get(term) ?? 0;
    const bv = vectorB.get(term) ?? 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function termVector(tokens: string[]) {
  const vector = new Map<string, number>();
  for (const token of tokens) {
    vector.set(token, (vector.get(token) ?? 0) + 1);
  }
  return vector;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return clamp01(dot / (Math.sqrt(magA) * Math.sqrt(magB)));
}

function buildRationale(score: number, matchedKeywords: string[], missingKeywords: string[], kind: string) {
  if (score >= 0.75) {
    return `Strong ${kind} resume match with ${matchedKeywords.length} JD keywords already present.`;
  }

  if (score >= 0.55) {
    return `Usable match. Optimization should add ${missingKeywords.slice(0, 3).join(", ") || "targeted keywords"}.`;
  }

  return `Lower fit. The JD calls for ${missingKeywords.slice(0, 4).join(", ") || "skills not visible in this resume"}.`;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
