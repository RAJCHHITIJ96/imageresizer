# ⚡ Carousel Engine

> Open source image resizing for creators. Perfect aspect ratios for Instagram & LinkedIn carousels.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

## Features

- **Fast Resize** — Batch process multiple images instantly
- **Smart Modes** — Smart blur, smart crop, or stretch to fit
- **Perfect Ratios** — 4:5, 1:1, 16:9, 9:16 for all platforms
- **Export Control** — HD, 2K, or 4K output with smart compression
- **Before/After Preview** — See quality comparison before export
- **Ordered Export** — Images exported in exact upload order (01, 02, 03...)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/carousel-engine.git

# Install dependencies
cd carousel-engine
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. **Upload** — Drag & drop images or click to browse
2. **Select Ratio** — Choose 4:5, 1:1, 16:9, or 9:16
3. **Choose Fit Mode** — Smart Blur, Smart Crop, or Stretch
4. **Export** — Quick download or use Export 2K/4K for high-res output

## Export Options

| Resolution | Dimensions | Use Case |
|------------|------------|----------|
| HD | 1080p | Standard quality, smaller files |
| 2K | 1440p | High quality, balanced size |
| 4K | 2160p | Ultra quality, maximum detail |

| Quality | Compression | File Size |
|---------|-------------|-----------|
| Maximum | 95% | Largest |
| High | 88% | Balanced |
| Balanced | 80% | Smaller |
| Optimized | 72% | Smallest |

## Tech Stack

- **React** — UI Framework
- **Vite** — Build Tool
- **JSZip** — ZIP generation
- **FileSaver** — Download handling

## Design System

The UI follows a premium minimalist design philosophy:

```css
/* Colors */
--canvas-white: #FAFAFA;
--deep-black: #0A0A0A;
--slate: #71717A;
--fog-gray: #E5E5E5;

/* Typography */
--font-mono: 'JetBrains Mono', monospace;
--font-sans: 'Inter', sans-serif;
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License — feel free to use this in your own projects.

---

Built with ❤️ for creators by [@unfilteredchhitij](https://instagram.com/unfilteredchhitij)
