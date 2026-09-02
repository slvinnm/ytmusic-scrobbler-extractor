import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import YTMusic from "ytmusic-api";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: "uploads/" });

const CHUNK_SIZE = 2800;
const BATCH_SIZE = 50;
const API_DELAY = 1000;

app.use(express.static("public"));
app.use("/outputs", express.static("outputs"));

// Helpers
const cleanTitle = (title) => title.replace(/^Watched\s/i, "").trim();
const cleanArtist = (artist) => artist.replace(/\s-\sTopic$/i, "").trim();
const extractVideoId = (url) => {
  try { return new URL(url).searchParams.get("v"); }
  catch { return null; }
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jobs = new Map();

app.post("/upload", upload.single("historyFile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const jobId = Date.now().toString();
  jobs.set(jobId, { filePath: req.file.path, status: "processing" });

  res.json({ jobId });
  processFile(jobId);
});

app.get("/stream/:jobId", (req, res) => {
  const jobId = req.params.jobId;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const job = jobs.get(jobId);
  if (!job) return res.status(404).end();
  job.res = res;
});

async function processFile(jobId) {
  const job = jobs.get(jobId);
  const log = (msg) => job.res?.write(`data: ${JSON.stringify({ type: "log", msg })}\n\n`);
  const error = (msg) => job.res?.write(`data: ${JSON.stringify({ type: "error", msg })}\n\n`);

  try {
    log("Parsing watch-history.json...");
    const rawData = await fs.readFile(job.filePath, "utf8");
    const parsedData = JSON.parse(rawData);

    log("Filtering YouTube Music results...");
    const ytMusicData = parsedData
      .filter((item) => item.header === "YouTube Music" && item.subtitles?.length > 0 && item.titleUrl)
      .map((item) => ({
        master_metadata_album_artist_name: cleanArtist(item.subtitles[0].name),
        master_metadata_track_name: cleanTitle(item.title),
        ts: item.time,
        videoId: extractVideoId(item.titleUrl)
      }))
      .filter((item) => item.videoId !== null);

    log(`Found ${ytMusicData.length} valid songs. Connecting to API...`);

    const api = new YTMusic();
    await api.initialize();

    let successfulAlbums = 0;
    const finishedArr = [];

    for (let i = 0; i < ytMusicData.length; i += BATCH_SIZE) {
      const batch = ytMusicData.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(ytMusicData.length / BATCH_SIZE);

      log(`Processing batch ${batchNum} of ${totalBatches}... (${Math.round((batchNum / totalBatches) * 100)}%)`);

      const batchPromises = batch.map(async (song) => {
        let albumName = null;
        try {
          const songInfo = await api.getSong(song.videoId);
          if (songInfo?.album?.name) albumName = songInfo.album.name;
        } catch (err) { }

        if (!albumName) {
          try {
            const searchResults = await api.search(`${song.master_metadata_album_artist_name} ${song.master_metadata_track_name}`);
            const albumMatch = searchResults.find(res => res.type === "ALBUM" && res.artist?.name?.toLowerCase() === song.master_metadata_album_artist_name.toLowerCase());
            if (albumMatch?.name) albumName = albumMatch.name;
          } catch (err) { }
        }

        if (!albumName) {
          albumName = song.master_metadata_track_name;
        } else {
          successfulAlbums++;
        }

        song.master_metadata_album_album_name = albumName;
        delete song.videoId;
        return song;
      });

      const completedBatch = await Promise.all(batchPromises);
      finishedArr.push(...completedBatch);

      if (i + BATCH_SIZE < ytMusicData.length) await delay(API_DELAY);
    }

    log(`Formatting and generating files...`);

    const outputDir = path.join(__dirname, "outputs", jobId);
    await fs.mkdir(outputDir, { recursive: true });

    const outputFiles = [];
    if (finishedArr.length <= CHUNK_SIZE) {
      const p = `formatted.json`;
      await fs.writeFile(path.join(outputDir, p), JSON.stringify(finishedArr, null, 2));
      outputFiles.push(`/outputs/${jobId}/${p}`);
    } else {
      let numFiles = 0;
      for (let i = 0; i < finishedArr.length; i += CHUNK_SIZE) {
        numFiles++;
        const p = `formatted-${numFiles}.json`;
        await fs.writeFile(path.join(outputDir, p), JSON.stringify(finishedArr.slice(i, i + CHUNK_SIZE), null, 2));
        outputFiles.push(`/outputs/${jobId}/${p}`);
      }
    }

    const artistCounts = {};
    const trackCounts = {};

    finishedArr.forEach(song => {
      const artist = song.master_metadata_album_artist_name;
      const track = `${artist} - ${song.master_metadata_track_name}`;
      artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      trackCounts[track] = (trackCounts[track] || 0) + 1;
    });

    const stats = {
      total: finishedArr.length,
      artists: Object.keys(artistCounts).length,
      tracks: Object.keys(trackCounts).length,
      topArtist: Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0] || ["None", 0],
      topTrack: Object.entries(trackCounts).sort((a, b) => b[1] - a[1])[0] || ["None", 0],
      exactAlbums: successfulAlbums
    };

    job.res?.write(`data: ${JSON.stringify({ type: "done", stats, files: outputFiles })}\n\n`);

  } catch (err) {
    error(err.message);
  } finally {
    job.res?.end();
    jobs.delete(jobId);
    await fs.unlink(job.filePath).catch(() => { });
  }
}

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});