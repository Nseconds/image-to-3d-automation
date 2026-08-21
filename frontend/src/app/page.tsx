'use client';

import React, { useState, useEffect } from 'react';

interface ResultData {
  status: string;
  requestId: string;
  originalIdea: string;
  refinedPrompt: string;
  rawImageUrl: string;
  processedImageUrl: string;
  glbUrl: string;
}

export default function Home() {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0: Idle, 1: OpenRouter, 2: Gemini, 3: FastAPI, 4: S3, 5: Done
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simulated progress timer to update UI state since the API is synchronous
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(timer);
            return 95; // Hold at 95% until response returns
          }
          
          const nextProgress = prev + Math.random() * 4;
          
          // Map progress percentages to pipeline steps
          if (nextProgress < 20) {
            setCurrentStep(1); // OpenRouter Prompt Refinement
          } else if (nextProgress < 65) {
            setCurrentStep(2); // Gemini Image Gen
          } else if (nextProgress < 85) {
            setCurrentStep(3); // FastAPI Processing
          } else {
            setCurrentStep(4); // S3 storage upload
          }
          
          return parseFloat(nextProgress.toFixed(1));
        });
      }, 500);
    } else {
      setProgress(0);
      setCurrentStep(0);
    }
    
    return () => clearInterval(timer);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setProgress(0);
    setCurrentStep(1);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idea }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate asset');
      }

      const data = await response.json();
      setResult(data);
      setProgress(100);
      setCurrentStep(5);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during asset generation.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'Prompt Refinement', desc: 'Expanding idea via OpenRouter LLM', id: 1 },
    { title: 'Image Generation', desc: 'Rendering subject via Google Gemini', id: 2 },
    { title: 'Asset Processor', desc: 'Local FastAPI background removal & crop', id: 3 },
    { title: 'Object Storage', desc: 'Saving files to S3 / MinIO', id: 4 },
  ];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.badge}>PART 21 - REQUIRED REPORT</div>
        <h1 style={styles.title}>
          AI TEXT-TO-3D <span className="gradient-text">ASSET PREPARATION</span>
        </h1>
        <p style={styles.subtitle}>
          Turn text ideas into clean, centered, transparent square PNGs prepped for 3D reconstruction.
        </p>
      </header>

      <main style={styles.mainGrid}>
        {/* Left Column: Inputs & Status */}
        <section style={styles.leftCol}>
          <div className="glass-panel" style={styles.panelCard}>
            <h2 style={styles.panelTitle}>1. Prompt Intake</h2>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.inputWrapper}>
                <textarea
                  className="input-field"
                  placeholder="e.g. 'a cute red robot mascot, stylized, game asset'"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  disabled={loading}
                  rows={3}
                  style={styles.textarea}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={loading || !idea.trim()}
                style={styles.submitBtn}
              >
                {loading ? (
                  <>
                    <svg style={styles.spinner} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="30 150" />
                    </svg>
                    Generating... {progress}%
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    Generate Asset Layers
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Pipeline Tracker */}
          {(loading || result || error) && (
            <div className="glass-panel" style={{ ...styles.panelCard, marginTop: '24px' }}>
              <h2 style={styles.panelTitle}>2. Pipeline Status</h2>
              
              {/* Progress Bar */}
              <div style={styles.progressContainer}>
                <div style={{ 
                  ...styles.progressBar, 
                  width: `${progress}%`,
                  background: error ? 'var(--error)' : 'var(--accent-gradient)'
                }} />
              </div>

              {error && (
                <div style={styles.errorBanner}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <strong>Pipeline Error:</strong> {error}
                  </div>
                </div>
              )}

              <div style={styles.stepsTimeline}>
                {steps.map((step) => {
                  let stepStatus = 'pending';
                  if (currentStep > step.id || (currentStep === 5 && !error)) {
                    stepStatus = 'completed';
                  } else if (currentStep === step.id && !error) {
                    stepStatus = 'active';
                  } else if (error && currentStep === step.id) {
                    stepStatus = 'failed';
                  }

                  return (
                    <div key={step.id} style={styles.timelineStep}>
                      <div style={{
                        ...styles.stepIndicator,
                        backgroundColor: stepStatus === 'completed' ? 'var(--success)' : 
                                         stepStatus === 'active' ? 'var(--accent-purple)' : 
                                         stepStatus === 'failed' ? 'var(--error)' : 'rgba(255,255,255,0.05)',
                        borderColor: stepStatus === 'active' ? 'var(--accent-cyan)' : 'transparent'
                      }}>
                        {stepStatus === 'completed' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : stepStatus === 'active' ? (
                          <div style={styles.pulseDot} />
                        ) : stepStatus === 'failed' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        ) : (
                          <span style={styles.stepNum}>{step.id}</span>
                        )}
                      </div>
                      <div style={styles.stepDetails}>
                        <h4 style={{
                          ...styles.stepTitle,
                          color: stepStatus === 'active' ? 'var(--text-primary)' : 
                                 stepStatus === 'completed' ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}>
                          {step.title}
                        </h4>
                        <p style={styles.stepDesc}>{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Comparative Workspace */}
        <section style={styles.rightCol}>
          <div className="glass-panel" style={styles.viewportCard}>
            <div style={styles.viewportHeader}>
              <h2 style={styles.viewportTitle}>Comparative Workspace</h2>
              {result && (
                <div style={styles.viewportBadge}>
                  ID: {result.requestId.split('-')[0]}
                </div>
              )}
            </div>

            {/* Split Screen Viewport */}
            <div style={styles.splitViewport}>
              {/* Left Side: Raw Generated Image */}
              <div style={styles.viewPane}>
                <div style={styles.paneLabel}>RAW GENERATED IMAGE (GEMINI)</div>
                <div style={styles.imageContainer}>
                  {loading && !result && (
                    <div style={styles.placeholderBox} className="shimmer-bg">
                      <span style={styles.placeholderText}>Awaiting pipeline...</span>
                    </div>
                  )}
                  {!loading && !result && (
                    <div style={styles.placeholderBox}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <span style={styles.placeholderText}>Submit a prompt to start</span>
                    </div>
                  )}
                  {result && (
                    <img 
                      src={result.rawImageUrl} 
                      alt="Raw Asset" 
                      style={styles.assetImg} 
                      onError={(e) => {
                        // Fallback in case localhost S3 is inaccessible
                        console.error('Image load failed, trying fallback source');
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Right Side: Processed Square PNG */}
              <div style={styles.viewPane}>
                <div style={styles.paneLabel}>ISOLATED TRANSPARENT PNG (FASTAPI)</div>
                <div style={{ ...styles.imageContainer, ...styles.checkerboardBg }}>
                  {loading && !result && (
                    <div style={styles.placeholderBox} className="shimmer-bg">
                      <span style={styles.placeholderText}>Processing layers...</span>
                    </div>
                  )}
                  {!loading && !result && (
                    <div style={styles.placeholderBox}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                      <span style={styles.placeholderText}>Subject isolation preview</span>
                    </div>
                  )}
                  {result && (
                    <img 
                      src={result.processedImageUrl} 
                      alt="Processed Asset" 
                      style={styles.assetImg} 
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Prompt details panel */}
            {result && (
              <div style={styles.promptDetailsBox}>
                <h4 style={styles.detailsHeading}>Refined Prompt (OpenRouter)</h4>
                <div style={styles.promptTextarea}>
                  {result.refinedPrompt}
                </div>
              </div>
            )}

            {/* CTA Controls */}
            {result && (
              <div style={styles.ctaControls}>
                <a 
                  href={result.glbUrl} 
                  download={`model_${result.requestId}.glb`}
                  className="btn-primary"
                  style={styles.ctaBtn}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  Download 3D Model (.glb)
                </a>

                <a 
                  href={result.processedImageUrl} 
                  download={`3d_ready_${result.requestId}.png`}
                  className="btn-secondary"
                  style={styles.ctaBtn}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  Download Processed PNG
                </a>
              </div>
            )}
          </div>

          {/* Quick Guide */}
          <div className="glass-panel" style={styles.guideCard}>
            <h3 style={styles.guideTitle}>Next Steps Guide:</h3>
            <ol style={styles.guideList}>
              <li>Submit your idea and watch the automated pipeline run.</li>
              <li>First, OpenRouter expands the prompt. Gemini generates the image.</li>
              <li>Next, the FastAPI service removes the background, crops, and normalizes the image.</li>
              <li>Finally, the Puppeteer automation service uploads the PNG headlessly to <code>image-to-3d.ai</code>, converts it to 3D, and downloads the finished model.</li>
              <li>Click <strong>Download 3D Model (.glb)</strong> to save your 3D asset directly!</li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  badge: {
    background: 'rgba(124, 58, 237, 0.15)',
    border: '1px solid rgba(124, 58, 237, 0.3)',
    color: '#a78bfa',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 800,
    lineHeight: '1.2',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '1.1rem',
    maxWidth: '600px',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: '32px',
    alignItems: 'start',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  panelCard: {
    padding: '24px',
  },
  panelTitle: {
    fontSize: '1.25rem',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '10px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputWrapper: {
    position: 'relative',
  },
  textarea: {
    resize: 'none',
    width: '100%',
  },
  submitBtn: {
    width: '100%',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
    width: '20px',
    height: '20px',
    color: '#ffffff',
  },
  progressContainer: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.4s cubic-bezier(0.1, 0.8, 0.25, 1)',
  },
  errorBanner: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '12px',
    padding: '16px',
    color: '#fca5a5',
    fontSize: '0.9rem',
    lineHeight: '1.4',
    marginBottom: '20px',
  },
  stepsTimeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  timelineStep: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  stepIndicator: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid transparent',
    transition: 'all 0.3s ease',
    flexShrink: 0,
  },
  stepNum: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#fff',
    borderRadius: '50%',
    animation: 'pulseGlow 1.5s infinite ease-in-out',
  },
  stepDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  stepTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  stepDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  viewportCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  viewportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '10px',
  },
  viewportTitle: {
    fontSize: '1.25rem',
  },
  viewportBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-secondary)',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
  },
  splitViewport: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  viewPane: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  paneLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    letterSpacing: '0.05em',
  },
  imageContainer: {
    aspectRatio: '1',
    backgroundColor: 'rgba(10, 15, 30, 0.4)',
    border: '1px solid var(--card-border)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  checkerboardBg: {
    // Checkerboard CSS pattern to highlight transparency
    backgroundImage: `
      linear-gradient(45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.03) 75%),
      linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.03) 75%)
    `,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
  },
  placeholderBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    height: '100%',
  },
  placeholderText: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
  },
  assetImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  promptDetailsBox: {
    backgroundColor: 'rgba(10, 15, 30, 0.4)',
    border: '1px solid var(--card-border)',
    borderRadius: '12px',
    padding: '16px',
  },
  detailsHeading: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: '8px',
  },
  promptTextarea: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  ctaControls: {
    display: 'flex',
    gap: '16px',
    marginTop: '10px',
  },
  ctaBtn: {
    flex: 1,
    textDecoration: 'none',
  },
  guideCard: {
    padding: '24px',
  },
  guideTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: '12px',
  },
  guideList: {
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
};
