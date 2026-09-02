"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRadioRoutes = registerRadioRoutes;
const database_1 = require("./database");
const METADATA_TIMEOUT_MS = 7000;
const METADATA_POLL_MAX_BYTES = 65536;
const METADATA_CACHE_KEY = "last-metadata";
function isHttpUrl(value) {
    return /^https?:\/\//i.test(value);
}
function resolvePlaylistTextToStreamUrl(text) {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    return lines.find((line) => !line.startsWith("#") && isHttpUrl(line)) ?? null;
}
function decodeMetadataBlock(bytes) {
    const decoded = new TextDecoder("utf-8").decode(bytes).replace(/\0+$/g, "").trim();
    if (!decoded) {
        return null;
    }
    const match = decoded.match(/StreamTitle='([^']*)';?/i);
    if (!match || typeof match[1] !== "string") {
        return null;
    }
    const title = match[1].trim();
    return title || null;
}
function parseArtistAndTrack(title) {
    if (!title) {
        return {
            artist: null,
            track: null
        };
    }
    const parts = title.split(" - ").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
        return {
            artist: null,
            track: null
        };
    }
    const [artist, ...trackParts] = parts;
    return {
        artist,
        track: trackParts.join(" - ")
    };
}
function isLikelyDynamicTrackTitle(title) {
    if (!title) {
        return false;
    }
    return title.includes(" - ");
}
async function resolveArtworkUrl(parts) {
    if (!parts.artist || !parts.track) {
        return null;
    }
    const term = encodeURIComponent(`${parts.artist} ${parts.track}`);
    const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`;
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "TeckdatoRadioOn/1.0"
            }
        });
        if (!response.ok) {
            return null;
        }
        const payload = (await response.json());
        const artwork = payload.results?.[0]?.artworkUrl100;
        if (!artwork || typeof artwork !== "string") {
            return null;
        }
        return artwork.replace(/100x100bb\.jpg$/i, "512x512bb.jpg");
    }
    catch {
        return null;
    }
}
function readCachedMetadata(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = value;
    if (typeof record.streamUrl !== "string" || !record.streamUrl.trim()) {
        return null;
    }
    return {
        streamUrl: String(record.streamUrl),
        nowPlaying: typeof record.nowPlaying === "string" ? record.nowPlaying : null,
        artist: typeof record.artist === "string" ? record.artist : null,
        track: typeof record.track === "string" ? record.track : null,
        stationName: typeof record.stationName === "string" ? record.stationName : null,
        artworkUrl: typeof record.artworkUrl === "string" ? record.artworkUrl : null,
        metadataAvailable: Boolean(record.metadataAvailable),
        fetchedAt: typeof record.fetchedAt === "string" ? record.fetchedAt : new Date().toISOString(),
        metadataSource: "cache"
    };
}
function mergeChunks(chunks) {
    const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}
async function resolveInputToStreamUrl(rawUrl) {
    const shouldResolvePlaylist = /\.m3u8?(\?.*)?$/i.test(rawUrl);
    if (!shouldResolvePlaylist) {
        return {
            streamUrl: rawUrl,
            resolved: false
        };
    }
    const response = await fetch(rawUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch playlist (${response.status})`);
    }
    const playlistText = await response.text();
    const streamUrl = resolvePlaylistTextToStreamUrl(playlistText);
    if (!streamUrl) {
        throw new Error("Playlist does not contain a playable stream URL");
    }
    return {
        streamUrl,
        resolved: true
    };
}
async function readRadioMetadata(streamUrl) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
        abortController.abort();
    }, METADATA_TIMEOUT_MS);
    try {
        const response = await fetch(streamUrl, {
            headers: {
                "Icy-MetaData": "1",
                "User-Agent": "TeckdatoRadioOn/1.0"
            },
            signal: abortController.signal
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch stream metadata (${response.status})`);
        }
        const stationName = response.headers.get("icy-name")?.trim() || null;
        const metaintHeader = response.headers.get("icy-metaint");
        const metaint = metaintHeader ? Number.parseInt(metaintHeader, 10) : Number.NaN;
        if (!response.body || !Number.isFinite(metaint) || metaint <= 0) {
            return {
                nowPlaying: null,
                stationName
            };
        }
        const reader = response.body.getReader();
        const chunks = [];
        let collectedBytes = 0;
        let parsedOffset = 0;
        let fallbackNowPlaying = null;
        while (collectedBytes <= METADATA_POLL_MAX_BYTES) {
            const chunk = await reader.read();
            if (chunk.done) {
                break;
            }
            chunks.push(chunk.value);
            collectedBytes += chunk.value.length;
            if (collectedBytes <= metaint) {
                continue;
            }
            const merged = mergeChunks(chunks);
            while (true) {
                const metaLengthIndex = parsedOffset + metaint;
                if (metaLengthIndex >= merged.length) {
                    break;
                }
                const metadataLengthByte = merged[metaLengthIndex] ?? 0;
                const metadataLength = metadataLengthByte * 16;
                const metadataStart = metaLengthIndex + 1;
                const metadataEnd = metadataStart + metadataLength;
                if (metadataEnd > merged.length) {
                    break;
                }
                if (metadataLength > 0) {
                    const metadataBytes = merged.slice(metadataStart, metadataEnd);
                    const parsedTitle = decodeMetadataBlock(metadataBytes);
                    if (parsedTitle) {
                        if (isLikelyDynamicTrackTitle(parsedTitle)) {
                            await reader.cancel();
                            return {
                                nowPlaying: parsedTitle,
                                stationName
                            };
                        }
                        if (!fallbackNowPlaying) {
                            fallbackNowPlaying = parsedTitle;
                        }
                    }
                }
                parsedOffset = metadataEnd;
            }
        }
        await reader.cancel();
        return {
            nowPlaying: fallbackNowPlaying,
            stationName
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
function createStationId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `station-${Date.now()}`;
}
function readRequestBodyRecord(body) {
    if (!body || typeof body !== "object") {
        return {};
    }
    return body;
}
function registerRadioRoutes(context, options) {
    let lastDispatchedMetadataFingerprint = "";
    context.http.get("/radioon", async (_req, res) => {
        const stations = await options.getStations();
        const refreshedAt = new Date().toISOString();
        await options.onRequest({
            stations,
            refreshedAt
        });
        res.json({
            stations,
            refreshedAt
        });
    });
    context.http.post("/radioon/resolve-stream", async (req, res) => {
        const body = readRequestBodyRecord(req.body);
        const rawUrl = String(body.url ?? "").trim();
        if (!rawUrl) {
            res.status(400).json({ error: "Missing body field: url" });
            return;
        }
        if (!isHttpUrl(rawUrl)) {
            res.status(400).json({ error: "Only http(s) URLs are supported", url: rawUrl });
            return;
        }
        try {
            const resolved = await resolveInputToStreamUrl(rawUrl);
            res.json({
                inputUrl: rawUrl,
                streamUrl: resolved.streamUrl,
                resolved: resolved.resolved
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const status = message.includes("playable stream URL") ? 422 : 502;
            res.status(status).json({
                error: message,
                url: rawUrl
            });
        }
    });
    context.http.post("/radioon/metadata", async (req, res) => {
        const body = readRequestBodyRecord(req.body);
        const rawUrl = String(body.url ?? "").trim();
        const fallbackTitle = String(body.fallbackTitle ?? "").trim() || null;
        if (!rawUrl) {
            res.status(400).json({ error: "Missing body field: url" });
            return;
        }
        if (!isHttpUrl(rawUrl)) {
            res.status(400).json({ error: "Only http(s) URLs are supported", url: rawUrl });
            return;
        }
        try {
            const resolution = await resolveInputToStreamUrl(rawUrl);
            const metadata = await readRadioMetadata(resolution.streamUrl);
            const cachedState = await context.database.getState(context.plugin.id, METADATA_CACHE_KEY);
            const cachedMetadata = readCachedMetadata(cachedState);
            const shouldUseCache = !metadata.nowPlaying &&
                !metadata.stationName &&
                Boolean(cachedMetadata && cachedMetadata.streamUrl === resolution.streamUrl);
            const nowPlaying = shouldUseCache
                ? cachedMetadata?.nowPlaying ?? fallbackTitle
                : metadata.nowPlaying || fallbackTitle;
            const parts = parseArtistAndTrack(nowPlaying);
            const artworkUrl = shouldUseCache
                ? cachedMetadata?.artworkUrl ?? null
                : await resolveArtworkUrl(parts);
            const fetchedAt = new Date().toISOString();
            const payload = {
                streamUrl: resolution.streamUrl,
                nowPlaying,
                artist: parts.artist,
                track: parts.track,
                stationName: shouldUseCache
                    ? cachedMetadata?.stationName ?? null
                    : metadata.stationName,
                artworkUrl,
                metadataAvailable: shouldUseCache
                    ? Boolean(cachedMetadata?.metadataAvailable)
                    : Boolean(metadata.nowPlaying || metadata.stationName),
                fetchedAt,
                metadataSource: shouldUseCache ? "cache" : "live"
            };
            if (payload.nowPlaying || payload.stationName || payload.artworkUrl) {
                await context.database.setState(context.plugin.id, METADATA_CACHE_KEY, payload);
            }
            const fingerprint = JSON.stringify({
                streamUrl: payload.streamUrl,
                nowPlaying: payload.nowPlaying,
                artist: payload.artist,
                track: payload.track,
                stationName: payload.stationName,
                artworkUrl: payload.artworkUrl
            });
            if (fingerprint !== lastDispatchedMetadataFingerprint) {
                lastDispatchedMetadataFingerprint = fingerprint;
                await context.websocket.dispatch("radio:status", {
                    source: "metadata",
                    ...payload
                });
            }
            res.json({
                inputUrl: rawUrl,
                resolved: resolution.resolved,
                ...payload
            });
        }
        catch (error) {
            res.status(502).json({
                error: error instanceof Error ? error.message : String(error),
                url: rawUrl
            });
        }
    });
    context.http.post("/radioon/stations", async (req, res) => {
        const body = readRequestBodyRecord(req.body);
        const name = String(body.name ?? "").trim();
        const playlistUrl = String(body.playlistUrl ?? body.url ?? "").trim();
        const streamUrlInput = String(body.streamUrl ?? "").trim();
        if (!name) {
            res.status(400).json({ error: "Missing body field: name" });
            return;
        }
        if (!playlistUrl || !isHttpUrl(playlistUrl)) {
            res.status(400).json({ error: "Missing or invalid body field: playlistUrl" });
            return;
        }
        const stations = await options.getStations();
        const station = {
            id: createStationId(name),
            name,
            playlistUrl,
            streamUrl: isHttpUrl(streamUrlInput) ? streamUrlInput : undefined
        };
        const nextStations = [
            ...stations.filter((entry) => entry.id !== station.id && entry.playlistUrl !== station.playlistUrl),
            station
        ];
        await (0, database_1.saveStations)(context, nextStations);
        res.status(201).json({
            saved: true,
            station,
            count: nextStations.length
        });
    });
    context.http.get("/radioon/health", async (_req, res) => {
        const health = {
            status: "ok"
        };
        res.json({
            health
        });
    });
}
//# sourceMappingURL=routes.js.map