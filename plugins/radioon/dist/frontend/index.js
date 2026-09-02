"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apiBase = window.location.origin;
const root = document.createElement("div");
root.style.fontFamily = "Segoe UI, sans-serif";
root.style.padding = "16px";
root.innerHTML = `
	<h2 style="margin: 0 0 8px;">RadioOn</h2>
	<p style="margin: 0 0 12px; color: #475569;">Radio stream frontend connected to the Teckdato host.</p>
	<pre id="radio-state" style="margin: 0 0 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; padding: 10px; font-size: 12px;">loading stations...</pre>
	<div style="display:grid; gap: 10px; margin-bottom: 12px;">
		<label style="display:grid; gap: 6px;">
			<span style="color:#475569; font-size:13px;">Stream label</span>
			<input id="stream-title" style="padding:10px 12px; border-radius:8px; border:1px solid #cbd5e1;" placeholder="Custom radio" value="Custom radio" />
		</label>
		<label style="display:grid; gap: 6px;">
			<span style="color:#475569; font-size:13px;">M3U or direct stream URL</span>
			<textarea id="stream-url" style="padding:10px 12px; border-radius:8px; border:1px solid #cbd5e1; min-height:90px;" placeholder="https://example.com/station.m3u8"></textarea>
		</label>
		<div style="display:flex; gap:8px; flex-wrap:wrap;">
			<button id="play" type="button" style="padding:10px 14px; border-radius:8px; border:0; background:#2563eb; color:white; cursor:pointer;">Play</button>
			<button id="stop" type="button" style="padding:10px 14px; border-radius:8px; border:1px solid #cbd5e1; background:white; cursor:pointer;">Stop</button>
			<button id="refresh" type="button" style="padding:10px 14px; border-radius:8px; border:1px solid #cbd5e1; background:white; cursor:pointer;">Refresh Stations</button>
		</div>
	</div>
	<div id="stations" style="display:grid; gap:10px;"></div>
`;
document.body.appendChild(root);
const stateNode = document.getElementById("radio-state");
const stationsNode = document.getElementById("stations");
const streamTitleInput = document.getElementById("stream-title");
const streamUrlInput = document.getElementById("stream-url");
const playButton = document.getElementById("play");
const stopButton = document.getElementById("stop");
const refreshButton = document.getElementById("refresh");
const runtime = {
    apiBase,
    stations: [],
    hostContext: null,
    currentStreamUrl: "",
    currentTitle: ""
};
function setState(value) {
    if (stateNode) {
        stateNode.textContent = JSON.stringify(value, null, 2);
    }
}
function renderStations() {
    if (!stationsNode) {
        return;
    }
    if (runtime.stations.length === 0) {
        stationsNode.innerHTML = '<p style="margin:0; color:#475569;">No cached stations available yet.</p>';
        return;
    }
    stationsNode.innerHTML = runtime.stations
        .map((station, index) => `
				<article style="border:1px solid #cbd5e1; border-radius:8px; padding:12px; background:#f8fafc;">
					<strong>${station.name || `Station ${index + 1}`}</strong>
					<p style="margin:6px 0 0; color:#475569; font-size:13px;">${station.playlistUrl}</p>
					<p style="margin:6px 0 0; color:#0f172a; font-size:13px;">${station.streamUrl || "not resolved yet"}</p>
				</article>
			`)
        .join("");
}
async function request(path, init) {
    const response = await fetch(`${runtime.apiBase}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {})
        }
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
    }
    return payload;
}
async function loadStations() {
    setState({ status: "loading" });
    const payload = await request("/radio");
    runtime.stations = Array.isArray(payload.stations) ? payload.stations : [];
    renderStations();
    setState({
        status: "ready",
        stationCount: runtime.stations.length,
        refreshedAt: payload.refreshedAt ?? null
    });
    window.parent?.postMessage({
        type: "teckdato:plugin-health",
        payload: {
            status: "ok",
            pluginId: "radioon",
            stationCount: runtime.stations.length
        }
    }, "*");
}
async function resolveStreamUrl(rawUrl) {
    const payload = await request("/radio/resolve-stream", {
        method: "POST",
        body: JSON.stringify({ url: rawUrl })
    });
    return payload.streamUrl;
}
async function playCustomStream() {
    const title = streamTitleInput?.value?.trim() || "Custom radio";
    const rawUrl = streamUrlInput?.value?.trim() || "";
    if (!rawUrl) {
        throw new Error("Enter a playlist or stream URL first.");
    }
    setState({ status: "resolving", title, rawUrl });
    const streamUrl = await resolveStreamUrl(rawUrl);
    runtime.currentStreamUrl = streamUrl;
    runtime.currentTitle = title;
    setState({ status: "playing", title, streamUrl });
    window.parent?.postMessage({
        type: "teckdato:radio-play-request",
        payload: {
            pluginId: "radioon",
            title,
            streamUrl
        }
    }, "*");
}
function stopPlayback() {
    runtime.currentStreamUrl = "";
    runtime.currentTitle = "";
    setState({ status: "stopped" });
    window.parent?.postMessage({
        type: "teckdato:radio-stop-request",
        payload: {
            pluginId: "radioon"
        }
    }, "*");
}
window.parent?.postMessage({
    type: "teckdato:plugin-ready",
    payload: {
        pluginId: "radioon",
        version: "1.0.0"
    }
}, "*");
window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message?.type) {
        return;
    }
    if (message.type === "teckdato:host-context") {
        runtime.hostContext = message.payload || null;
        setState({ status: "host-context", context: runtime.hostContext });
        void loadStations().catch((error) => {
            setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
        });
        return;
    }
    if (message.type === "teckdato:host-health-request") {
        window.parent?.postMessage({
            type: "teckdato:plugin-health",
            payload: {
                status: "ok",
                pluginId: "radioon",
                streamCount: runtime.stations.length,
                currentStreamUrl: runtime.currentStreamUrl
            }
        }, "*");
        return;
    }
    if (message.type === "teckdato:host-unmount") {
        setState({ status: "host-unmounted" });
    }
});
refreshButton?.addEventListener("click", () => {
    void loadStations().catch((error) => {
        setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
    });
});
playButton?.addEventListener("click", () => {
    void playCustomStream().catch((error) => {
        setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
        window.parent?.postMessage({
            type: "teckdato:plugin-error",
            payload: error instanceof Error ? error.message : String(error)
        }, "*");
    });
});
stopButton?.addEventListener("click", stopPlayback);
void loadStations().catch((error) => {
    setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
});
//# sourceMappingURL=index.js.map