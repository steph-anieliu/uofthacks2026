# Codeswitching Learning Web App

A Next.js web application that helps users learn languages through codeswitching. Listen to speech, detect codeswitching between languages (starting with Chinese), translate unknown words with connotations, and automatically generate flashcards for review.

## Features

- **Real-time and Push-to-Talk Audio Input**: Toggle between continuous listening and push-to-talk recording
- **Codeswitching Detection**: Automatically detects when users mix languages in their speech
- **Translation with Connotations**: Provides translations with contextual meanings (e.g., "heureux (full of joy)")
- **Multi-Context Translations**: Shows alternative translations in different contexts
- **Conversation Sessions**: Manage multiple conversation sessions similar to ChatGPT
- **Automatic Flashcard Generation**: Creates flashcards from conversation messages
- **Progress Tracking**: Track words learned, streaks, and learning statistics
- **Review System**: Spaced repetition flashcards with difficulty-based scheduling

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Database**: Snowflake
- **Authentication**: NextAuth.js
- **APIs**: 
  - Google Gemini (transcription, translation, pinyin, explanations)
  - ElevenLabs (text-to-speech)

## Prerequisites

- Node.js 18+ and npm
- Snowflake account with database access
- Google Gemini API key
- ElevenLabs API key (optional, falls back to browser TTS)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Required environment variables:
- `SNOWFLAKE_ACCOUNT`: Your Snowflake account identifier
- `SNOWFLAKE_USERNAME`: Snowflake username
- `SNOWFLAKE_PASSWORD`: Snowflake password
- `SNOWFLAKE_WAREHOUSE`: Snowflake warehouse name
- `SNOWFLAKE_DATABASE`: Snowflake database name
- `SNOWFLAKE_SCHEMA`: Snowflake schema name
- `GEMINI_API_KEY`: Google Gemini API key
- `ELEVENLABS_API_KEY`: ElevenLabs API key (optional)
- `NEXTAUTH_SECRET`: Generate a random secret (e.g., `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000`)

### 3. Set Up Snowflake Database

Run the SQL schema file in your Snowflake database:

```sql
-- Execute lib/schema.sql in your Snowflake database
```

You can do this via Snowflake web UI or CLI.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Create an Account

1. Navigate to `/register`
2. Create a new account
3. Start using the app!

## Project Structure

```
uofthacks2026/
├── app/
│   ├── (auth)/          # Authentication pages
│   ├── (main)/          # Main application pages
│   ├── api/             # API routes
│   └── layout.tsx       # Root layout
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── AudioRecorder.tsx
│   ├── ConversationPanel.tsx
│   ├── ConversationMessage.tsx
│   ├── TranslationDisplay.tsx
│   └── StatsDisplay.tsx
├── lib/
│   ├── db.ts            # Snowflake connection
│   ├── gemini.ts        # Gemini API integration
│   ├── elevenlabs.ts    # ElevenLabs integration
│   ├── auth.ts          # NextAuth configuration
│   └── schema.sql       # Database schema
└── types/
    └── index.ts         # TypeScript types
```

## Usage

### Starting a Conversation

1. Log in to your account
2. A new conversation will be automatically created
3. Choose your audio input mode (real-time or push-to-talk)
4. Start speaking or typing mixed-language sentences

### Real-time Mode

- Click "Start Listening" to begin continuous speech recognition
- Speak naturally with codeswitching (e.g., "ni hao my name is li hua")
- Words will be automatically detected and translated

### Push-to-Talk Mode

- Toggle to push-to-talk mode
- Hold the record button while speaking
- Release to process and translate

### Reviewing Flashcards

1. Navigate to the Review page
2. Click cards to flip and see translations
3. Rate difficulty (Easy/Medium/Hard) to schedule next review
4. Cards are automatically created from your conversations

### Viewing Statistics

- Check your progress on the Stats page
- See total words learned, current streak, and conversation count

## API Routes

- `/api/auth/[...nextauth]` - NextAuth authentication
- `/api/conversations` - Conversation CRUD operations
- `/api/conversations/[id]/messages` - Message management
- `/api/translate` - Translation with connotations
- `/api/words` - Learned words management
- `/api/audio/generate` - Audio generation (ElevenLabs)

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Notes

- The app uses Web Speech API for client-side transcription (works best in Chrome/Edge)
- ElevenLabs audio generation is optional and falls back to browser TTS if unavailable
- Snowflake connection pooling is handled automatically
- All database operations use parameterized queries for security

## Troubleshooting

### Snowflake Connection Issues

- Verify all environment variables are set correctly
- Check that your Snowflake account has proper network access
- Ensure the database and schema exist

### Audio Input Not Working

- Grant microphone permissions in your browser
- Use Chrome or Edge for best Web Speech API support
- Check browser console for errors

### Translation Issues

- Verify Gemini API key is correct
- Check API quota/limits in Google Cloud Console
- Review network tab for API errors

## Future Enhancements

- Support for additional languages beyond Chinese
- Roleplaying scenarios for conversation practice
- Formality levels (family/friends/workplace)
- Pronunciation guidance with voice comparison
- Advanced spaced repetition algorithms

## License

This project is part of UofT Hacks 2026.
