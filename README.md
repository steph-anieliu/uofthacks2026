# Codeswitching Language Learning Webapp

A Next.js webapp that listens to mixed Chinese/English/French input, translates unknown words in real-time, plays audio pronunciation, and tracks learned vocabulary with flashcards and progress metrics.

## Features

- **Multi-language Support**: Supports Chinese (Mandarin), English, and French
- **Codeswitching Detection**: Automatically detects and translates mixed language text
- **Real-time Translation**: Fast translation with optional fast mode for live use cases
- **Audio Transcription**: Uses Google Gemini Pro for speech-to-text transcription
- **Audio Pronunciation**: Uses ElevenLabs API for text-to-speech audio generation
- **Word Learning**: Saves learned words with pinyin, translations, and explanations
- **Flashcards**: Review learned words with interactive flashcards
- **Progress Tracking**: Track words learned, practice streak, and total queries
- **Speech Input**: Voice input support via Web Speech API (Chrome/Edge)
- **Translation Caching**: In-memory caching for faster repeated translations

## Tech Stack

### Frontend
- **Framework**: Next.js 14.2.5 (App Router)
- **Language**: TypeScript 5.5.3
- **UI Library**: React 18.3.1
- **Styling**: 
  - Tailwind CSS 3.4.4
  - shadcn/ui components (built on Radix UI)
  - Lucide React (icons)
  - class-variance-authority, clsx, tailwind-merge (styling utilities)

### Backend & APIs
- **Database**: MongoDB 6.3.0 (MongoDB Atlas)
- **AI/ML APIs**:
  - **Google Gemini 2.5 Flash** (`@google/generative-ai` 0.21.0)
    - Audio transcription (speech-to-text)
    - Text translation and codeswitching detection
    - Pinyin generation
    - Language tagging
  - **ElevenLabs** (`elevenlabs` 1.0.0)
    - Text-to-speech audio synthesis

### Authentication
- **next-auth** 4.24.7

### Development Tools
- **TypeScript** 5.5.3
- **ESLint** with Next.js config
- **tsx** 4.7.0 (for running TypeScript test scripts)
- **tsconfig-paths** 4.2.0 (path alias resolution)

### Utilities
- **bcryptjs** 2.4.3 (password hashing)
- **Autoprefixer** & **PostCSS** (CSS processing)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
   GEMINI_API_KEY=your_gemini_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Translation Page

1. Select source and target languages (Chinese, English, or French)
2. Enter mixed language text (e.g., "ni hao my name is li hua" or "bonjour hello")
3. Click "Translate" or use the microphone button for voice input
4. View the translation with pinyin (for Chinese)
5. Click "Play Pronunciation" to hear the audio (text-to-speech)
6. Click "Save Words" to add new words to your vocabulary

**Fast Mode**: For live translation, you can enable fast mode by passing `fastMode: true` in the API request. This provides 50-70% faster responses with simplified output (see `LIVE_TRANSLATION_OPTIMIZATIONS.md` for details).

### Learning Dashboard

- **Flashcards**: Review words by flipping cards to see translations
- **All Words**: Browse all learned words with search functionality
- **Progress Stats**: View words learned, current streak, and total queries

## API Routes

- `POST /api/translate` - Translate mixed Chinese/English text
- `POST /api/synthesize` - Generate audio from Chinese text
- `GET /api/words` - Get all learned words
- `POST /api/words` - Save a new word
- `DELETE /api/words?id=...` - Delete a word
- `GET /api/queries` - Get past translation queries
- `POST /api/queries` - Save a translation query

## Browser Support

- Speech recognition requires Chrome or Edge browser
- Other features work in all modern browsers

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── learn/            # Learning dashboard
│   └── page.tsx          # Main translation page
├── components/
│   ├── ui/               # shadcn components
│   ├── AudioInput.tsx    # Voice input component
│   ├── TranslationDisplay.tsx
│   ├── WordCard.tsx
│   ├── Flashcard.tsx
│   └── ProgressStats.tsx
├── lib/
│   ├── db.ts             # MongoDB connection and utilities
│   ├── gemini.ts         # Gemini API client (transcription & translation)
│   ├── elevenlabs.ts     # ElevenLabs API client (text-to-speech)
│   ├── storage.ts        # Browser localStorage utilities
│   └── utils.ts          # Shared utilities
├── types/
│   └── index.ts          # TypeScript type definitions
└── test-translations.ts  # Translation testing script (npm run test:translations)
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test:translations` - Test all language translation combinations

## License

MIT
