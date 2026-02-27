# MediaForge MCP

**Give any AI model a media production studio.**

MediaForge MCP is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes media processing tools — transcription, subtitle generation, audio extraction, and metadata inspection — to any MCP-compatible AI client (Claude Desktop, Cursor, etc.).

It works as a lightweight orchestrator: local CPU tasks run via FFmpeg, and AI-powered tasks route to fast, free-tier inference APIs (Groq Whisper).

> **Free hosted instance** available at `https://mediaforge.thinkelution.com` — try it with any MCP client, no setup needed.

---

## Available Tools

| Tool | Description | Provider | Cost |
|------|-------------|----------|------|
| `transcribe_media` | Transcribe audio/video to text with timestamps | Groq Whisper | Free |
| `generate_subtitles` | Generate SRT/VTT subtitles, optional burn-in | Groq + FFmpeg | Free |
| `extract_audio` | Extract audio from video (mp3/wav/aac/flac/ogg) | FFmpeg | Free |
| `media_info` | Get detailed media file metadata | FFprobe | Free |

### Usage Limits (Free Hosted Instance)

The public server at `mediaforge.thinkelution.com` has these fair-use limits:

- **Max file size:** 500 MB
- **Transcription:** Subject to Groq free-tier rate limits
- **Temp files:** Auto-deleted after 2 hours
- **Concurrent connections:** Best-effort, no SLA

For heavy production use, self-host your own instance (see below).

---

## Quick Start — Connect to the Hosted Server

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mediaforge": {
      "url": "https://mediaforge.thinkelution.com/sse"
    }
  }
}
```

### Cursor

Add to your MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "mediaforge": {
      "url": "https://mediaforge.thinkelution.com/sse"
    }
  }
}
```

That's it. Your AI assistant now has media processing superpowers.

---

## Self-Hosting

### Prerequisites

- Node.js 20+
- FFmpeg installed (`sudo apt install ffmpeg`)
- A [Groq API key](https://console.groq.com) (free tier)

### Install & Run

```bash
git clone https://github.com/Thinkelution/mediaforge-mcp.git
cd mediaforge-mcp
npm install
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
npm run build
npm start          # stdio mode (for local MCP clients)
npm run start:http # HTTP/SSE mode (for remote access)
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | **Required.** Free at [console.groq.com](https://console.groq.com) |
| `REPLICATE_API_TOKEN` | — | Optional. Fallback transcription provider |
| `MEDIAFORGE_TRANSPORT` | `stdio` | `stdio` for local, `http` for remote SSE |
| `MEDIAFORGE_PORT` | `3100` | HTTP server port |
| `MEDIAFORGE_TEMP_DIR` | `/tmp/mediaforge` | Working directory for temp files |
| `MEDIAFORGE_MAX_FILE_SIZE_MB` | `500` | Max input file size |
| `MEDIAFORGE_CLEANUP_AFTER_HOURS` | `2` | Auto-cleanup interval |
| `MEDIAFORGE_LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

### Local MCP Config (stdio)

```json
{
  "mcpServers": {
    "mediaforge": {
      "command": "node",
      "args": ["/path/to/mediaforge-mcp/dist/index.js"],
      "env": {
        "GROQ_API_KEY": "gsk_your_key"
      }
    }
  }
}
```

---

## Tool Reference

### `transcribe_media`

Transcribe any audio or video file to text with timestamps.

**Parameters:**
- `file_path` (required): Absolute path to the media file
- `language`: ISO 639-1 code (`en`, `hi`, `es`, etc.) — auto-detects if omitted
- `output_format`: `text` | `srt` | `vtt` | `json` (default: `json`)
- `word_timestamps`: `true` for word-level precision (default: `false`)

**Supported formats:** mp3, mp4, wav, m4a, webm, ogg, flac, mkv, mov, avi

### `generate_subtitles`

Generate subtitle files from video, with optional burn-in.

**Parameters:**
- `file_path` (required): Path to video file
- `output_format`: `srt` | `vtt` | `both` (default: `srt`)
- `burn_in`: `true` to burn subtitles into the video (default: `false`)
- `language`: Language code (auto-detects if omitted)
- `style`: Object with `font_size`, `font_color`, `background_color`, `position`, `font_name`
- `max_chars_per_line`: Max characters per subtitle line (default: `42`)

### `extract_audio`

Extract the audio track from a video file.

**Parameters:**
- `file_path` (required): Path to video file
- `output_format`: `mp3` | `wav` | `aac` | `flac` | `ogg` (default: `mp3`)
- `bitrate`: e.g. `128k`, `192k`, `320k` (default: `192k`)
- `start_time` / `end_time`: Time range in `HH:MM:SS` or seconds
- `channels`: `mono` | `stereo` (default: `stereo`)

### `media_info`

Get detailed metadata about any media file.

**Parameters:**
- `file_path` (required): Path to the media file

**Returns:** file size, duration, codecs, resolution, FPS, bitrate, audio channels, subtitle tracks.

---

## API Endpoints (HTTP mode)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status and available tools |
| `/sse` | GET | SSE connection for MCP clients |
| `/messages` | POST | MCP message handler (session-based) |

---

## Architecture

```
MCP Client (Claude, Cursor, etc.)
       │
       │ MCP Protocol (SSE)
       ▼
┌─────────────────────────┐
│  MediaForge MCP Server  │
│  ┌──────┐ ┌──────────┐  │
│  │Router│ │File Mgr  │  │
│  └──┬───┘ └──────────┘  │
│     │                    │
│  ┌──▼────────────────┐   │
│  │ Provider Layer    │   │
│  │ Groq ↔ Replicate │   │
│  │ FFmpeg (local)    │   │
│  └───────────────────┘   │
└─────────────────────────┘
       │
       ▼
  /tmp/mediaforge/
```

---

## License

MIT — [Thinkelution Consultancy (OPC) Pvt Ltd](https://thinkelution.com)
