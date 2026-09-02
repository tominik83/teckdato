const stateNode = document.getElementById("state");
    const statusBadge = document.getElementById("status-badge");
    const stationsRoot = document.getElementById("stations");
    const streamTitleInput = document.getElementById("stream-title");
    const streamUrlInput = document.getElementById("stream-url");
    const playCustomButton = document.getElementById("play-custom");
    const stopCustomButton = document.getElementById("stop-custom");
    const refreshStationsButton = document.getElementById("refresh-stations");
    const playerBadge = document.getElementById("player-badge");
    const playerLabel = document.getElementById("player-label");
    const playerTitle = document.getElementById("player-title");
    const playerStatus = document.getElementById("player-status");
    const playerArt = document.getElementById("player-art");
    const playerMeta = document.getElementById("player-meta");
    const playerPlayButton = document.getElementById("player-play");
    const playerStopButton = document.getElementById("player-stop");
    const playerPopoutButton = document.getElementById("player-popout");
    const playerArtist = document.getElementById("player-artist");
    const playerTrack = document.getElementById("player-track");
    const playerStation = document.getElementById("player-station");
    const playerLiveStatus = document.getElementById("player-live-status");
    const playerSource = document.getElementById("player-source");
    const playerStreamUrl = document.getElementById("player-stream-url");

    const runtime = {
      apiBase: window.location.origin,
      stations: [],
      hostContext: null,
      currentStreamUrl: "",
      currentTitle: "",
      metadataPollId: null,
      metadata: null,
      lastMetadataSignature: "",
      playing: false,
      volume: 0.85,
      muted: false
    };
    const playerAudio = new Audio();
    playerAudio.preload = "none";
    playerAudio.volume = runtime.volume;
    playerAudio.muted = runtime.muted;
    playerAudio.addEventListener("play", () => {
      runtime.playing = true;
      setPlayerView({
        label: "Now playing",
        title: runtime.currentTitle || "RadioOn Player",
        status: "Playing",
        meta: runtime.currentStreamUrl || "Live stream",
        art: runtime.currentTitle || "Live Radio"
      });
    });
    playerAudio.addEventListener("pause", () => {
      runtime.playing = false;
      setPlayerView({
        label: runtime.currentStreamUrl ? "Paused" : "Playback stopped",
        title: runtime.currentTitle || "RadioOn Player",
        status: "Paused",
        meta: runtime.currentStreamUrl || "No active stream.",
        art: runtime.currentTitle || "Live Radio"
      });
    });
    playerAudio.addEventListener("ended", () => {
      runtime.playing = false;
      setPlayerView({
        label: "Playback ended",
        title: runtime.currentTitle || "RadioOn Player",
        status: "Stopped",
        meta: "The stream ended.",
        art: "Live Radio"
      });
    });

    function setBadge(value) {
      if (statusBadge) {
        statusBadge.textContent = value;
      }
      if (playerBadge) {
        playerBadge.textContent = value;
      }
    }

    function setPlayerView(next = {}) {
      const metadata = runtime.metadata || {};

      const artist =
        next.artist ||
        metadata.artist ||
        "Unknown Artist";

      const track =
        next.track ||
        metadata.track ||
        metadata.nowPlaying ||
        runtime.currentTitle ||
        "No track information";

      const station =
        next.stationName ||
        metadata.stationName ||
        "RadioOn";

      const artwork =
        next.artworkUrl ||
        metadata.artworkUrl ||
        "";

      if (playerLabel) {
        playerLabel.textContent =
          next.label || "No stream selected";
      }

      if (playerTitle) {
        playerTitle.textContent =
          station;
      }

      if (playerStatus) {
        playerStatus.textContent =
          next.status || "Ready";
      }

      if (playerArtist) {
        playerArtist.textContent = artist;
      }

      if (playerTrack) {
        playerTrack.textContent = track;
      }

      if (playerStation) {
        playerStation.textContent = station;
      }

      if (playerMeta) {
        playerMeta.textContent =
          next.meta ||
          runtime.currentStreamUrl ||
          "No active stream.";
      }

      if (playerLiveStatus) {
        playerLiveStatus.textContent =
          next.status || "Waiting";
      }

      if (playerSource) {
        playerSource.textContent =
          metadata.metadataSource === "live"
            ? "Live metadata"
            : "Radio stream";
      }

      if (playerStreamUrl) {
        playerStreamUrl.textContent =
          runtime.currentStreamUrl ||
          "No stream selected";
      }

      if (playerArt) {
        if (artwork) {
          playerArt.innerHTML = `
        <img
          src="${artwork}"
          alt="${track}"
          loading="eager"
          onerror="this.parentElement.innerHTML =
            '<div class=&quot;art-placeholder&quot;><span>♫</span><small>Live Radio</small></div>'"
        />
      `;
          playerArt.classList.add("has-artwork");
        } else {
          playerArt.innerHTML = `
        <div class="art-placeholder">
          <span>♫</span>
          <small>Live Radio</small>
        </div>
      `;
          playerArt.classList.remove("has-artwork");
        }
      }

      const isPlaying =
        next.status === "Playing" ||
        runtime.playing;

      const playerCard =
        document.querySelector(".player-card");

      if (playerCard) {
        playerCard.classList.toggle("is-playing", isPlaying);
      }
    }

    function updateBrowserTitle(metadata = null) {
      const artist =
        metadata?.artist ||
        runtime.metadata?.artist ||
        "";

      const track =
        metadata?.track ||
        runtime.metadata?.track ||
        metadata?.nowPlaying ||
        runtime.currentTitle ||
        "";

      const station =
        metadata?.stationName ||
        runtime.metadata?.stationName ||
        "RadioOn";

      if (artist && track) {
        document.title = `${artist} — ${track}`;
        return;
      }

      if (track) {
        document.title = `${track} — ${station}`;
        return;
      }

      document.title = station || "RadioOn";
    }

    function setState(value) {
      if (!stateNode) {
        return;
      }

      stateNode.textContent = JSON.stringify(value, null, 2);
    }

    function renderRuntime(extra) {
      setState({
        apiBase: runtime.apiBase,
        hostContext: runtime.hostContext,
        stationCount: runtime.stations.length,
        currentStreamUrl: runtime.currentStreamUrl,
        currentTitle: runtime.currentTitle,
        ...extra
      });
    }

    function renderStations() {
      if (!stationsRoot) {
        return;
      }

      if (!Array.isArray(runtime.stations) || runtime.stations.length === 0) {
        stationsRoot.innerHTML = '<p class="muted">No cached stations available yet. Use a custom M3U URL above.</p>';
        return;
      }

      stationsRoot.innerHTML = runtime.stations
        .map(
          (station, index) => `
              <article class="station">
                <strong>${typeof station === "string" ? station : station.name || `Station ${index + 1}`}</strong>
                <p class="muted">${typeof station === "string" ? "Preset from RadioOn backend cache" : station.playlistUrl || "Saved station"}</p>
                ${typeof station === "string" ? "" : `<div class="row" style="margin-top: 10px;"><button type="button" class="secondary" data-play-station="${index}">Play</button></div>`}
              </article>
            `
        )
        .join("");

      stationsRoot.querySelectorAll("[data-play-station]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-play-station"));
          const station = runtime.stations[index];

          if (!station || typeof station === "string") {
            return;
          }

          if (streamTitleInput) {
            streamTitleInput.value = station.name || "Saved station";
          }

          if (streamUrlInput) {
            streamUrlInput.value = station.playlistUrl || station.streamUrl || "";
          }

          void playCustomStream().catch((error) => {
            setBadge("error");
            window.parent.postMessage(
              {
                type: "teckdato:plugin-error",
                payload: error instanceof Error ? error.message : String(error)
              },
              "*"
            );
          });
        });
      });
    }

    async function request(path, init) {
      const response = await fetch(`${runtime.apiBase}${path}`, {
        headers: {
          "Content-Type": "application/json"
        },
        ...init
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;

      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : `Request failed (${response.status})`);
      }

      return payload;
    }

    async function refreshStations() {
      setBadge("loading stations");
      const payload = await request("/radio");
      runtime.stations = Array.isArray(payload.stations) ? payload.stations : [];
      renderStations();
      renderRuntime({ lastRefresh: payload.refreshedAt ?? null });
      setPlayerView({ label: "Stations loaded", title: runtime.currentTitle || "RadioOn Player", status: "Ready", meta: runtime.currentStreamUrl ? `Streaming via ${runtime.currentStreamUrl}` : "Use the form above to play a stream.", art: runtime.currentTitle || "Live Radio" });
      setBadge("ready");
    }

    async function resolveStreamUrl(rawUrl) {
      const payload = await request("/radio/resolve-stream", {
        method: "POST",
        body: JSON.stringify({ url: rawUrl })
      });

      return payload.streamUrl;
    }

    async function playCustomStream() {
      const rawUrl = streamUrlInput && streamUrlInput.value ? streamUrlInput.value.trim() : "";
      const title = streamTitleInput && streamTitleInput.value ? streamTitleInput.value.trim() : "Custom radio";

      if (!rawUrl) {
        throw new Error("Enter an M3U URL or direct stream URL first.");
      }

      setBadge("resolving");
      const streamUrl = await resolveStreamUrl(rawUrl);
      runtime.currentStreamUrl = streamUrl;
      runtime.currentTitle = title;
      renderRuntime({ lastResolvedUrl: streamUrl });

      playerAudio.src = streamUrl;
      playerAudio.load();
      await playerAudio.play();
      runtime.playing = true;

      window.parent.postMessage(
        {
          type: "teckdato:radio-play-request",
          payload: {
            pluginId: "radioon",
            title,
            streamUrl
          }
        },
        "*"
      );

      setPlayerView({ label: "Now playing", title, status: "Playing", meta: streamUrl, art: title });
      startMetadataPolling(streamUrl, title);

      setBadge("playing");
    }

    async function fetchMetadata(streamUrl, fallbackTitle) {
      const payload = await request("/radio/metadata", {
        method: "POST",
        body: JSON.stringify({
          url: streamUrl,
          fallbackTitle
        })
      });

      return payload;
    }

    function stopMetadataPolling() {
      if (runtime.metadataPollId) {
        clearInterval(runtime.metadataPollId);
        runtime.metadataPollId = null;
      }
    }

    function startMetadataPolling(streamUrl, fallbackTitle) {
      stopMetadataPolling();

      const pollOnce = async () => {
        try {
          const metadata = await fetchMetadata(streamUrl, fallbackTitle);
          runtime.metadata = metadata;
          updateBrowserTitle(metadata);

          const signature = JSON.stringify({
            nowPlaying: metadata.nowPlaying || null,
            artist: metadata.artist || null,
            track: metadata.track || null,
            artworkUrl: metadata.artworkUrl || null,
            streamUrl
          });

          if (metadata && metadata.nowPlaying) {
            runtime.currentTitle = metadata.nowPlaying;
          }

          if (signature !== runtime.lastMetadataSignature) {
            runtime.lastMetadataSignature = signature;
            window.parent.postMessage(
              {
                type: "teckdato:radio-metadata-update",
                payload: {
                  pluginId: "radioon",
                  streamUrl,
                  title: metadata.nowPlaying,
                  artist: metadata.artist || null,
                  track: metadata.track || null,
                  stationName: metadata.stationName || null,
                  artworkUrl: metadata.artworkUrl || null
                }
              },
              "*"
            );
          }

          renderRuntime({
            metadata,
            lastMetadataRefresh: new Date().toISOString()
          });
          setPlayerView({
            label: metadata.metadataAvailable
              ? "Now playing"
              : "Metadata unavailable",

            title:
              metadata.stationName ||
              "RadioOn",

            status:
              runtime.playing
                ? "Playing"
                : "Paused",

            meta:
              metadata.streamUrl ||
              streamUrl,

            artist:
              metadata.artist ||
              "Unknown Artist",

            track:
              metadata.track ||
              metadata.nowPlaying ||
              fallbackTitle,

            stationName:
              metadata.stationName ||
              "RadioOn",

            artworkUrl:
              metadata.artworkUrl ||
              ""
          });
        } catch (error) {
          renderRuntime({
            metadataError: error instanceof Error ? error.message : String(error),
            lastMetadataRefresh: new Date().toISOString()
          });
        }
      };

      void pollOnce();
      runtime.metadataPollId = setInterval(() => {
        void pollOnce();
      }, 20000);
    }

    async function saveCurrentStation() {
      const rawUrl = streamUrlInput && streamUrlInput.value ? streamUrlInput.value.trim() : "";
      const title = streamTitleInput && streamTitleInput.value ? streamTitleInput.value.trim() : "Custom radio";

      if (!rawUrl) {
        throw new Error("Enter an M3U URL or direct stream URL first.");
      }

      setBadge("saving");
      const payload = await request("/radio/stations", {
        method: "POST",
        body: JSON.stringify({
          name: title,
          playlistUrl: rawUrl,
          streamUrl: runtime.currentStreamUrl || undefined
        })
      });

      renderRuntime({ savedStation: payload.station ?? null });
      await refreshStations();
      setBadge("saved");
    }

    function stopPlayback() {
      stopMetadataPolling();
      runtime.playing = false;
      runtime.currentStreamUrl = "";
      runtime.currentTitle = "";
      runtime.metadata = null;
      playerAudio.pause();
      playerAudio.removeAttribute("src");
      playerAudio.load();
      renderRuntime({ stoppedAt: new Date().toISOString() });
      setPlayerView({ label: "Playback stopped", title: "RadioOn Player", status: "Stopped", meta: "The stream was stopped.", art: "Live Radio" });
      window.parent.postMessage(
        {
          type: "teckdato:radio-stop-request",
          payload: {
            pluginId: "radioon"
          }
        },
        "*"
      );
      setBadge("stopped");
    }

    window.parent.postMessage(
      {
        type: "teckdato:plugin-ready",
        payload: {
          pluginId: "radioon",
          version: "1.0.0"
        }
      },
      "*"
    );

    window.addEventListener("message", (event) => {
      const message = event.data;

      if (!message || !message.type) {
        return;
      }

      if (message.type === "teckdato:host-context") {
        runtime.hostContext = message.payload || null;
        if (runtime.hostContext && runtime.hostContext.apiBase) {
          runtime.apiBase = runtime.hostContext.apiBase;
        }
        if (runtime.hostContext && runtime.hostContext.radioPlayer) {
          runtime.currentStreamUrl = runtime.hostContext.radioPlayer.streamUrl || "";
          runtime.currentTitle = runtime.hostContext.radioPlayer.title || "";

          if (runtime.currentStreamUrl) {
            setPlayerView({ label: runtime.hostContext.radioPlayer.playing ? "Restored from host" : "Host context received", title: runtime.currentTitle || "RadioOn Player", status: runtime.hostContext.radioPlayer.playing ? "Playing" : "Paused", meta: runtime.currentStreamUrl, art: runtime.currentTitle || "Live Radio" });
            if (runtime.hostContext.radioPlayer.playing) {
              playerAudio.src = runtime.currentStreamUrl;
              playerAudio.load();
              void playerAudio.play().catch(() => {
                runtime.playing = false;
                setPlayerView({ label: "Playback blocked", title: runtime.currentTitle || "RadioOn Player", status: "Paused", meta: runtime.currentStreamUrl, art: runtime.currentTitle || "Live Radio" });
              });
            }
            startMetadataPolling(runtime.currentStreamUrl, runtime.currentTitle || "Radio stream");
          }
        }
        renderRuntime({
          lastMessage: message.type,
          context: message.payload
        });
        void refreshStations().catch((error) => {
          setBadge("error");
          window.parent.postMessage(
            {
              type: "teckdato:plugin-error",
              payload: error instanceof Error ? error.message : String(error)
            },
            "*"
          );
        });
        return;
      }

      if (message.type === "teckdato:host-health-request") {
        window.parent.postMessage(
          {
            type: "teckdato:plugin-health",
            payload: {
              status: "ok",
              timestamp: new Date().toISOString(),
              pluginId: "radioon",
              currentStreamUrl: runtime.currentStreamUrl
            }
          },
          "*"
        );
        return;
      }

      if (message.type === "teckdato:host-unmount") {
        stopMetadataPolling();
        renderRuntime({
          lastMessage: message.type,
          payload: message.payload
        });
      }
    });

    playCustomButton && playCustomButton.addEventListener("click", () => {
      void playCustomStream().catch((error) => {
        setBadge("error");
        window.parent.postMessage(
          {
            type: "teckdato:plugin-error",
            payload: error instanceof Error ? error.message : String(error)
          },
          "*"
        );
      });
    });

    stopCustomButton && stopCustomButton.addEventListener("click", stopPlayback);
    const saveStationButton = document.createElement("button");
    saveStationButton.type = "button";
    saveStationButton.className = "secondary";
    saveStationButton.textContent = "Save Station";
    playCustomButton && playCustomButton.parentElement && playCustomButton.parentElement.appendChild(saveStationButton);
    saveStationButton.addEventListener("click", () => {
      void saveCurrentStation().catch((error) => {
        setBadge("error");
        window.parent.postMessage(
          {
            type: "teckdato:plugin-error",
            payload: error instanceof Error ? error.message : String(error)
          },
          "*"
        );
      });
    });
    playerPlayButton && playerPlayButton.addEventListener("click", () => {
      void playCustomStream().catch((error) => {
        setBadge("error");
        window.parent.postMessage(
          {
            type: "teckdato:plugin-error",
            payload: error instanceof Error ? error.message : String(error)
          },
          "*"
        );
      });
    });

    playerStopButton && playerStopButton.addEventListener("click", stopPlayback);
    playerPopoutButton && playerPopoutButton.addEventListener("click", () => {
      window.parent.postMessage(
        {
          type: "teckdato:radio-play-request",
          payload: {
            pluginId: "radioon",
            title: runtime.currentTitle || streamTitleInput?.value?.trim() || "RadioOn Player",
            streamUrl: runtime.currentStreamUrl || streamUrlInput?.value?.trim() || ""
          }
        },
        "*"
      );
    });

    refreshStationsButton && refreshStationsButton.addEventListener("click", () => {
      void refreshStations().catch((error) => {
        setBadge("error");
        window.parent.postMessage(
          {
            type: "teckdato:plugin-error",
            payload: error instanceof Error ? error.message : String(error)
          },
          "*"
        );
      });
    });

    void refreshStations().catch((error) => {
      setBadge("error");
      window.parent.postMessage(
        {
          type: "teckdato:plugin-error",
          payload: error instanceof Error ? error.message : String(error)
        },
        "*"
      );
    });

    setPlayerView({ label: "Booted", title: "RadioOn Player", status: "Ready", meta: "Waiting for a stream.", art: "Live Radio" });
    renderRuntime({ bootedAt: new Date().toISOString() });
    renderStations();