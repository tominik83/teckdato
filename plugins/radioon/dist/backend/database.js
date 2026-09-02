"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STATIONS = void 0;
exports.resolveStationsForRequest = resolveStationsForRequest;
exports.saveStations = saveStations;
exports.writeRadioSnapshot = writeRadioSnapshot;
exports.DEFAULT_STATIONS = [
    {
        id: "lofi-fm",
        name: "Lofi FM",
        playlistUrl: "https://example.com/lofi.m3u"
    },
    {
        id: "radio-two",
        name: "Radio 2",
        playlistUrl: "https://example.com/radio2.m3u"
    },
    {
        id: "thc",
        name: "Techno Chronicle",
        playlistUrl: "https://thc.teckdato.com/stream/de",
        station_logo: "http://localhost/logo.png"
    }
];
function isHttpUrl(value) {
    return typeof value === "string" && /^https?:\/\//i.test(value);
}
function isRadioStation(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    return (typeof candidate.id === "string" &&
        typeof candidate.name === "string" &&
        isHttpUrl(candidate.playlistUrl) &&
        (candidate.streamUrl === undefined || isHttpUrl(candidate.streamUrl)));
}
function normalizeLegacyStation(value, index) {
    if (typeof value === "string" && value.trim()) {
        return {
            id: `legacy-station-${index + 1}`,
            name: value,
            playlistUrl: "https://example.com/placeholder.m3u"
        };
    }
    if (isRadioStation(value)) {
        return value;
    }
    return null;
}
async function resolveStationsForRequest(context) {
    const cachedStations = await context.database.getState(context.plugin.id, "stations-cache");
    if (!Array.isArray(cachedStations)) {
        return exports.DEFAULT_STATIONS;
    }
    const normalized = cachedStations
        .map((entry, index) => normalizeLegacyStation(entry, index))
        .filter((entry) => Boolean(entry));
    if (normalized.length === 0) {
        return exports.DEFAULT_STATIONS;
    }
    return normalized;
}
async function saveStations(context, stations) {
    await context.database.setState(context.plugin.id, "stations-cache", stations);
    await writeRadioSnapshot(context, "stations-cache.json", stations);
}
async function writeRadioSnapshot(context, name, payload) {
    await context.storage.writeText(`${context.plugin.id}/${name}`, JSON.stringify(payload, null, 2));
}
//# sourceMappingURL=database.js.map