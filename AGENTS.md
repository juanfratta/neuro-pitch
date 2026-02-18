# AGENTS.md - AI Agent Guide

This document provides complete and detailed technical context for AI agents to understand, modify, and improve the Absolute Pitch Trainer project.

## 📋 Executive Summary

**Name**: Absolute Pitch Trainer  
**Purpose**: Scientific application to train absolute pitch recognition  
**Based on**: Wong 2025 Protocol  
**Duration**: 8 weeks of progressive training  
**Users**: Musicians and audio enthusiasts

## 🏗️ General Architecture

### Application Layers

```
┌─────────────────────────────────────────┐
│         UI Components (React)            │
│  ProtocolGate → State Machine Switch     │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│   State Management (Context API)         │
│  protocol-context.tsx + machine.ts       │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│   Business Logic                         │
│  - Randomization Engine                  │
│  - Protocol Configuration                │
│  - Session Management                    │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│   Audio Engine (Soundfont)               │
│  soundfont-player + Web Audio Context    │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│   Persistence (localStorage)             │
│  - User profile                          │
│  - Sessions + Trials                     │
│  - Proficiency maps                      │
└─────────────────────────────────────────┘
```

## 🗂️ Directory Structure

### `src/components/`

| File | Responsibility | Key Props/State |
|---------|---|---|
| **ProtocolGate.tsx** | Main orchestrator - state machine switch | `protocolState` |
| **TrainingSession.tsx** | Trial loop, selection UI, feedback | `currentSession`, `trialState` |
| **SessionSummary.tsx** | Post-session summary with % accuracy | `accuracy`, `trialsCompleted` |
| **ProgressDashboard.tsx** | User view: level, progress, stats | `user`, `consecutiveSuccessfulSessions` |
| **ResearchDashboard.tsx** | Researcher view: analysis + export | `user`, `exportData()` |
| **RetentionTest.tsx** | Tests weeks 2, 4, final | `week`, `onComplete()` |
| **App.tsx** | Root + global layout | - |

### `src/state/`

- **protocol-context.tsx**: Global context with:
  - User state (profile, sessions, proficiency)
  - Session management (start, submit response, complete)
  - Calculated fields (`consecutiveSuccessfulSessions`)
  - Export functions

- **machine.ts**: Deterministic state machine
  - States: `idle`, `training_session_active`, `session_review`, `week2_retention_test`, `week4_retention_test`, `final_test`, `completed`, `failed`
  - Transitions based on `(current state, event)`

### `src/audio/`

- **engine.ts**: AudioEngine class
  - Lazy initialization of AudioContext
  - Loading instruments from soundfont
  - `playNote(note, octave, timbre, duration)`
  - Singleton global instance

### `src/utils/`

- **randomization.ts**: RandomizationEngine
  - Seeded generator for reproducibility
  - Anti-relative-pitch: no last 2 notes repetition
  - Out-of-set trials (10% of trials)
  - Note selection for current level

- **seeded-random.ts**: SeededRandom
  - Deterministic RNG based on seed
  - Methods: `random()`, `choice(array)`, `range(min, max)`

- **storage.ts**: Persistence helpers
  - `createTrial()`, `createSession()`, `createUser()`
  - localStorage wrappers

### `src/protocol/`

- **config.ts**: Configuración immutable del protocolo
  - 10 niveles con sets de notas
  - Thresholds de RT por nivel
  - Parámetros de audio (duración: 2500ms, volumen: 1.0)
  - Validación de integridad

### `src/types/`

- **index.ts**: Tipos TypeScript centralizados
  - `User`, `Session`, `Trial`, `RetentionTest`
  - `ChromaticNote`, `Octave`, `Timbre`
  - `ProtocolState`, `TrialFeedback`

### `src/styles/`

- CSS files por componente (CSS Modules implícito)
- Diseño limpio y minimalista
- Responsive (mobile + desktop)

## 🔄 Data Flow

### Session Flow

```
1. User starts session
   → ProtocolGate: idle → training_session_active
   → TrainingSession mounts
   → RandomizationEngine initializes

2. For each trial (30 total):
   a. playNextTrial():
      - generateTrial() → trialParams
      - createTrial() → Trial object
      - addTrialToSession(trial)
      - audioEngine.playNote(...)
      - setTrialState('waiting_response')
   
   b. User clicks note
      → handleNoteClick(note)
      → handleSubmitResponse(note)
      → submitSessionResponse(...) [Context]
      → trial.user_response + feedback set
      → Show feedback 800ms
      → setTrialState('playing') OR 'completed'
   
   c. If trial 30: setTrialState('completed')

3. SessionSummary (2-4 seconds):
   - Calculate accuracy=(correct/30)*100
   - Show motivational feedback
   - Auto-call: completeCurrentSession()

4. completeCurrentSession():
   - Create Session object
   - Calculate session.accuracy + session.rt_avg
   - addSessionToUser()
   - Transition: training_session_active → idle
   - ProtocolGate re-renders → ProgressDashboard
```

### Level Advancement Flow

```
State Logic (in protocol-context.tsx):

checkAdvancementCriteria():
  - Get last session
  - Get sessions at current level with accuracy >= 90%
  - Count consecutiveSuccessfulSessions (descending run)
  - Compare: consecutiveSuccessfulSessions >= 3 ✓
  - Compare: lastSessionAccuracy >= 90 ✓
  - Compare: lastSessionRT <= rtThreshold ✓
  
If all met:
  → Trigger state machine: 'advance_level'
  → incrementLevel()
  → Reset sessions counter
  → current_level += 1
```

## 🎵 Training Protocol Details

### Levels and Note Sets

```typescript
// src/protocol/config.ts
levelNoteSet = [
  [D#, F#],                           // Nivel 1 - 2 notas
  [D#, F#, B],                        // Nivel 2 - 3 notas
  [D#, F#, B, G],                     // Nivel 3 - 4 notas
  [D#, F#, B, G, C#],                 // Nivel 4 - 5 notas
  [D#, F#, B, G, C#, A],              // Nivel 5 - 6 notas
  [D#, F#, B, G, C#, A, E],           // Nivel 6 - 7 notas
  [D#, F#, B, G, C#, A, E, C],        // Nivel 7 - 8 notas
  [D#, F#, B, G, C#, A, E, C, F],     // Nivel 8 - 9 notas
  [D#, F#, B, G, C#, A, E, C, F, A#], // Nivel 9 - 10 notas
  CHROMATIC_NOTES (12),               // Nivel 10 - 11 notas
]

// RT Thresholds per level (in ms)
rtThresholds = [500, 500, 500, 500, 500, 450, 450, 400, 400, 350]

// Advancement Requirements
sessionsRequiredForAdvance = 3 (consecutive with accuracy >= 90%)
```

### Anti-Relative-Pitch Rules

Trials are generated to prevent users from learning relative intervals:

```typescript
filterAvailableNotes(availableNotes):
  // Last 2 notes cannot:
  // - Be the same note
  // - Be sequential notes in chromatic scale
  
  if (lastNote exists):
    filterOut(lastNote) // No repeat
    filterOut(lastNote - 1) // No descending sequence
    filterOut(lastNote + 1) // No ascending sequence
```

## 🎚️ States & Transitions

### State Machine (src/state/machine.ts)

```typescript
type ProtocolState = 
  'idle' | 
  'training_session_active' | 
  'session_review' |
  'week2_retention_test' |
  'week4_retention_test' |
  'final_test' |
  'completed' |
  'failed'

type Transition = 
  'start_session' |
  'complete_session' |
  'advance_level' |
  'start_retention_test' |
  'complete_test' |
  'complete_protocol' |
  'fail_protocol'

getNextState(state, transition) {
  switch(state) {
    case 'idle':
      if (transition === 'start_session') return 'training_session_active'
      if (transition === 'start_retention_test') return 'week2_retention_test' // etc
      break
    case 'training_session_active':
      if (transition === 'complete_session') return 'idle'
      break
    // ...
  }
}
```

## 🔊 Audio Engine

### Soundfont Setup

```typescript
// Piano: Acoustic Grand (training)
await Soundfont.instrument(audioContext, 'acoustic_grand_piano', {
  soundfont: 'MusyngKite' // CDN
})

// Piano only during training (no synth)
// Tests: piano + sine (generated via synth if needed)
```

### MIDI Note Calculation

```typescript
// Formula: (octave + 1) * 12 + noteOffset
// C4 (Middle C) = (4 + 1) * 12 + 0 = 60
// D#3 = (3 + 1) * 12 + 3 = 51

// Rango: octavas 3, 4, 5, 6 → MIDI 36-84
```

### Parámetros de Audio

- **Duración**: 2500ms (2.5 segundos)
- **Volumen (gain)**: 1.0 (full volume)
- **Rampa**: Fade-in/out manejada por soundfont

## 💾 Data Persistence (localStorage)

### User Object Structure

```typescript
interface User {
  id: string // UUID
  created_at: string // ISO timestamp
  protocol_version: string // 'wong-2025-v1'
  mode: 'user' | 'research'
  
  current_level: number // 1-10
  
  sessions: Session[] // Complete history
  retention_tests: RetentionTest[]
  proficiency_map: Map<ChromaticNote, Proficiency>
  training_history: {
    total_trials: number
    session_count: number
  }
}
```

### Data Retrieval

```typescript
// In ProtocolContext:
const [user, setUser] = useState<User | null>(() => {
  const stored = localStorage.getItem('pitcher_user')
  return stored ? JSON.parse(stored) : null
})

// Auto-save after each session
useEffect(() => {
  localStorage.setItem('pitcher_user', JSON.stringify(user))
}, [user])
```

## 🔄 Lifecycle of Key Components

### TrainingSession

```typescript
useEffect(() => {
  // 1. Initialize randomizer on mount
  randomizerRef.current = createTrainingRandomizer(...)
}, [user?.id, currentSession?.id])

useEffect(() => {
  // 2. If completed → show SessionSummary + auto-finalize
  if (trialState.status !== 'completed') return
  // ... calculate accuracy
  setShowSummary(true)
}, [trialState.status])

useEffect(() => {
  // 3. Auto-finalize after 4 seconds
  if (!showSummary) return
  setTimeout(() => completeCurrentSession(), 4000)
}, [showSummary])

useEffect(() => {
  // 4. Guard with isPlayingRef prevents duplicate trials
  if (isPlayingRef.current) return
  isPlayingRef.current = true
  playNextTrial()
  isPlayingRef.current = false
}, [trialState.status])
```

## 🎯 How to Modify the Project

### To Change Note Duration

**File**: `src/protocol/config.ts`

```typescript
// Line ~91
audio: {
  noteDuration: 2500, // Change here (ms)
}
```

### To Add/Modify Levels

**File**: `src/protocol/config.ts`

```typescript
// Line ~45-60
levelNoteSet: [
  [D#, F#],           // Level 1
  [D#, F#, B],        // Level 2
  // Add more here
]

// Also update rtThresholds if needed
rtThresholds: [500, 500, ...] // One per level
```

### To Change Timbres

**File**: `src/audio/engine.ts`

```typescript
// Piano: line ~115
const pianoInstrument = await Soundfont.instrument(audioContext, 'acoustic_grand_piano')

// To use other timbre, change name e.g.: 'violin', 'cello', 'clarinet'
```

**File**: `src/utils/randomization.ts`

```typescript
// Training: piano only
const selectedTimbre = this.isTestMode ? ... : 'piano'

// To randomize:
this.trainingTimbres = ['piano', 'violin'] // and use choice()
```

### To Add Validation

**File**: `src/protocol/config.ts`

```typescript
export function validateProtocolIntegrity(): void {
  // Add validations here
  if (!PROTOCOL_CONFIG.levelNoteSet?.length) {
    throw new Error('Protocol violation: no levels defined')
  }
}
```

## 🧪 Local Testing

### User Simulation

```typescript
// In browser console:
localStorage.clear()
location.reload()
// New user created automatically
```

### Force State

```typescript
// In browser console:
const user = JSON.parse(localStorage.getItem('pitcher_user'))
user.current_level = 5
localStorage.setItem('pitcher_user', JSON.stringify(user))
location.reload()
```

### Export Data

```typescript
// Use ResearchDashboard → Export JSON
// Or in console:
copy(JSON.stringify(JSON.parse(localStorage.getItem('pitcher_user')), null, 2))
```

## ⚠️ Important Architectural Decisions

1. **No Backend**: Offline-first design. All data in localStorage.
2. **Context API over Redux**: Simplicity, no external store.
3. **Soundfont over Web Audio Oscillators**: Professional audio quality.
4. **Seeded RNG**: Trial reproducibility for debugging.
5. **Machine States as Source of Truth**: Single global state dictates UI.
6. **No Gamification**: Focus on pure science, no distractions.

## 📞 Future Extension Points

- [ ] Backend? (save progress across devices)
- [ ] Mobile app? (React Native)
- [ ] Multiple languages? (i18n)
- [ ] Advanced graphics? (Chart.js, Recharts)
- [ ] Unit tests? (Jest + React Testing Library)
- [ ] PWA? (Service Worker for offline)
- [ ] Metrics? (Analytics without invasive tracking)

---

**Last Updated**: Feb 17, 2026  
**Protocol Version**: wong-2025-v1
