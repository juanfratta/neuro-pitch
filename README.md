# Absolute Pitch Trainer

> A scientific application to train absolute pitch recognition based on the Wong 2025 protocol

🎵 **Train your ability to recognize musical notes** without external reference. A research-based tool for musicians and audio enthusiasts wanting to develop absolute pitch.

## 🎯 Features

- **8 weeks of progressive training** - Start with 2 notes (D# and F#), gradually adding up to 11 notes
- **30 attempts per session** - Short, focused sessions (~15 minutes)
- **Automatic advancement** - Requires 3 consecutive sessions with ≥90% accuracy + response time threshold
- **High-quality audio** - Acoustic piano via Soundfont (MusyngKite)
- **Optimized duration** - 2.5-second notes for clarity and retention
- **Retention tests** - Assessments at weeks 2, 4, and final for progress tracking
- **Two modes**: User (simple dashboard) and Researcher (analysis + export)

## 🏗️ Requirements

- Node.js 18+
- npm or yarn

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/usuario/neuro-pitch-app.git
cd neuro-pitch-app
npm install

# Development
npm run dev
# Open http://localhost:5174

# Build
npm run build
npm run preview
```

## 📁 Project Structure

```
src/
├── components/           # React components
├── state/               # Context API + State Machine
├── audio/               # Audio engine (Soundfont)
├── utils/               # Randomization, storage
├── protocol/            # Protocol configuration
├── types/               # TypeScript types
└── styles/              # CSS styles
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript |
| **Build** | Vite 7 + SWC |
| **Audio** | soundfont-player (MIDI) |
| **State** | Context API |
| **Data** | localStorage |
| **Linting** | ESLint 9 |

## 🎓 The Protocol

**Based on Wong 2025**

- **Levels**: 10 progressive (2 → 11 notes)
- **Structure**: 30 trials/session, 8 weeks
- **Advancement**: 3 consecutive sessions ≥90% accuracy
- **Audio**: Piano 2.5 seconds, octaves 3-6
- **Anti-relative-pitch**: Prevents learning relative intervals

## 📊 Session Flow

1. A note is played (piano, 2.5 sec)
2. User selects the note from 12 buttons
3. Immediate feedback (Correct/Incorrect/Slow)
4. Next trial (×30)
5. SessionSummary shows accuracy %
6. Auto-returns to dashboard

## 🚢 Deployment

### Netlify (recommended)
```bash
npm run build
# Drag & drop dist/ folder to https://app.netlify.com
```

### Vercel
```bash
npm i -g vercel && vercel
```

## 🔬 Research Mode

Access via checkbox on initial screen

**Features:**
- RT heatmap by note
- Error distribution
- Learning curve
- Proficiency by note
- JSON/CSV export
- Debug information

## 💾 Data Persistence

- **Data**: localStorage (all trials, sessions, profile)
- **Offline**: Fully functional without internet
- **Export**: Button to download JSON with complete history

## 🤝 Contributing

PRs welcome. For major changes:
1. Open an Issue
2. Fork → feature branch
3. Clear commits
4. Push and PR

## 📖 For Developers

Complete technical documentation in [AGENTS.md](./AGENTS.md):
- Detailed architecture
- How to modify the protocol
- Design decisions
- Extension guide
- Component state
- How to add features

## 📝 License

MIT - Free for academic and commercial use

---

**Protocol Version**: wong-2025-v1  
**Last Updated**: Feb 2026
