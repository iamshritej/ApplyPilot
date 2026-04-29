const STOPWORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "candidate",
  "company",
  "could",
  "day",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "job",
  "just",
  "more",
  "most",
  "must",
  "my",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "own",
  "per",
  "role",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "work",
  "would",
  "you",
  "your"
]);

const SKILL_TERMS = [
  "accessibility",
  "agile",
  "airflow",
  "analytics",
  "api",
  "aws",
  "azure",
  "backend",
  "bigquery",
  "ci/cd",
  "cloud",
  "collaboration",
  "communication",
  "computer vision",
  "css",
  "customer success",
  "data analysis",
  "data engineering",
  "data pipelines",
  "data science",
  "devops",
  "docker",
  "etl",
  "fastapi",
  "figma",
  "firebase",
  "frontend",
  "gcp",
  "graphql",
  "html",
  "java",
  "javascript",
  "kubernetes",
  "langchain",
  "leadership",
  "llm",
  "machine learning",
  "microservices",
  "mongodb",
  "next.js",
  "node.js",
  "openai",
  "postgresql",
  "product design",
  "python",
  "react",
  "redis",
  "rest",
  "salesforce",
  "sql",
  "stakeholder management",
  "supabase",
  "tailwind",
  "terraform",
  "typescript",
  "ui/ux",
  "vercel"
];

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export function extractKeywords(value: string, limit = 35) {
  const normalized = normalizeText(value);
  const tokens = tokenize(normalized);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const skillHits = SKILL_TERMS.filter((term) => normalized.includes(term));
  for (const skill of skillHits) {
    counts.set(skill, (counts.get(skill) ?? 0) + 5);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([term]) => term);
}

export function inferJobDetails(jd: string) {
  const lines = jd
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  let jobTitle = "";
  let companyName = "";

  for (const line of lines) {
    const titleMatch = line.match(/(?:job\s*title|title|role)\s*[:\-]\s*(.+)$/i);
    if (titleMatch?.[1] && !jobTitle) {
      jobTitle = titleMatch[1].trim();
    }

    const companyMatch = line.match(/(?:company|organization|employer)\s*[:\-]\s*(.+)$/i);
    if (companyMatch?.[1] && !companyName) {
      companyName = companyMatch[1].trim();
    }
  }

  if (!jobTitle && lines[0]) {
    jobTitle = lines[0].replace(/^we are hiring\s*/i, "").slice(0, 80);
  }

  return {
    jobTitle: jobTitle || "Target Role",
    companyName: companyName || "Target Company"
  };
}

export function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
