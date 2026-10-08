# TeamTrack — Mentor & Team Tracking System

A clean, modern, real-data-driven mentor supervision and team tracking application.

## Key Highlights

- **Strict Access Control & Backend Authorization**:
  - **Mentor Role**: Supervises teams, configures team containers, registers members, and reviews member profiles and work updates in read-only mode.
  - **Member Role**: Manages their own profile (role, skills, responsibilities, bio, avatar) and submits chronological work updates. Members cannot access other members or teams.
- **Zero Invented Data**: No mock, fake, seed, or hardcoded business data. All data is dynamically entered by mentors and team members.
- **Dynamic Team Containers**: Starts with 2 empty team containers (`Team 1` and `Team 2`) upon mentor registration, with full support to rename or add more teams.
- **Chronological Work Updates**: Detailed logging of technical achievements, challenges, next steps, and evidence links.
- **Curated UI Aesthetics**: Dark Navy sidebar, white cards, subtle borders, primary blue buttons, soft green accents, and comprehensive empty states.

## Tech Stack

- **Frontend**: React 19, TypeScript, Lucide React Icons
- **Styling**: Vanilla CSS (Custom design tokens & responsive layout)
- **Backend / API**: Vite dev middleware with Node.js crypto, scrypt hashing, and bearer token authorization
- **Bundler**: Vite

## Getting Started

### 1. Installation
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```
