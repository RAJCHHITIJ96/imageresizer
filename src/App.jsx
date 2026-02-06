import React, { useState, useEffect } from 'react';
import UploadZone from './components/UploadZone';
import { processImage, ASPECT_RATIOS, EXPORT_RESOLUTIONS, COMPRESSION_PRESETS, batchExport, exportWithSettings } from './utils/imageOps';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function App() {
  const [originals, setOriginals] = useState([]);
  const [processed, setProcessed] = useState([]);
  const [ratio, setRatio] = useState("4:5");
  const [mode, setMode] = useState("contain");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing', 'app'

  // Export Settings
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportResolution, setExportResolution] = useState("HD");
  const [exportCompression, setExportCompression] = useState("high");
  const [isExporting, setIsExporting] = useState(false);

  // Live Preview States
  const [originalPreview, setOriginalPreview] = useState(null);
  const [compressedPreview, setCompressedPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [estimatedTotalSize, setEstimatedTotalSize] = useState(0);
  const [originalSize, setOriginalSize] = useState(0);

  // Before/After Slider
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  // Re-process when options or originals change
  useEffect(() => {
    if (originals.length === 0) {
      setProcessed([]);
      return;
    }

    const runProcessing = async () => {
      setIsProcessing(true);
      const results = await Promise.all(
        originals.map(file => processImage(file, ratio, mode))
      );
      setProcessed(results);
      setIsProcessing(false);
    };

    runProcessing();
  }, [originals, ratio, mode]);

  // Generate LIVE preview when export settings change
  useEffect(() => {
    if (!showExportPanel || processed.length === 0) return;

    const generatePreviews = async () => {
      setPreviewLoading(true);
      try {
        const originalResult = await exportWithSettings(processed[0], exportResolution, 'max');
        setOriginalPreview({
          url: URL.createObjectURL(originalResult.blob),
          sizeKB: originalResult.sizeKB,
          sizeMB: originalResult.sizeMB,
          width: originalResult.width,
          height: originalResult.height
        });
        setOriginalSize(originalResult.sizeKB * processed.length);

        const compressedResult = await exportWithSettings(processed[0], exportResolution, exportCompression);
        setCompressedPreview({
          url: URL.createObjectURL(compressedResult.blob),
          sizeKB: compressedResult.sizeKB,
          sizeMB: compressedResult.sizeMB,
          width: compressedResult.width,
          height: compressedResult.height
        });

        setEstimatedTotalSize(compressedResult.sizeKB * processed.length);
      } catch (error) {
        console.error('Preview generation failed:', error);
      }
      setPreviewLoading(false);
    };

    generatePreviews();

    return () => {
      if (originalPreview?.url) URL.revokeObjectURL(originalPreview.url);
      if (compressedPreview?.url) URL.revokeObjectURL(compressedPreview.url);
    };
  }, [showExportPanel, exportResolution, exportCompression, processed]);

  // Slider drag handlers
  const handleSliderMouseDown = () => setIsDragging(true);
  const handleSliderMouseUp = () => setIsDragging(false);

  const handleSliderMouseMove = (e) => {
    if (!isDragging) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleSliderTouchMove = (e) => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleUpload = (files) => {
    setOriginals(prev => [...prev, ...files]);
    setCurrentPage('app');
  };

  // Standard quick download
  const handleDownloadAll = async () => {
    if (processed.length === 0) return;

    const zip = new JSZip();
    processed.forEach((img, index) => {
      const paddedIndex = String(index + 1).padStart(2, '0');
      const originalName = img.name.split('.')[0];
      const itemsName = `${paddedIndex}_${originalName}_${ratio.replace(':', '-')}.jpg`;
      zip.file(itemsName, img.blob);
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "carousel-engine-export.zip");
  };

  // Advanced export with settings
  const handleAdvancedExport = async () => {
    if (processed.length === 0) return;

    setIsExporting(true);

    try {
      const exportedImages = await batchExport(processed, exportResolution, exportCompression);
      const zip = new JSZip();

      exportedImages.forEach((img) => {
        const paddedIndex = String(img.sequenceNumber).padStart(2, '0');
        const originalName = img.name.split('.')[0];
        const itemsName = `${paddedIndex}_${originalName}_${ratio.replace(':', '-')}_${exportResolution}.jpg`;
        zip.file(itemsName, img.blob);
      });

      const content = await zip.generateAsync({ type: "blob" });
      const timestamp = new Date().toISOString().slice(0, 10);
      saveAs(content, `carousel-${exportResolution}-${timestamp}.zip`);

      setShowExportPanel(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatSize = (kb) => {
    if (kb > 1024) return `${(kb / 1024).toFixed(2)} MB`;
    return `${Math.round(kb)} KB`;
  };

  const calculateSavings = () => {
    if (originalSize && estimatedTotalSize) {
      const saved = ((originalSize - estimatedTotalSize) / originalSize) * 100;
      return saved > 0 ? saved.toFixed(0) : 0;
    }
    return 0;
  };

  // ========================
  // LANDING PAGE - CINEMATIC HERO
  // ========================
  if (currentPage === 'landing' && originals.length === 0) {
    return (
      <>
        {/* HERO SECTION - Fixed 100vh */}
        <div className="hero-landing">
          {/* Background Image */}
          <div className="hero-bg"></div>

          {/* Content Overlay */}
          <div className="hero-content">
            {/* Navigation */}
            <nav className="hero-nav">
              <span className="hero-nav__logo">
                engine.
                <span className="hero-nav__version">v1.0.0</span>
              </span>
              <div className="hero-nav__links">
                <a href="#features" className="hero-nav__link">Features</a>
                <a href="https://github.com/RAJCHHITIJ96/imageresizer" target="_blank" rel="noopener noreferrer" className="hero-nav__link">GitHub</a>
                <a href="#" className="hero-nav__link">Docs</a>
                <button
                  onClick={() => setCurrentPage('app')}
                  className="hero-nav__cta"
                >
                  Launch App
                </button>
              </div>
            </nav>

            {/* Main Content - Bottom Left */}
            <main className="hero-main">
              {/* Tagline */}
              <p className="hero-tagline animate-slide-up animate-stagger-1">
                Open Source Tool
              </p>

              {/* Headline with Blinking Cursor */}
              <h1 className="hero-headline animate-slide-up animate-stagger-2">
                Drop your images<br />
                We make them<br />
                carousel-ready<span className="hero-cursor"></span>
              </h1>

              {/* Subline */}
              <p className="hero-subline animate-slide-up animate-stagger-3">
                Batch resize to perfect aspect ratios. Export in 2K/4K.
              </p>

              {/* CTAs */}
              <div className="hero-ctas animate-slide-up animate-stagger-4">
                <button onClick={() => setCurrentPage('app')} className="hero-btn-primary">
                  Launch App →
                </button>
                <a href="https://github.com/RAJCHHITIJ96/imageresizer" target="_blank" rel="noopener noreferrer" className="hero-btn-secondary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub
                </a>
              </div>

              {/* Tech Stack Pills */}
              <div className="hero-tech-stack animate-slide-up animate-stagger-5">
                <span className="hero-tech-pill">React</span>
                <span className="hero-tech-pill">Vite</span>
                <span className="hero-tech-pill">Open Source</span>
              </div>
            </main>

            {/* Hero Footer Bar */}
            <footer className="hero-footer">
              <span className="hero-footer__label">Open Source</span>
              <div className="hero-footer__scroll">
                <span>↓</span>
              </div>
              <span className="hero-footer__credit">by unfilteredchhitij</span>
            </footer>
          </div>
        </div>

        {/* FEATURES SECTION - 2 COLUMN LAYOUT */}
        <section className="features-page" id="features">
          {/* LEFT - Content */}
          <div className="features-content">
            <header className="features-header">
              <p className="features-header__label">Capabilities</p>
              <h2 className="features-header__title">
                Everything creators<br />
                need to ship faster
              </h2>
              <p className="features-header__desc">
                Batch processing, smart resizing, and premium exports — all in one tool.
              </p>
            </header>

            {/* Mini Bento Stats */}
            <div className="bento-grid" style={{
              gridTemplateColumns: 'repeat(2, 1fr)',
              maxWidth: '400px',
              gap: '1rem'
            }}>
              <div className="bento-card">
                <p className="bento-card__label">🖼️ Batch</p>
                <p className="bento-card__value">∞<span>images</span></p>
              </div>
              <div className="bento-card">
                <p className="bento-card__label">✨ Export</p>
                <p className="bento-card__value">4K</p>
              </div>
              <div className="bento-card">
                <p className="bento-card__label">📐 Ratio</p>
                <p className="bento-card__value">4:5</p>
              </div>
              <div className="bento-card">
                <p className="bento-card__label">💾 Compress</p>
                <p className="bento-card__value">-40%</p>
              </div>
            </div>
          </div>

          {/* RIGHT - Image Showcase */}
          <div className="image-showcase">
            <div className="frame-fan">
              <div className="frame-fan__card">
                <img src="/demo1.png" alt="Sample 1" />
              </div>
              <div className="frame-fan__card">
                <img src="/demo2.png" alt="Sample 2" />
              </div>
              <div className="frame-fan__card">
                <img src="/demo3.png" alt="Sample 3" />
              </div>
              <div className="frame-fan__card">
                <img src="/demo4.png" alt="Sample 4" />
              </div>
            </div>
          </div>
        </section>

        {/* DARK FOOTER */}
        <footer className="dark-footer">
          <div className="dark-footer__content">
            <h3 className="dark-footer__title">
              Thanks for<br />
              stopping by
            </h3>
            <p className="dark-footer__desc">Let's move forward together</p>
            <div className="dark-footer__logo">
              <span className="dark-footer__logo-icon">⚡</span>
              <span>engine.</span>
            </div>
          </div>
        </footer>
      </>
    );
  }

  // ========================
  // APP PAGE
  // ========================
  return (
    <div className="container animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-lg) 0',
        borderBottom: '1px solid var(--border)',
        marginBottom: 'var(--space-xl)'
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}
          onClick={() => { setOriginals([]); setCurrentPage('landing'); }}
        >
          <span style={{ fontSize: '1.5rem' }}>⚡</span>
          <span className="text-mono font-semibold">Carousel Engine</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            GitHub
          </a>
        </div>
      </header>

      {/* EXPORT MODAL */}
      {showExportPanel && (
        <div className="modal-overlay">
          <div className="modal animate-fade-in">
            <div className="modal__header">
              <h2 className="modal__title">Export Settings</h2>
              <button className="modal__close" onClick={() => setShowExportPanel(false)}>×</button>
            </div>
            <div className="modal__content">
              <div className="export-grid">
                {/* Left: Options */}
                <div className="export-options">
                  <div className="export-option-group">
                    <span className="export-option-label">Resolution</span>
                    {Object.keys(EXPORT_RESOLUTIONS).map(key => (
                      <button
                        key={key}
                        onClick={() => setExportResolution(key)}
                        className={`export-option-btn ${exportResolution === key ? 'active' : ''}`}
                      >
                        {key}
                        <span>{EXPORT_RESOLUTIONS[key].description}</span>
                      </button>
                    ))}
                  </div>

                  <div className="export-option-group">
                    <span className="export-option-label">Quality</span>
                    {Object.keys(COMPRESSION_PRESETS).map(key => (
                      <button
                        key={key}
                        onClick={() => setExportCompression(key)}
                        className={`export-option-btn ${exportCompression === key ? 'active' : ''}`}
                      >
                        {COMPRESSION_PRESETS[key].label}
                        <span>{Math.round(COMPRESSION_PRESETS[key].quality * 100)}%</span>
                      </button>
                    ))}
                  </div>

                  {/* Size Comparison */}
                  <div className="size-comparison">
                    <div className="size-comparison__label">Size Estimate</div>
                    {compressedPreview && !previewLoading ? (
                      <>
                        <div className="size-comparison__row">
                          <span>Original:</span>
                          <span className="size-comparison__value--original">{formatSize(originalSize)}</span>
                        </div>
                        <div className="size-comparison__row">
                          <span>Compressed:</span>
                          <span className="size-comparison__value--compressed">{formatSize(estimatedTotalSize)}</span>
                        </div>
                        {calculateSavings() > 0 && (
                          <div className="size-comparison__savings">
                            ↓ {calculateSavings()}% smaller
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted" style={{ fontSize: '0.85rem' }}>Calculating...</p>
                    )}
                  </div>

                  <button
                    onClick={handleAdvancedExport}
                    disabled={isExporting}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 'var(--space-md)' }}
                  >
                    {isExporting ? 'Exporting...' : `Export ${processed.length} Images`}
                  </button>
                </div>

                {/* Right: Preview */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                    <span className="text-mono text-muted" style={{ fontSize: '0.75rem' }}>BEFORE / AFTER COMPARISON</span>
                  </div>
                  <div
                    className="preview-container"
                    style={{
                      aspectRatio: ASPECT_RATIOS[ratio].width / ASPECT_RATIOS[ratio].height,
                      cursor: 'ew-resize',
                      userSelect: 'none'
                    }}
                    onMouseDown={handleSliderMouseDown}
                    onMouseMove={handleSliderMouseMove}
                    onMouseUp={handleSliderMouseUp}
                    onMouseLeave={handleSliderMouseUp}
                    onTouchMove={handleSliderTouchMove}
                  >
                    {previewLoading ? (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p className="text-muted">Generating preview...</p>
                      </div>
                    ) : (
                      <>
                        {compressedPreview && (
                          <img
                            src={compressedPreview.url}
                            alt="After"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                            draggable={false}
                          />
                        )}
                        {originalPreview && (
                          <div style={{ position: 'absolute', top: 0, left: 0, width: `${sliderPosition}%`, height: '100%', overflow: 'hidden' }}>
                            <img
                              src={originalPreview.url}
                              alt="Before"
                              style={{ position: 'absolute', top: 0, left: 0, width: `${100 / (sliderPosition / 100)}%`, height: '100%', objectFit: 'contain' }}
                              draggable={false}
                            />
                          </div>
                        )}
                        {/* Slider */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: `${sliderPosition}%`,
                          width: '2px',
                          height: '100%',
                          background: 'var(--deep-black)',
                          transform: 'translateX(-50%)',
                          zIndex: 10
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--deep-black)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--pure-white)',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>◀▶</div>
                        </div>
                        <span className="preview-label preview-label--before">BEFORE</span>
                        <span className="preview-label preview-label--after">AFTER</span>
                      </>
                    )}
                  </div>
                  {compressedPreview && !previewLoading && (
                    <p className="text-mono text-muted text-center mt-md" style={{ fontSize: '0.8rem' }}>
                      {compressedPreview.width} × {compressedPreview.height} • {processed.length} images
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main style={{ flex: 1 }}>
        {originals.length === 0 ? (
          <UploadZone onUpload={handleUpload} />
        ) : (
          <div>
            {/* Controls */}
            <div className="controls-bar">
              <div className="controls-group">
                <span className="controls-label">Ratio</span>
                {Object.keys(ASPECT_RATIOS).map(key => (
                  <button
                    key={key}
                    onClick={() => setRatio(key)}
                    className={`ratio-btn ${ratio === key ? 'active' : ''}`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="controls-group">
                <span className="controls-label">Fit</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="contain">Smart Blur</option>
                  <option value="cover">Smart Crop</option>
                  <option value="stretch">Stretch</option>
                </select>

                <span className="badge">{processed.length} images</span>

                <button onClick={handleDownloadAll} className="btn btn-secondary btn--sm">
                  ↓ Quick
                </button>

                <button onClick={() => setShowExportPanel(true)} className="btn btn-primary btn--sm">
                  Export 2K/4K
                </button>

                <button onClick={() => setOriginals([])} className="btn btn-ghost">
                  Clear
                </button>
              </div>
            </div>

            {/* Image Grid */}
            <div className="image-grid">
              {isProcessing ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-4xl)' }}>
                  <p className="text-muted">Processing...</p>
                </div>
              ) : processed.map((img, idx) => (
                <div
                  key={idx}
                  className="animate-fade-in"
                  style={{ animationDelay: `${idx * 0.05}s`, opacity: 0 }}
                >
                  <div
                    className="image-card"
                    style={{ aspectRatio: ASPECT_RATIOS[ratio].width / ASPECT_RATIOS[ratio].height }}
                  >
                    <img src={img.preview} alt={`Preview ${idx + 1}`} />
                    <a
                      href={img.preview}
                      download={`${String(idx + 1).padStart(2, '0')}_${img.name}`}
                      style={{
                        position: 'absolute',
                        bottom: 'var(--space-sm)',
                        right: 'var(--space-sm)',
                        background: 'var(--deep-black)',
                        color: 'var(--pure-white)',
                        padding: 'var(--space-xs) var(--space-sm)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        textDecoration: 'none',
                        opacity: 0.9
                      }}
                    >
                      ↓
                    </a>
                    <span style={{
                      position: 'absolute',
                      top: 'var(--space-sm)',
                      left: 'var(--space-sm)',
                      background: 'var(--deep-black)',
                      color: 'var(--pure-white)',
                      padding: 'var(--space-xs) var(--space-sm)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600
                    }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-mono text-muted mt-sm" style={{
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {img.name}
                  </p>
                </div>
              ))}

              {/* Add More */}
              {!isProcessing && (
                <div
                  className="upload-zone"
                  style={{
                    aspectRatio: ASPECT_RATIOS[ratio].width / ASPECT_RATIOS[ratio].height,
                    padding: 'var(--space-xl)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={() => document.getElementById('add-more-input').click()}
                >
                  <span className="text-mono text-muted">+ Add More</span>
                  <input
                    id="add-more-input"
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleUpload(Array.from(e.target.files))}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p className="footer__text">
          Carousel Engine • <a href="https://github.com" className="footer__link">Open Source</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
