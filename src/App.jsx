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
  const [focusedIndex, setFocusedIndex] = useState(null);

  // Export Settings
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportResolution, setExportResolution] = useState("HD");
  const [exportCompression, setExportCompression] = useState("high");
  const [enhanceEnabled, setEnhanceEnabled] = useState(true);
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

  // Preview Index (which image to preview in Export Studio)
  const [previewIndex, setPreviewIndex] = useState(0);
  // Pan & Crop State
  const [offsets, setOffsets] = useState({}); // Map index -> {x, y}
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Focus Mode State
  const [showOriginalInFocus, setShowOriginalInFocus] = useState(false);

  // Export Studio Advanced Features
  const [zoomLevel, setZoomLevel] = useState(100);         // 50-200%
  const [showOriginalAB, setShowOriginalAB] = useState(false); // A/B toggle
  const [showCropGuides, setShowCropGuides] = useState(false); // Rule of thirds
  const [filterPreset, setFilterPreset] = useState('none');    // none, vivid, muted, bw
  const [devicePreview, setDevicePreview] = useState('none');  // none, instagram
  const [histogramData, setHistogramData] = useState(null);    // brightness histogram

  // Lock body scroll when Export Studio is open
  useEffect(() => {
    if (showExportPanel) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showExportPanel]);

  // Keyboard shortcuts for Export Studio
  useEffect(() => {
    if (!showExportPanel) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          setShowExportPanel(false);
          break;
        case 'ArrowLeft':
          setPreviewIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          setPreviewIndex(prev => Math.min(processed.length - 1, prev + 1));
          break;
        case ' ':
          e.preventDefault();
          setShowOriginalAB(prev => !prev);
          break;
        case '+':
        case '=':
          setZoomLevel(prev => Math.min(200, prev + 25));
          break;
        case '-':
          setZoomLevel(prev => Math.max(50, prev - 25));
          break;
        case 'g':
        case 'G':
          setShowCropGuides(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExportPanel, processed.length]);

  // Re-process when options or originals change
  useEffect(() => {
    if (originals.length === 0) {
      setProcessed([]);
      return;
    }

    const runProcessing = async () => {
      setIsProcessing(true);
      const results = await Promise.all(
        originals.map((file, idx) => processImage(file, ratio, mode, 20, offsets[idx] || { x: 0, y: 0 }))
      );
      setProcessed(results);
      setIsProcessing(false);
    };

    runProcessing();
  }, [originals, ratio, mode, offsets]);

  // Generate LIVE preview when export settings change
  useEffect(() => {
    if (!showExportPanel || processed.length === 0) return;

    const generatePreviews = async () => {
      setPreviewLoading(true);
      try {
        // Use selected preview index
        const targetImage = processed[previewIndex] || processed[0];
        if (!targetImage) return;

        const originalResult = await exportWithSettings(targetImage, exportResolution, 'max', false);
        setOriginalPreview({
          url: URL.createObjectURL(originalResult.blob),
          sizeKB: originalResult.sizeKB,
          sizeMB: originalResult.sizeMB,
          width: originalResult.width,
          height: originalResult.height
        });
        setOriginalSize(originalResult.sizeKB * processed.length);

        const compressedResult = await exportWithSettings(targetImage, exportResolution, exportCompression, enhanceEnabled);
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
  }, [showExportPanel, exportResolution, exportCompression, processed, enhanceEnabled, previewIndex]);

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
      const exportedImages = await batchExport(processed, exportResolution, exportCompression, enhanceEnabled);
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

  // Generate filename preview
  const getPreviewFilename = () => {
    if (!processed[previewIndex]) return '';
    const paddedIndex = String(previewIndex + 1).padStart(2, '0');
    const originalName = processed[previewIndex].name.split('.')[0];
    return `${paddedIndex}_${originalName}_${ratio.replace(':', '-')}_${exportResolution}.jpg`;
  };

  // Single image export
  const handleSingleExport = async () => {
    if (!processed[previewIndex]) return;
    setIsExporting(true);
    try {
      const result = await exportWithSettings(processed[previewIndex], exportResolution, exportCompression, enhanceEnabled);
      saveAs(result.blob, getPreviewFilename());
    } catch (error) {
      console.error('Single export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Get filter style for preview
  const getFilterStyle = () => {
    switch (filterPreset) {
      case 'vivid': return 'saturate(1.3) contrast(1.1)';
      case 'muted': return 'saturate(0.7) brightness(1.05)';
      case 'bw': return 'grayscale(1) contrast(1.1)';
      default: return 'none';
    }
  };

  // Generate histogram from preview image
  useEffect(() => {
    if (!compressedPreview?.url) {
      setHistogramData(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 100; // Sample size
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      const bins = new Array(32).fill(0); // 32 bins for histogram

      for (let i = 0; i < data.length; i += 4) {
        const brightness = Math.floor((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 8);
        bins[Math.min(31, brightness)]++;
      }

      const maxBin = Math.max(...bins);
      const normalized = bins.map(b => (b / maxBin) * 100);
      setHistogramData(normalized);
    };
    img.src = compressedPreview.url;
  }, [compressedPreview?.url]);

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

      {/* EXPORT STUDIO OVERLAY */}
      {showExportPanel && (
        <div className="export-studio animate-fade-in">
          {/* SIDEBAR CONTROLS */}
          <div className="studio-sidebar">
            <div className="studio-header">
              <span className="studio-title">Export Studio</span>
              <button className="studio-close" onClick={() => setShowExportPanel(false)}>×</button>
            </div>

            {/* Resolution Control */}
            <div className="control-group">
              <span className="control-label">Output Resolution</span>
              <div className="segment-control">
                {Object.keys(EXPORT_RESOLUTIONS).map(key => (
                  <button
                    key={key}
                    onClick={() => setExportResolution(key)}
                    className={`segment-btn ${exportResolution === key ? 'active' : ''}`}
                  >
                    {key}
                  </button>
                ))}
              </div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                {EXPORT_RESOLUTIONS[exportResolution].description}
              </p>
            </div>

            {/* Quality Control */}
            <div className="control-group">
              <span className="control-label">Compression Mode</span>
              <div className="segment-control">
                {Object.keys(COMPRESSION_PRESETS).map(key => (
                  <button
                    key={key}
                    onClick={() => setExportCompression(key)}
                    className={`segment-btn ${exportCompression === key ? 'active' : ''}`}
                  >
                    {COMPRESSION_PRESETS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Enhancement Control */}
            <div className="control-group">
              <span className="control-label">Processing</span>
              <div className="segment-control">
                <button
                  onClick={() => setEnhanceEnabled(false)}
                  className={`segment-btn ${!enhanceEnabled ? 'active' : ''}`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setEnhanceEnabled(true)}
                  className={`segment-btn ${enhanceEnabled ? 'active' : ''}`}
                >
                  Enhance
                </button>
              </div>
            </div>

            {/* Zoom Control */}
            <div className="control-group">
              <span className="control-label">Zoom {zoomLevel}%</span>
              <input
                type="range"
                min="50"
                max="200"
                step="25"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="studio-slider"
              />
            </div>

            {/* Filter Presets */}
            <div className="control-group">
              <span className="control-label">Preview Filter</span>
              <div className="segment-control">
                {[['none', '○'], ['vivid', '◐'], ['muted', '◑'], ['bw', '●']].map(([key, icon]) => (
                  <button
                    key={key}
                    onClick={() => setFilterPreset(key)}
                    className={`segment-btn ${filterPreset === key ? 'active' : ''}`}
                    title={key.charAt(0).toUpperCase() + key.slice(1)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* View Options */}
            <div className="control-group">
              <span className="control-label">View Options</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowCropGuides(!showCropGuides)}
                  className={`studio-toggle-btn ${showCropGuides ? 'active' : ''}`}
                  title="Rule of Thirds Grid (G)"
                >
                  ▦
                </button>
                <button
                  onClick={() => setShowOriginalAB(!showOriginalAB)}
                  className={`studio-toggle-btn ${showOriginalAB ? 'active' : ''}`}
                  title="A/B Comparison (Space)"
                >
                  {showOriginalAB ? '◀' : '▶'}
                </button>
                <button
                  onClick={() => setDevicePreview(devicePreview === 'none' ? 'instagram' : 'none')}
                  className={`studio-toggle-btn ${devicePreview !== 'none' ? 'active' : ''}`}
                  title="Instagram Frame Preview"
                >
                  📱
                </button>
              </div>
            </div>

            {/* Stats & Actions */}
            <div className="studio-footer">
              <div className="studio-stat-row" style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#444' }}>Filename</span>
                <span className="studio-stat-val" style={{ fontSize: '0.65rem', color: '#888', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getPreviewFilename() || '...'}
                </span>
              </div>
              <div className="studio-stat-row">
                <span>Size</span>
                <span className="studio-stat-val">
                  {previewLoading ? '...' : formatSize(estimatedTotalSize)}
                </span>
              </div>
              <div className="studio-stat-row">
                <span>Resolution</span>
                <span className="studio-stat-val">
                  {compressedPreview?.width}×{compressedPreview?.height}
                </span>
              </div>
              <div className="studio-stat-row">
                <span>Savings</span>
                <span className="studio-stat-val" style={{ color: calculateSavings() > 20 ? '#4ade80' : '#fff' }}>
                  {calculateSavings()}%
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  onClick={handleSingleExport}
                  disabled={isExporting || previewLoading}
                  className="btn-export-single"
                  title="Export only the currently previewed image"
                >
                  💾 This
                </button>
                <button
                  onClick={handleAdvancedExport}
                  disabled={isExporting || previewLoading}
                  className="btn-export-studio"
                  style={{ flex: 1 }}
                >
                  {isExporting ? 'Exporting...' : `Export ${processed.length}`}
                </button>
              </div>

              <p style={{ marginTop: '1rem', fontSize: '0.6rem', color: '#444', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                ESC close • ←→ nav • SPACE toggle • G grid
              </p>
            </div>
          </div>

          {/* MAIN PREVIEW CANVAS */}
          <div className="studio-canvas">
            <div className="canvas-grid"></div>

            {/* Main Preview Area */}
            <div className="studio-main-preview">
              <div
                className="studio-preview-wrapper"
                style={{
                  height: '100%',
                  maxHeight: 'calc(100vh - 200px)',
                  aspectRatio: ASPECT_RATIOS[ratio].width / ASPECT_RATIOS[ratio].height,
                  cursor: showOriginalAB ? 'default' : 'ew-resize',
                  userSelect: 'none',
                  position: 'relative',
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out'
                }}
                onMouseDown={!showOriginalAB ? handleSliderMouseDown : undefined}
                onMouseMove={!showOriginalAB ? handleSliderMouseMove : undefined}
                onMouseUp={!showOriginalAB ? handleSliderMouseUp : undefined}
                onMouseLeave={!showOriginalAB ? handleSliderMouseUp : undefined}
                onTouchMove={!showOriginalAB ? handleSliderTouchMove : undefined}
              >
                {previewLoading ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', background: '#111', borderRadius: '8px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚡</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>Rendering Preview...</div>
                    </div>
                  </div>
                ) : showOriginalAB ? (
                  /* A/B Toggle Mode - Show Original Only */
                  originalPreview && (
                    <img
                      src={originalPreview.url}
                      alt="Original"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        filter: getFilterStyle()
                      }}
                      draggable={false}
                    />
                  )
                ) : (
                  <>
                    {/* After Image (Background - Enhanced/Compressed) */}
                    {compressedPreview && (
                      <img
                        src={compressedPreview.url}
                        alt="After"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          filter: getFilterStyle()
                        }}
                        draggable={false}
                      />
                    )}

                    {/* Before Image (Cropped by Slider - Original) */}
                    {originalPreview && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: `${sliderPosition}%`,
                        height: '100%',
                        overflow: 'hidden',
                        borderRight: '2px solid rgba(255,255,255,0.8)'
                      }}>
                        <img
                          src={originalPreview.url}
                          alt="Before"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: `${100 / (sliderPosition / 100)}%`,
                            height: '100%',
                            objectFit: 'contain',
                            maxWidth: 'none'
                          }}
                          draggable={false}
                        />
                      </div>
                    )}

                    {/* Slider Handle */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${sliderPosition}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                      color: '#000',
                      fontSize: '10px',
                      zIndex: 10,
                      cursor: 'ew-resize'
                    }}>
                      ◀▶
                    </div>
                  </>
                )}

                {/* Crop Guides - Rule of Thirds */}
                {showCropGuides && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
                    {/* Vertical Lines */}
                    <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }} />
                    <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }} />
                    {/* Horizontal Lines */}
                    <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.3)' }} />
                    <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.3)' }} />
                  </div>
                )}

                {/* Labels */}
                <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: 4, fontSize: '0.65rem', color: showOriginalAB ? '#f59e0b' : '#999', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 25 }}>
                  {showOriginalAB ? '◀ Original' : 'Original'}
                </div>
                {!showOriginalAB && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: 4, fontSize: '0.65rem', color: enhanceEnabled ? '#4ade80' : '#999', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 25 }}>
                    {enhanceEnabled ? '✨ Enhanced' : 'Compressed'}
                  </div>
                )}

                {/* Filter Badge */}
                {filterPreset !== 'none' && (
                  <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: 4, fontSize: '0.6rem', color: '#f59e0b', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', zIndex: 25 }}>
                    Preview: {filterPreset}
                  </div>
                )}

                {/* Zoom Badge */}
                {zoomLevel !== 100 && (
                  <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: 4, fontSize: '0.6rem', color: '#60a5fa', fontFamily: 'var(--font-mono)', zIndex: 25 }}>
                    {zoomLevel}%
                  </div>
                )}

                {/* Histogram */}
                {histogramData && (
                  <div style={{
                    position: 'absolute',
                    top: 40,
                    right: 12,
                    width: '80px',
                    height: '40px',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: 4,
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '1px',
                    zIndex: 25
                  }}>
                    {histogramData.map((value, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${value}%`,
                          background: i < 10 ? '#3b82f6' : i < 22 ? '#22c55e' : '#ef4444',
                          minHeight: '1px',
                          borderRadius: '1px 1px 0 0'
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Device Preview - Instagram Frame */}
                {devicePreview === 'instagram' && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {/* Phone Frame */}
                    <div style={{
                      position: 'absolute',
                      inset: '-15%',
                      border: '3px solid rgba(255,255,255,0.15)',
                      borderRadius: '24px',
                      background: 'transparent'
                    }}>
                      {/* Status Bar */}
                      <div style={{
                        position: 'absolute',
                        top: -30,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.6rem',
                        color: '#888',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        <span>●●●</span>
                        <span>Instagram</span>
                        <span>●●●</span>
                      </div>
                      {/* Bottom Bar */}
                      <div style={{
                        position: 'absolute',
                        bottom: -25,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '16px',
                        fontSize: '0.7rem',
                        color: '#666'
                      }}>
                        <span>♡</span>
                        <span>💬</span>
                        <span>↗</span>
                        <span style={{ marginLeft: 'auto' }}>⊡</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Strip */}
            <div className="thumbnail-strip">
              {processed.map((img, idx) => (
                <div
                  key={idx}
                  className={`thumbnail-item ${previewIndex === idx ? 'active' : ''}`}
                  onClick={() => setPreviewIndex(idx)}
                  style={{ position: 'relative' }}
                >
                  <img src={img.preview} alt={`Preview ${idx + 1}`} />
                  <span className="thumbnail-index">{String(idx + 1).padStart(2, '0')}</span>
                </div>
              ))}
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
                  draggable
                  onDragStart={(e) => {
                    setDraggedIndex(idx);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex === null || draggedIndex === idx) return;

                    // Reorder files AND offsets
                    const items = originals.map((file, i) => ({ file, offset: offsets[i] }));
                    const [moved] = items.splice(draggedIndex, 1);
                    items.splice(idx, 0, moved);

                    setOriginals(items.map(x => x.file));
                    const nextOffsets = {};
                    items.forEach((x, i) => { if (x.offset) nextOffsets[i] = x.offset; });
                    setOffsets(nextOffsets);
                    setDraggedIndex(null);
                  }}
                  className="animate-fade-in group"
                  style={{ animationDelay: `${idx * 0.05}s`, opacity: 0, position: 'relative', cursor: 'grab' }}
                >
                  <div
                    className="image-card"
                    style={{ aspectRatio: ASPECT_RATIOS[ratio].width / ASPECT_RATIOS[ratio].height, overflow: 'hidden' }}
                  >
                    <img src={img.preview} alt={`Preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

                    {/* Hover Controls Overlay */}
                    <div className="image-card__overlay" style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.4)',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                    >
                      <button
                        onClick={() => setFocusedIndex(idx)}
                        className="btn-icon"
                        title="Focus / Edit"
                        style={{ background: 'white', color: 'black', borderRadius: '50%', width: 40, height: 40, border: 'none', cursor: 'pointer' }}
                      >
                        ⤢
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newOriginals = originals.filter((_, i) => i !== idx);
                          setOriginals(newOriginals);
                          // Also remove offset
                          const newOffsets = { ...offsets };
                          delete newOffsets[idx];
                          setOffsets(newOffsets);
                        }}
                        className="btn-icon"
                        title="Remove"
                        style={{ background: '#ff4d4d', color: 'white', borderRadius: '50%', width: 40, height: 40, border: 'none', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </div>

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
                      fontWeight: 600,
                      zIndex: 2
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
                    onChange={(e) => {
                      const sortedFiles = Array.from(e.target.files).sort((a, b) =>
                        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                      );
                      handleUpload(sortedFiles);
                    }}
                  />
                </div>
              )}
            </div>

            {/* FOCUS MODAL (Single Image Edit) */}
            {focusedIndex !== null && processed[focusedIndex] && (
              <div className="modal-overlay animate-fade-in" style={{ zIndex: 100 }}>
                <div className="modal" style={{ width: '90vw', height: '90vh', maxWidth: 'none', display: 'flex', flexDirection: 'column' }}>
                  <div className="modal__header">
                    <h2 className="modal__title">Edit: {processed[focusedIndex].name}</h2>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        className={`btn btn--sm ${showOriginalInFocus ? 'btn-primary' : 'btn-secondary'}`}
                        onMouseDown={() => setShowOriginalInFocus(true)}
                        onMouseUp={() => setShowOriginalInFocus(false)}
                        onMouseLeave={() => setShowOriginalInFocus(false)}
                      >
                        {showOriginalInFocus ? 'Showing Original' : 'Hold for Original'}
                      </button>
                      <div style={{ width: 1, height: 20, background: '#333', margin: '0 10px' }}></div>
                      <button className="btn btn-ghost" onClick={() => setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev))}>← Prev</button>
                      <button className="btn btn-ghost" onClick={() => setFocusedIndex((prev) => (prev < processed.length - 1 ? prev + 1 : prev))}>Next →</button>
                      <button className="modal__close" onClick={() => setFocusedIndex(null)}>×</button>
                    </div>
                  </div>
                  <div
                    className="modal__content"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', borderRadius: '8px', overflow: 'hidden', position: 'relative', cursor: showOriginalInFocus ? 'default' : 'move' }}
                    onMouseDown={(e) => {
                      if (showOriginalInFocus) return;
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const currentOffset = offsets[focusedIndex] || { x: 0, y: 0 };
                      const imgElement = e.currentTarget.querySelector('img');
                      const rect = imgElement.getBoundingClientRect();

                      const onMove = (moveEvent) => {
                        const dx = moveEvent.clientX - startX;
                        const dy = moveEvent.clientY - startY;
                        // Visual feedback
                        imgElement.style.transform = `translate(${dx}px, ${dy}px)`;
                      };

                      const onUp = (upEvent) => {
                        const dx = upEvent.clientX - startX;
                        const dy = upEvent.clientY - startY;
                        // Calculate percentage offset
                        // Since render uses percentage of canvas size...
                        // We need to divide delta by displayed image dimensions?
                        // Actually, imageOps uses `offset.x * width`, so we normalize by rect width.
                        const newOffset = {
                          x: currentOffset.x - (dx / rect.width), // Inverted logic because standard drag moves content
                          y: currentOffset.y - (dy / rect.height)
                        };

                        setOffsets({ ...offsets, [focusedIndex]: newOffset });
                        imgElement.style.transform = 'none';

                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                      };

                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                    }}
                  >
                    {showOriginalInFocus ? (
                      // Need original blob. Since we don't have it generated, we use the File object
                      <img
                        src={URL.createObjectURL(processed[focusedIndex].originalFile)} // Quick generation
                        alt="Original"
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <img
                        src={processed[focusedIndex].preview}
                        alt="Focused"
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                      />
                    )}

                    {!showOriginalInFocus && (
                      <div style={{
                        position: 'absolute',
                        bottom: 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.8)',
                        padding: '10px 20px',
                        borderRadius: '20px',
                        color: 'white',
                        fontSize: '0.8rem',
                        pointerEvents: 'none'
                      }}>
                        Drag to adjust crop • Hold button to compare
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
