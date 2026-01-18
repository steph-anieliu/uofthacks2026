# Codeswitching Language Learning Webapp

A Next.js webapp that listens to mixed Chinese/English/French input, translates between languages in real-time, plays audio pronunciation, and tracks learned vocabulary with flashcards and progress metrics.

## Features

- **Multi-language Support**: Supports Chinese (Mandarin), English, and French
- **Codeswitching Detection**: Automatically detects and translates mixed language text
- **Real-time Translation**: Translates between any supported language pair with context awareness
- **Audio Transcription**: Uses Gemini 2.5 Flash with audio input for accurate speech-to-text transcription
- **Structured Output**: Uses prompt-engineered structured JSON for reliable parsing
- **Audio Pronunciation**: Uses ElevenLabs API for text-to-speech in multiple languages
- **Word Learning**: Saves learned words with pinyin, translations, explanations, and multiple translation variants
- **Flashcards**: Review learned words with interactive flashcards
- **Progress Tracking**: Track words learned, practice streak, and total queries
- **Voice Input**: Record audio directly and transcribe using Gemini 2.5 Flash

## Tech Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Database**: MongoDB Atlas
- **APIs**: 
  - **Google Gemini 2.5 Flash**: 
    - Audio transcription with direct audio input
    - Language detection and tagging (Chinese, English, French)
    - Translation with structured JSON output using `responseSchema`
    - Reasoning capabilities for accurate language detection
    - Supports code-switching scenarios
  - **ElevenLabs**: Speech synthesis for pronunciation in multiple languages

## Key Technical Features

### Structured JSON Output
All API responses use prompt-engineered structured JSON with schema validation (`responseSchema`) for reliable parsing and type safety.

### Audio Processing
- Direct audio input to Gemini 2.5 Flash (no intermediate transcription service)
- Automatic language detection from audio
- Support for mixed-language audio input
- Real-time transcription with language tagging

### Translation Features
- Context-aware translation with conversation history
- Streaming translation for real-time updates
- Word-by-word translation with multiple variants
- Detailed translation with connotations and part of speech

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

1. Select source and target languages from the dropdowns (Chinese, English, or French)
2. Enter text or click "Start Recording" to record audio
3. The audio will be transcribed using Gemini 2.5 Flash with automatic language detection
4. Click "Translate" to get the translation with word-by-word breakdown
5. View the translation with pinyin (for Chinese) and word explanations
6. Click "Play Pronunciation" to hear the audio pronunciation
7. Click "Save Words" to add new words to your vocabulary with multiple translation variants

### Learning Dashboard

- **Flashcards**: Review words by flipping cards to see translations
- **All Words**: Browse all learned words with search functionality
- **Progress Stats**: View words learned, current streak, and total queries

## API Routes

- `POST /api/translate` - Translate text between supported languages (supports streaming)
- `POST /api/translate/context` - Context-aware translation with conversation history
- `POST /api/translate/detailed` - Detailed translation with full word breakdown
- `POST /api/translate/live` - Live streaming translation for real-time updates
- `POST /api/translate/word` - Translate a single word with context
- `POST /api/transcribe` - Transcribe audio using Gemini 2.5 Flash
- `POST /api/synthesize` - Generate audio from text (supports multiple languages)
- `GET /api/words` - Get all learned words
- `POST /api/words` - Save a new word
- `DELETE /api/words?id=...` - Delete a word
- `GET /api/queries` - Get past translation queries
- `POST /api/queries` - Save a translation query

## Browser Support

- Audio recording requires a browser with MediaRecorder API support (Chrome, Edge, Firefox, Safari)
- All other features work in all modern browsers

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── learn/            # Learning dashboard
│   └── page.tsx          # Main translation page
├── components/
│   ├── ui/               # shadcn components
│   ├── AudioInput.tsx    # Audio recording and transcription component
│   ├── TranslationDisplay.tsx  # Translation display with word breakdown
│   ├── LiveWordDisplay.tsx     # Live word-by-word translation display
│   ├── WordCard.tsx
│   ├── Flashcard.tsx
│   └── ProgressStats.tsx
├── lib/
│   ├── db.ts             # MongoDB connection
│   ├── gemini.ts         # Gemini 2.5 Flash API client (transcription, translation)
│   ├── elevenlabs.ts     # ElevenLabs API client (speech synthesis)
│   └── storage.ts        # Browser storage utilities
└── types/                # TypeScript types
```

## License

MIT
