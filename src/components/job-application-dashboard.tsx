"use client";

import {
  Archive,
  BadgeCheck,
  Brain,
  BriefcaseBusiness,
  Check,
  CircleAlert,
  ClipboardList,
  Download,
  Eye,
  FileInput,
  FileText,
  Gauge,
  Loader2,
  Sparkles,
  Upload,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ApplicationRecord, CareerAdvice, MatchResult, OptimizationResult, PublicResume } from "@/lib/types";
import { formatBytes } from "@/lib/keywords";

type MatchResponse = {
  matches: MatchResult[];
  bestMatch?: MatchResult | null;
  jdKeywords: string[];
  jobDetails: {
    jobTitle: string;
    companyName: string;
  };
};

type OptimizedState = {
  resume: PublicResume;
  optimization: OptimizationResult;
  match: MatchResult;
};

type PreviewState = {
  title: string;
  url: string;
};

export function JobApplicationDashboard() {
  const [resumes, setResumes] = useState<PublicResume[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [jd, setJd] = useState("");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [jdKeywords, setJdKeywords] = useState<string[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [advice, setAdvice] = useState<CareerAdvice | null>(null);
  const [optimized, setOptimized] = useState<OptimizedState | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [notice, setNotice] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSavingApplication, setIsSavingApplication] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === selectedResumeId) ?? null,
    [resumes, selectedResumeId]
  );

  const refreshData = useCallback(async () => {
    const [resumeResponse, applicationResponse] = await Promise.all([
      fetch("/api/resumes"),
      fetch("/api/applications")
    ]);
    const resumeData = (await resumeResponse.json()) as { resumes: PublicResume[] };
    const applicationData = (await applicationResponse.json()) as { applications: ApplicationRecord[] };
    setResumes(resumeData.resumes);
    setApplications(applicationData.applications);
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/resumes", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || `Could not upload ${file.name}`);
        }
      }

      await refreshData();
      setNotice("Resume upload complete.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function analyzeJobDescription() {
    if (!jd.trim()) {
      setNotice("Paste a job description first.");
      return;
    }

    setIsMatching(true);
    setOptimized(null);
    try {
      const [matchResponse, adviceResponse] = await Promise.all([
        fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd })
        }),
        fetch("/api/advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd, resumeId: selectedResumeId || undefined })
        })
      ]);

      if (!matchResponse.ok) {
        throw new Error("Matching failed.");
      }

      const matchData = (await matchResponse.json()) as MatchResponse;
      const adviceData = (await adviceResponse.json()) as { advice: CareerAdvice };
      setMatches(matchData.matches);
      setJdKeywords(matchData.jdKeywords);
      setAdvice(adviceData.advice);
      setJobTitle(matchData.jobDetails.jobTitle);
      setCompanyName(matchData.jobDetails.companyName);

      const bestId = matchData.bestMatch?.resumeId || matchData.matches[0]?.resumeId || selectedResumeId;
      if (bestId) {
        setSelectedResumeId(bestId);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Matching failed.");
    } finally {
      setIsMatching(false);
    }
  }

  async function optimizeSelectedResume() {
    if (!selectedResumeId || !jd.trim()) {
      setNotice("Select a resume and add a job description.");
      return;
    }

    setIsOptimizing(true);
    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: selectedResumeId,
          jd,
          jobTitle,
          companyName
        })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Optimization failed.");
      }

      const data = (await response.json()) as {
        optimizedResume: PublicResume;
        optimization: OptimizationResult;
        match: MatchResult;
      };

      setOptimized({
        resume: data.optimizedResume,
        optimization: data.optimization,
        match: data.match
      });
      setResumes((current) => [data.optimizedResume, ...current]);
      setShowApplicationForm(false);
      setNotice("Optimized resume generated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Optimization failed.");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!optimized || !selectedResumeId) {
      return;
    }

    setIsSavingApplication(true);
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          companyName,
          resumeId: selectedResumeId,
          optimizedResumeId: optimized.resume.id
        })
      });

      if (!response.ok) {
        throw new Error("Could not save application.");
      }

      const data = (await response.json()) as { application: ApplicationRecord };
      setApplications((current) => [data.application, ...current]);
      setShowApplicationForm(false);
      setNotice("Application saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save application.");
    } finally {
      setIsSavingApplication(false);
    }
  }

  const optimizedCount = resumes.filter((resume) => resume.kind === "optimized").length;
  const bestScore = matches[0]?.score ?? 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <BriefcaseBusiness size={22} />
            </div>
            <div>
              <h1 className="brand-title">ApplyPilot</h1>
              <p className="brand-subtitle">Resume matching, optimization, and application tracking</p>
            </div>
          </div>
          <div className="status-pill">
            <Sparkles size={16} />
            AI-ready MVP
          </div>
        </div>

        <div className="metric-grid" aria-label="Dashboard metrics">
          <Metric value={resumes.length} label="Resumes" />
          <Metric value={optimizedCount} label="Versions" />
          <Metric value={applications.length} label="Applications" />
          <Metric value={bestScore ? `${bestScore}%` : "-"} label="Best match" />
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="panel span-5">
          <PanelHeader icon={<Archive size={18} />} title="Uploaded Resumes" count={resumes.length} />
          <div className="panel-body">
            <label className="upload-zone">
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                onChange={(event) => void handleUpload(event.target.files)}
              />
              <span className="upload-content">
                {isUploading ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                {isUploading ? "Uploading" : "Upload PDF or DOCX"}
              </span>
            </label>

            <div className="resume-list">
              {resumes.length === 0 ? (
                <div className="empty-state">No resumes yet</div>
              ) : (
                resumes.map((resume) => (
                  <article className="resume-row" key={resume.id}>
                    <div>
                      <div className="resume-name">{resume.originalName}</div>
                      <div className="resume-meta">
                        <span className={resume.kind === "optimized" ? "tag optimized" : "tag"}>
                          {resume.kind === "optimized" ? "Optimized" : "Original"}
                        </span>
                        <span>{formatBytes(resume.size)}</span>
                        <span>v{resume.version}</span>
                      </div>
                    </div>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title="Select"
                        aria-label={`Select ${resume.originalName}`}
                        onClick={() => setSelectedResumeId(resume.id)}
                      >
                        {selectedResumeId === resume.id ? <BadgeCheck size={18} /> : <FileInput size={18} />}
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        title="Preview"
                        aria-label={`Preview ${resume.originalName}`}
                        onClick={() => setPreview({ title: resume.originalName, url: resume.previewUrl })}
                      >
                        <Eye size={18} />
                      </button>
                      <a
                        className="icon-button"
                        title="Download"
                        aria-label={`Download ${resume.originalName}`}
                        href={resume.downloadUrl}
                      >
                        <Download size={18} />
                      </a>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="panel span-7">
          <PanelHeader icon={<FileText size={18} />} title="Job Description" count={jdKeywords.length} />
          <div className="panel-body">
            <textarea
              className="textarea"
              value={jd}
              onChange={(event) => setJd(event.target.value)}
              placeholder="Paste the JD here"
              aria-label="Job description"
            />
            <div className="form-grid two" style={{ marginTop: 10 }}>
              <input
                className="input"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Job title"
                aria-label="Job title"
              />
              <input
                className="input"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Company"
                aria-label="Company name"
              />
            </div>
            <div className="action-row">
              <button className="button primary" type="button" onClick={analyzeJobDescription} disabled={isMatching}>
                {isMatching ? <Loader2 className="spin" size={17} /> : <Gauge size={17} />}
                Analyze
              </button>
              <button
                className="button"
                type="button"
                onClick={optimizeSelectedResume}
                disabled={isOptimizing || !selectedResumeId || !jd.trim()}
              >
                {isOptimizing ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
                Optimize
              </button>
            </div>
          </div>
        </section>

        <section className="panel span-7">
          <PanelHeader icon={<Gauge size={18} />} title="Match Results" count={matches.length} />
          <div className="panel-body">
            {matches.length === 0 ? (
              <div className="empty-state">No match results</div>
            ) : (
              <div className="match-list">
                {matches.map((match) => (
                  <article className="match-row" key={match.resumeId}>
                    <div className="match-head">
                      <div>
                        <div className="resume-name">{match.resumeName}</div>
                        <div className="resume-meta">
                          <span>Skills {match.skillsScore}%</span>
                          <span>Keywords {match.keywordScore}%</span>
                          <span>Role {match.roleScore}%</span>
                          <span>Semantic {match.semanticScore}%</span>
                        </div>
                      </div>
                      <div className="score">{match.score}%</div>
                    </div>
                    <div className="score-bar" aria-label={`${match.score}% match`}>
                      <div className="score-fill" style={{ width: `${match.score}%` }} />
                    </div>
                    <p className="muted" style={{ margin: 0 }}>
                      {match.rationale}
                    </p>
                    <div className="keyword-row">
                      {match.matchedKeywords.slice(0, 9).map((keyword) => (
                        <span className="keyword-chip" key={keyword}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <div className="action-row" style={{ marginTop: 0 }}>
                      <button className="button" type="button" onClick={() => setSelectedResumeId(match.resumeId)}>
                        {selectedResumeId === match.resumeId ? <Check size={17} /> : <FileInput size={17} />}
                        {selectedResumeId === match.resumeId ? "Selected" : "Use"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel span-5">
          <PanelHeader icon={<Brain size={18} />} title="AI Advice Panel" count={advice ? 1 : 0} />
          <div className="panel-body">
            {!advice ? (
              <div className="empty-state">No advice yet</div>
            ) : (
              <div className="advice-grid">
                <div className="advice-answer">
                  <div>
                    <div className="muted">Should apply</div>
                    <strong>{advice.reasoning}</strong>
                  </div>
                  <span className={advice.shouldApply ? "answer-badge yes" : "answer-badge no"}>
                    {advice.shouldApply ? "YES" : "NO"}
                  </span>
                </div>
                <div>
                  <div className="resume-meta" style={{ marginBottom: 7 }}>
                    Growth potential
                  </div>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${advice.growthPotentialScore}%` }} />
                  </div>
                  <div className="score" style={{ marginTop: 8 }}>
                    {advice.growthPotentialScore}%
                  </div>
                </div>
                <div className="keyword-row">
                  {advice.skillGapAnalysis.map((gap) => (
                    <span className="keyword-chip" key={gap}>
                      {gap}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel span-5">
          <PanelHeader icon={<Sparkles size={18} />} title="Optimized Resume" count={optimized ? 1 : 0} />
          <div className="panel-body">
            {!optimized ? (
              <div className="empty-state">
                {selectedResume ? `Selected: ${selectedResume.originalName}` : "No optimized version"}
              </div>
            ) : (
              <div className="optimized-preview">
                <div className="selected-line">
                  <BadgeCheck size={18} />
                  {optimized.resume.originalName}
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {optimized.optimization.summary}
                </p>
                <div className="resume-text-preview">{optimized.optimization.optimizedText}</div>
                <div className="action-row" style={{ marginTop: 0 }}>
                  <button
                    className="button"
                    type="button"
                    onClick={() => setPreview({ title: optimized.resume.originalName, url: optimized.resume.previewUrl })}
                  >
                    <Eye size={17} />
                    Preview
                  </button>
                  <a className="button primary" href={optimized.resume.downloadUrl}>
                    <Download size={17} />
                    PDF
                  </a>
                </div>

                <div className="poll-box">
                  <p className="poll-question">Did you apply to this job?</p>
                  <div className="action-row" style={{ marginTop: 0 }}>
                    <button className="button primary" type="button" onClick={() => setShowApplicationForm(true)}>
                      <Check size={17} />
                      YES
                    </button>
                    <button className="button warn" type="button" onClick={() => setShowApplicationForm(false)}>
                      <X size={17} />
                      NO
                    </button>
                  </div>

                  {showApplicationForm ? (
                    <form className="form-grid" onSubmit={(event) => void saveApplication(event)}>
                      <input
                        className="input"
                        value={jobTitle}
                        onChange={(event) => setJobTitle(event.target.value)}
                        placeholder="Job title"
                        required
                      />
                      <input
                        className="input"
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        placeholder="Company name"
                        required
                      />
                      <button className="button primary" disabled={isSavingApplication} type="submit">
                        {isSavingApplication ? <Loader2 className="spin" size={17} /> : <ClipboardList size={17} />}
                        Save Application
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel span-7">
          <PanelHeader icon={<ClipboardList size={18} />} title="Application Tracker" count={applications.length} />
          <div className="panel-body">
            {applications.length === 0 ? (
              <div className="empty-state">No applications saved</div>
            ) : (
              <div className="table-wrap">
                <table className="application-table">
                  <thead>
                    <tr>
                      <th>Job Title</th>
                      <th>Company</th>
                      <th>Date and Time</th>
                      <th>Resume Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td>{application.jobTitle}</td>
                        <td>{application.companyName}</td>
                        <td>{new Date(application.appliedAt).toLocaleString()}</td>
                        <td>{resumeName(application.optimizedResumeId || application.resumeId, resumes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {preview ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Resume preview">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{preview.title}</h2>
              <button className="icon-button" type="button" title="Close" aria-label="Close" onClick={() => setPreview(null)}>
                <X size={18} />
              </button>
            </div>
            <iframe className="preview-frame" title={preview.title} src={preview.url} />
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="toast" role="status">
          <CircleAlert size={16} style={{ marginRight: 8, verticalAlign: "text-bottom" }} />
          {notice}
        </div>
      ) : null}
    </main>
  );
}

function PanelHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="panel-header">
      <div className="panel-heading">
        <span className="section-icon">{icon}</span>
        <h2 className="panel-title">{title}</h2>
      </div>
      <span className="panel-count">{count}</span>
    </div>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="metric">
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function resumeName(id: string, resumes: PublicResume[]) {
  return resumes.find((resume) => resume.id === id)?.originalName ?? id.slice(0, 8);
}
