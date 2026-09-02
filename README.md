# YT Music Scrobbler Extractor

<img src="public/icon.svg" alt="YT Music Scrobbler Extractor icon" width="96" height="96" />

Convert your YouTube Music history to scrobbling format. Extract watch history from Google Takeout, enrich with album data via YouTube Music API, and generate formatted JSON files for music tracking platforms like Last.fm.

## Features

- Extract YouTube Music History - Parse your Google Takeout data to extract YouTube Music listening history
- Enrich with Album Data - Automatically fetch album information using YouTube Music API
- Generate Statistics - Get insights about your top artists, tracks, and listening patterns
- Flexible Output - Auto-chunked JSON files (max 2800 songs per file) for easy import into scrobbling services
- Web UI - User-friendly interface with real-time processing progress
- Batch Processing - Efficient API usage with smart batching and rate limiting

## Prerequisites

- Node.js 16+
- npm or yarn
- Google Takeout data with YouTube Music history
- Internet connection (for YouTube Music API)

## Installation

```bash
git clone https://github.com/slvinnm/ytmusic-scrobbler-extractor.git
cd ytmusic-scrobbler-extractor
npm install
```

## Usage

### Start the Server

```bash
npm start
```

The application will start on `http://localhost:3000`

### Export Your YouTube Music History

1. Visit [Google Takeout](https://takeout.google.com/)
2. Select **YouTube and YouTube Music** > **YouTube Music** > **All data included**
3. Download your data and extract the `watch-history.json` file

### Process Your History

1. Open `http://localhost:3000` in your browser
2. Upload your `watch-history.json` file
3. Monitor real-time processing progress
4. Download the formatted JSON files when complete

## Output Format

The extractor generates formatted data compatible with scrobbling services:

```json
{
  "master_metadata_album_artist_name": "Artist Name",
  "master_metadata_track_name": "Song Title",
  "master_metadata_album_album_name": "Album Name",
  "ts": "2024-01-15T10:30:00Z"
}
```

### Generated Files

- **Statistics**: Total songs, unique artists, unique tracks, top artist, top track, successful album matches
- **JSON Output**: Single `formatted.json` (if ≤2800 songs) or multiple `formatted-N.json` files
- **Download Links**: Direct links to all generated files

## How It Works

1. **Parsing** - Reads and parses the Google Takeout JSON file
2. **Filtering** - Extracts YouTube Music entries with valid metadata and URLs
3. **Cleaning** - Removes prefixes (e.g., "Watched") and cleans artist names (removes " - Topic")
4. **Enrichment** - Queries YouTube Music API for album information via:
   - Direct song lookup using video ID
   - Search fallback for unmatched songs
5. **Formatting** - Standardizes output to scrobbler-compatible format
6. **Chunking** - Splits large datasets into manageable files
7. **Statistics** - Computes listening patterns and metadata

## API Rate Limiting

- Batch size: 50 songs per batch
- Delay between batches: 1 second
- Configurable via `BATCH_SIZE` and `API_DELAY` in `index.js`

## Project Structure

```
.
├── index.js              # Express server & processing logic
├── public/
│   ├── icon.svg         # App icon
│   ├── index.html       # Web UI
│   └── landing-dark.svg # Background image
└── package.json         # Dependencies & metadata
```

## Technologies Used

- **Express.js** - Web framework
- **Multer** - File upload handling
- **ytmusic-api** - YouTube Music API client
- **Node.js** - Runtime

## Configuration

Edit `index.js` to customize:

```javascript
const CHUNK_SIZE = 2800;  // Max songs per output file
const BATCH_SIZE = 50;    // Songs per API batch
const API_DELAY = 1000;   // Milliseconds between batches
```

## Error Handling

- Invalid JSON files are rejected with clear error messages
- Failed album lookups default to track name as album
- API errors are logged without stopping processing
- Partial results are still generated on failure

## License

ISC

## Author

slvinnm

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## Support

For issues, questions, or suggestions, please open an issue on the [GitHub repository](https://github.com/slvinnm/ytmusic-scrobbler-extractor).
