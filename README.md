# Codeswitching Language Learning Webapp

A Next.js webapp that listens to mixed Chinese/English input, translates unknown words in real-time, plays audio pronunciation, and tracks learned vocabulary with flashcards and progress metrics.

## Features

- **Codeswitching Detection**: Automatically detects and translates mixed Chinese/English text
- **Real-time Translation**: Translates English parts to Chinese while preserving Chinese words
- **Audio Pronunciation**: Uses ElevenLabs API for Chinese text-to-speech
- **Word Learning**: Saves learned words with pinyin, translations, and explanations
- **Flashcards**: Review learned words with interactive flashcards
- **Progress Tracking**: Track words learned, practice streak, and total queries
- **Speech Input**: Use Web Speech API for voice input (Chrome/Edge)

## Tech Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Database**: MongoDB Atlas
- **APIs**: 
  - Google Gemini (transcription, translation, pinyin)
  - ElevenLabs (speech synthesis)

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

1. Enter mixed Chinese/English text (e.g., "ni hao my name is li hua")
2. Click "Translate" or use the microphone button for voice input
3. View the translation with pinyin
4. Click "Play Pronunciation" to hear the audio
5. Click "Save Words" to add new words to your vocabulary

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
│   ├── db.ts             # MongoDB connection
│   ├── gemini.ts         # Gemini API client
│   ├── elevenlabs.ts    # ElevenLabs API client
│   └── storage.ts        # Browser storage utilities
└── types/                # TypeScript types
```

## License

MIT
