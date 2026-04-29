export type ResumeKind = "original" | "optimized";

export type ResumeMetadata = {
  jobTitle?: string;
  companyName?: string;
  sourceResumeId?: string;
  summary?: string;
};

export type ResumeRecord = {
  id: string;
  kind: ResumeKind;
  parentId?: string;
  version: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  text: string;
  keywords: string[];
  metadata?: ResumeMetadata;
  createdAt: string;
  updatedAt: string;
};

export type PublicResume = Omit<ResumeRecord, "text" | "storagePath"> & {
  previewUrl: string;
  downloadUrl: string;
};

export type MatchResult = {
  resumeId: string;
  resumeName: string;
  score: number;
  skillsScore: number;
  keywordScore: number;
  roleScore: number;
  semanticScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  rationale: string;
};

export type OptimizationResult = {
  optimizedText: string;
  summary: string;
  addedKeywords: string[];
  improvedBullets: string[];
  jobTitle?: string;
  companyName?: string;
};

export type ApplicationRecord = {
  id: string;
  jobTitle: string;
  companyName: string;
  resumeId: string;
  optimizedResumeId?: string;
  appliedAt: string;
};

export type DownloadLog = {
  id: string;
  resumeId: string;
  fileName: string;
  downloadedAt: string;
};

export type CareerAdvice = {
  shouldApply: boolean;
  reasoning: string;
  growthPotentialScore: number;
  skillGapAnalysis: string[];
  suggestedFocus: string[];
};
