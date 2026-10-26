"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { MainComposition } from "@/remotion/MainComposition";
import {
  REEL_TYPES,
  type AudioResult,
  type Clip,
  type ReelClip,
  type ReelProps,
  type ReelType,
} from "@/lib/types";
import { buildReelProps, selectClipsForTarget, totalDuration } from "@/lib/props";

const DEFAULT_PROMPTS: Record<ReelType, string> = {
  highlights: "Upbeat, high-energy trap beat for basketball highlights, 120 BPM",
  bloopers: "Comical, goofy tuba and pizzicato strings for sports mistakes",
};

type StudioTab = "games" | "live" | "clips" | "mvp" | "exports";

const NAV_ITEMS: Array<[StudioTab, string]> = [
  ["games", "1. Games & Source"],
  ["live", "2. Live Monitor"],
  ["clips", "3. Clip Library"],
  ["mvp", "4. MVP Candidates"],
  ["exports", "5. Production & Exports"],
];

type StreamValidationResult = {
  valid_input: boolean;
  input_type: string;
  facebook_video_url?: string | null;
  embed_player_url?: string | null;
  direct_media_url?: string | null;
  preview_available: boolean;
  can_record_and_process: boolean;
  access_status: string;
  status_message: string;
};

type DetectedEvent = {
  event_id: string;
  possession_id: string;
  period_or_quarter: string;
  game_clock: string;
  video_timestamp_start: string;
  video_timestamp_end: string;
  clip_start_padded: string;
  clip_end_padded: string;
  clip_duration_sec: number;
  team_in_possession: string;
  event_category: string;
  event_type: string;
  event_subtype: string;
  primary_player: string;
  secondary_player: string;
  points_scored: number;
  highlight_score: number;
  confidence: number;
  verification_status: "VERIFIED" | "UNCERTAIN_REVIEW_REQUIRED";
  clip_state: string;
  overlay_label: string;
  speed_ramp_profile: string;
  output_clip_filename: string;
  notes: string;
};

type MvpCandidate = {
  rank: number;
  player_tracking_id: string;
  team: string;
  jersey_number: string;
  identity_verified: boolean;
  performance_score: number;
  highlight_score: number;
  confirmed_points: number;
  confirmed_fg_made: number;
  confirmed_3pt_made: number;
  confirmed_assists: number;
  confirmed_blocks: number;
  confirmed_steals: number;
  clutch_plays: number;
  evidence_event_ids: string[];
  evidence_clips: string[];
  status_label: string;
  candidate_reel_filename: string;
};

type ManifestBundle = {
  manifest: {
    metadata: {
      game_id: string;
      source_video: string;
      stream_status: string;
      resolution: string;
      fps: number;
      home_team: string;
      away_team: string;
      final_score_home: string;
      final_score_away: string;
      opening_title: string;
    };
    events: DetectedEvent[];
  } | null;
  editDecisionList: Array<{
    order: number;
    story_phase: string;
    event_id: string;
    clip_filename: string;
    start_ts: string;
    end_ts: string;
    duration_sec: number;
    text_overlay: string;
    transition_in: string;
    speed_ramp: string;
    audio_mix: string;
  }> | null;
  mvpReport: {
    game_id: string;
    policy_note: string;
    candidates: MvpCandidate[];
  } | null;
  qualityReport: {
    rendered_video: boolean;
    source_inspected: boolean;
    checks_passed: Record<string, boolean>;
    acceptance_gates_status: Record<string, string>;
    uncertain_detections: string[];
    processing_limitations: string[];
  } | null;
  recordingSegments: Array<{
    segment_index: number;
    start_timestamp: string;
    end_timestamp: string;
    file_location: string;
    integrity_status: string;
  }>;
};

export default function BasketballAiStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>("games");

  // Stream & Facebook validation state (Screen 1 & 2)
  const [rawInput, setRawInput] = useState(
    '<iframe src="https://www.facebook.com/plugins/video.php?height=476&href=https%3A%2F%2Fwww.facebook.com%2F61586762700422%2Fvideos%2F1743500926740597%2F&show_text=false&width=267&t=0" width="267" height="476" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>'
  );
  const [directFeed, setDirectFeed] = useState("");
  const [streamValidation, setStreamValidation] = useState<StreamValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  // Intelligence manifest bundle (Screens 3, 4, 5)
  const [bundle, setBundle] = useState<ManifestBundle | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("ALL");
  const [editingPlayerMap, setEditingPlayerMap] = useState<Record<string, string>>({});

  // Remotion Reel Builder state (Screen 5)
  const [clips, setClips] = useState<Clip[]>([]);
  const [reelType, setReelType] = useState<ReelType>("highlights");
  const [selected, setSelected] = useState<ReelClip[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<{ text: string; kind: "" | "ok" | "err" }>({
    text: "",
    kind: "",
  });
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<PlayerRef | null>(null);

  // GitHub App User-to-Server Auth state (acting on behalf of alfredkeybusiness-eng / Chubby Genius, App ID: 5173239)
  const [ghClientId, setGhClientId] = useState("Iv23liAMEZjD4rPtZhe5");
  const [ghUserToken, setGhUserToken] = useState("");
  const [ghDeviceInfo, setGhDeviceInfo] = useState<{
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
  } | null>(null);
  const [ghStatus, setGhStatus] = useState<{ text: string; kind: "" | "ok" | "err" }>({
    text: "",
    kind: "",
  });

  const loadStudioData = useCallback(() => {
    fetch("/api/clips")
      .then((r) => r.json())
      .then((d: { clips: Clip[] }) => setClips(d.clips))
      .catch(() => setClips([]));

    fetch("/api/basketball-manifest")
      .then((r) => r.json())
      .then((d: ManifestBundle) => setBundle(d))
      .catch(() => setBundle(null));
  }, []);

  useEffect(() => {
    loadStudioData();
  }, [loadStudioData]);

  const validateLivestreamSource = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/stream-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput,
          authorizedMediaFeed: directFeed,
          operatorAuthorized: true,
        }),
      });
      const data = (await res.json()) as StreamValidationResult;
      setStreamValidation(data);
    } finally {
      setValidating(false);
    }
  };

  const updateEventField = async (
    eventId: string,
    patch: { primaryPlayer?: string; verificationStatus?: "VERIFIED" | "UNCERTAIN_REVIEW_REQUIRED" }
  ) => {
    const res = await fetch("/api/basketball-manifest", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, ...patch }),
    });
    if (res.ok) {
      loadStudioData();
    }
  };

  const categoryClips = useMemo(
    () => clips.filter((c) => c.category === reelType),
    [clips, reelType]
  );

  const props: ReelProps = useMemo(
    () => buildReelProps({ clips: selected, audioTrack: audioUrl }),
    [selected, audioUrl]
  );

  const reshuffle = useCallback(() => {
    const pool: ReelClip[] = categoryClips.map((c) => ({
      src: c.url,
      objectFit: "cover",
      volume: 1,
      effects: [],
    }));
    setSelected(selectClipsForTarget(pool));
  }, [categoryClips]);

  useEffect(() => {
    reshuffle();
  }, [reshuffle]);

  const generateAudio = async () => {
    setBusy(true);
    setAudioStatus({ text: "Generating audio…", kind: "" });
    try {
      const res = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: DEFAULT_PROMPTS[reelType],
          filename: `${reelType}_${Date.now()}`,
        }),
      });
      const data = (await res.json()) as AudioResult;
      if (data.url) {
        setAudioUrl(data.url);
        setAudioStatus({
          text: data.fallback
            ? `Mureka unavailable (${data.error}) — using fallback track`
            : "Mureka track ready",
          kind: data.fallback ? "err" : "ok",
        });
      } else {
        setAudioStatus({ text: `Audio failed: ${data.error ?? "unknown error"}`, kind: "err" });
      }
    } catch (e) {
      setAudioStatus({
        text: `Audio failed: ${e instanceof Error ? e.message : String(e)}`,
        kind: "err",
      });
    } finally {
      setBusy(false);
    }
  };

  const downloadProps = () => {
    const blob = new Blob([JSON.stringify(props, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reel_props.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const duration = totalDuration(props);
  const events = bundle?.manifest?.events ?? [];
  const filteredEvents = useMemo(() => {
    if (eventFilter === "ALL") return events;
    if (eventFilter === "REVIEW") {
      return events.filter((e) => e.verification_status === "UNCERTAIN_REVIEW_REQUIRED");
    }
    return events.filter((e) => e.event_category === eventFilter);
  }, [events, eventFilter]);

  const isActuallyRecording =
    Boolean(streamValidation?.can_record_and_process) &&
    (bundle?.recordingSegments?.length ?? 0) > 0;

  return (
    <div className="studio-shell">
      {/* Large-Screen Navigation Rail (>900px) per flutter-build-responsive-layout */}
      <aside className="studio-rail" aria-label="Primary Studio Navigation">
        <div className="brand">
          <h1>Basketball AI Studio</h1>
          <p>Live Clipper &amp; MVP Agent</p>
        </div>
        {NAV_ITEMS.map(([tabKey, label]) => (
          <button
            key={tabKey}
            className={`rail-btn ${activeTab === tabKey ? "active" : ""}`}
            onClick={() => setActiveTab(tabKey)}
          >
            {label}
          </button>
        ))}
      </aside>

      {/* Center + ConstrainedBox (maxWidth: 1200px) Content Area */}
      <div className="studio-content-wrapper">
        <div className="studio-constrained">
          {/* Small-Screen Compact Navigation Bar (<=900px) */}
          <nav className="mobile-nav" aria-label="Compact Studio Navigation">
            {NAV_ITEMS.map(([tabKey, label]) => (
              <button
                key={tabKey}
                className={activeTab === tabKey ? "primary" : ""}
                onClick={() => setActiveTab(tabKey)}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Header & OPS-01 Live Status Bar */}
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}
          >
            <div>
              <h1>Basketball AI Studio — Live Clipper &amp; MVP Agent</h1>
              <p className="sub" style={{ marginBottom: 6 }}>
                Decoupled Continuous Recording • Real-Time Event Clipping • Dual-Score MVP Tracking •
                9:16 Auto-Editor
              </p>
            </div>

            <div className="row">
              <span
                className={`chip ${
                  isActuallyRecording
                    ? "err"
                    : streamValidation?.preview_available
                    ? "warn"
                    : ""
                }`}
              >
                <span className="dot" />
                {isActuallyRecording
                  ? "LIVE — Recording Segments"
                  : streamValidation?.preview_available
                  ? "Preview Only"
                  : "Standby"}
              </span>
              <span className="chip ok">
                <span className="dot" />
                {events.length} Detected Plays
              </span>
              <span className="chip">
                <span className="dot" />
                {bundle?.mvpReport?.candidates?.length ?? 0} MVP Candidates
              </span>
            </div>
          </div>

          {/* SCREEN 1: GAMES & FACEBOOK LIVE SOURCE GATEWAY */}
          {activeTab === "games" && (
            <div className="adaptive-grid">
              <div className="panel">
                <h2>New Livestream Source (Phase 0 / FB-01..FB-04)</h2>
                <div className="field">
                  <label htmlFor="fbInput">
                    Paste Facebook Live URL or Facebook &lt;iframe&gt; embed code
                  </label>
                  <input
                    id="fbInput"
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    placeholder="https://www.facebook.com/... or <iframe src=...>"
                  />
                </div>

                <div className="field">
                  <label htmlFor="directFeedInput">
                    Authorized Direct Media Feed (Optional HLS .m3u8, RTMP, or local MP4 path)
                  </label>
                  <input
                    id="directFeedInput"
                    value={directFeed}
                    onChange={(e) => setDirectFeed(e.target.value)}
                    placeholder="Auto-resolved for public broadcasts or enter path/URL"
                  />
                </div>

                <div className="row">
                  <button
                    className="primary"
                    onClick={validateLivestreamSource}
                    disabled={validating}
                  >
                    {validating ? "Verifying Access…" : "Verify Media Access"}
                  </button>
                  <button
                    onClick={() => {
                      setDirectFeed("basketball_output/recording_segments/seg_00000.mp4");
                    }}
                  >
                    Use Captured Segment (seg_00000.mp4)
                  </button>
                </div>

                {streamValidation && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--panel-alt)",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Status: {streamValidation.access_status}
                    </div>
                    <div
                      className={`status ${
                        streamValidation.can_record_and_process
                          ? "ok"
                          : streamValidation.valid_input
                          ? ""
                          : "err"
                      }`}
                      style={{ marginTop: 0 }}
                    >
                      {streamValidation.status_message}
                    </div>
                  </div>
                )}
              </div>

              <div className="panel">
                <h2>Active Game Session</h2>
                {bundle?.manifest ? (
                  <div>
                    <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
                      {bundle.manifest.metadata.opening_title}
                    </p>
                    <p className="sub" style={{ marginBottom: 12 }}>
                      Game ID: <code>{bundle.manifest.metadata.game_id}</code> • Status:{" "}
                      <code>{bundle.manifest.metadata.stream_status}</code> • Score:{" "}
                      <strong>
                        {bundle.manifest.metadata.final_score_home} -{" "}
                        {bundle.manifest.metadata.final_score_away}
                      </strong>
                    </p>
                    <ul className="list">
                      <li>
                        <span className="name">Source Resolution / FPS</span>
                        <span>
                          {bundle.manifest.metadata.resolution} @ {bundle.manifest.metadata.fps} fps
                        </span>
                      </li>
                      <li>
                        <span className="name">Continuous Recorder</span>
                        <span>Isolated OS Process (Survives AI Failure)</span>
                      </li>
                      <li>
                        <span className="name">Recovered Recording Segments</span>
                        <span>{bundle.recordingSegments?.length ?? 0} segments</span>
                      </li>
                      <li>
                        <span className="name">Quality Control Gates</span>
                        <span>
                          {
                            Object.values(
                              bundle.qualityReport?.acceptance_gates_status ?? {}
                            ).filter((v) => v.startsWith("PASSED") || v.startsWith("READY")).length
                          }{" "}
                          / 22 Ready
                        </span>
                      </li>
                    </ul>
                  </div>
                ) : (
                  <p className="sub">No game manifest loaded yet.</p>
                )}
              </div>
            </div>
          )}

          {/* SCREEN 2: LIVE MONITOR */}
          {activeTab === "live" && (
            <div className="adaptive-grid">
              <div className="panel">
                <h2>Recorder &amp; Queue Health (REC-01..REC-04)</h2>
                <ul className="list">
                  <li>
                    <span className="name">Stream Connection</span>
                    <span>
                      {streamValidation?.can_record_and_process
                        ? "Authorized Direct Feed"
                        : streamValidation?.preview_available
                        ? "Preview Available — Processing Unavailable"
                        : "Standby"}
                    </span>
                  </li>
                  <li>
                    <span className="name">Segment Duration / Rolling Buffer</span>
                    <span>4.0s segments / 20s buffer (±5s event padding)</span>
                  </li>
                  <li>
                    <span className="name">AI Analyzer Isolation (REC-03)</span>
                    <span>Decoupled Worker</span>
                  </li>
                  <li>
                    <span className="name">Duplicate Window Suppression (AI-04)</span>
                    <span>Active (2.5s window)</span>
                  </li>
                </ul>
              </div>

              <div className="panel">
                <h2>Live Stream Preview &amp; Real-Time Event Feed</h2>
                {streamValidation?.embed_player_url ? (
                  <div style={{ marginBottom: 12 }}>
                    <iframe
                      title="Facebook Live Embedded Preview"
                      src={streamValidation.embed_player_url}
                      width="100%"
                      height="320"
                      style={{ border: "1px solid var(--border)", borderRadius: 8 }}
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <pre style={{ marginBottom: 12 }}>
                    Click &quot;Verify Media Access&quot; on Screen 1 to preview the Facebook Live player.
                  </pre>
                )}

                <h2>Live Detected Play Feed</h2>
                <ul className="list">
                  {events.map((ev) => (
                    <li key={ev.event_id}>
                      <span className="name">
                        <strong>
                          {ev.period_or_quarter} {ev.game_clock}
                        </strong>{" "}
                        — {ev.event_type} ({ev.primary_player}) [{ev.overlay_label}]
                      </span>
                      <span>
                        Score: {ev.highlight_score} • {ev.clip_state}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* SCREEN 3: CLIP LIBRARY & OPERATOR REVIEW QUEUE */}
          {activeTab === "clips" && (
            <div className="panel">
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ margin: 0 }}>
                  Clip Library &amp; Operator Verification (AI-05 / Phase 6)
                </h2>
                <div className="row">
                  {["ALL", "OFFENSE", "DEFENSE", "SPECIAL", "REVIEW"].map((f) => (
                    <button
                      key={f}
                      className={eventFilter === f ? "primary" : ""}
                      onClick={() => setEventFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card-grid">
                {filteredEvents.map((ev) => (
                  <div
                    key={ev.event_id}
                    className="panel"
                    style={{ background: "var(--panel-alt)", padding: 14 }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                      <strong>
                        {ev.event_id} • {ev.period_or_quarter} ({ev.game_clock})
                      </strong>
                      <span className="chip ok">Score: {ev.highlight_score}/100</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                      {ev.event_type} — {ev.event_subtype}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                      Window: <code>{ev.clip_start_padded}</code> →{" "}
                      <code>{ev.clip_end_padded}</code> ({ev.clip_duration_sec}s) • Conf:{" "}
                      {(ev.confidence * 100).toFixed(0)}% • State: <code>{ev.clip_state}</code>
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 10 }}>
                      Player: <code>{ev.primary_player}</code> • Status:{" "}
                      <strong>{ev.verification_status}</strong>
                    </div>

                    <div className="row">
                      <input
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          color: "var(--text)",
                          padding: "6px 10px",
                          fontSize: 12,
                          flex: 1,
                        }}
                        placeholder={ev.primary_player}
                        value={editingPlayerMap[ev.event_id] ?? ""}
                        onChange={(e) =>
                          setEditingPlayerMap((prev) => ({
                            ...prev,
                            [ev.event_id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        onClick={() => {
                          const newPlayer = (editingPlayerMap[ev.event_id] ?? "").trim();
                          if (newPlayer) {
                            updateEventField(ev.event_id, {
                              primaryPlayer: newPlayer,
                              verificationStatus: "VERIFIED",
                            });
                          } else {
                            updateEventField(ev.event_id, { verificationStatus: "VERIFIED" });
                          }
                        }}
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 4: MVP CANDIDATES (DUAL-SCORE LEADERBOARD) */}
          {activeTab === "mvp" && (
            <div className="panel">
              <h2>
                Provisional MVP Candidates — Dual-Score Leaderboard (Phase 5 / MVP-01 &amp; MVP-02)
              </h2>
              <p className="sub" style={{ marginBottom: 16 }}>
                {bundle?.mvpReport?.policy_note ??
                  "Performance Score (verified basketball contributions) and Highlight Score (visual excitement) are evaluated separately."}
              </p>

              <div className="card-grid">
                {(bundle?.mvpReport?.candidates ?? []).map((cand) => (
                  <div
                    key={cand.player_tracking_id}
                    className="panel"
                    style={{ background: "var(--panel-alt)", padding: 16 }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                      <strong style={{ fontSize: 16 }}>
                        Rank #{cand.rank} — {cand.player_tracking_id} ({cand.team})
                      </strong>
                      <span className="chip ok">Perf: {cand.performance_score}</span>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      Highlight Score: <strong>{cand.highlight_score}</strong> •{" "}
                      <strong>{cand.confirmed_points} PTS</strong> ({cand.confirmed_3pt_made} 3PM) •{" "}
                      <strong>{cand.confirmed_assists} AST</strong> •{" "}
                      <strong>{cand.confirmed_blocks} BLK</strong> •{" "}
                      <strong>{cand.confirmed_steals} STL</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                      Evidence Events: <code>{cand.evidence_event_ids.join(", ")}</code>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Target Reel: <code>{cand.candidate_reel_filename}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 5: PRODUCTION & EXPORTS */}
          {activeTab === "exports" && (
            <div className="adaptive-grid">
              <div className="panel">
                <h2>Post-Game Production &amp; Remotion 9:16 Builder</h2>
                <div className="field">
                  <label htmlFor="reelType">Reel type</label>
                  <select
                    id="reelType"
                    value={reelType}
                    onChange={(e) => setReelType(e.target.value as ReelType)}
                  >
                    {REEL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row">
                  <button onClick={reshuffle} disabled={categoryClips.length === 0}>
                    Shuffle clips
                  </button>
                  <button className="primary" onClick={generateAudio} disabled={busy}>
                    {busy ? "Working…" : "Generate Mureka Audio"}
                  </button>
                  <button onClick={downloadProps}>Export EDL / Props</button>
                </div>

                <div className={`status ${audioStatus.kind}`}>{audioStatus.text}</div>

                <h2 style={{ marginTop: 16 }}>
                  Phase 12 Deliverable Package ({bundle?.manifest?.metadata.game_id ?? "GAME_001"}/)
                </h2>
                <ul className="list">
                  <li>
                    <span className="name">Full_Game_Highlights.mp4</span>
                    <span>3–8 min target (16:9)</span>
                  </li>
                  <li>
                    <span className="name">Top_Plays.mp4</span>
                    <span>30–90s target (9:16 Blurred BG)</span>
                  </li>
                  <li>
                    <span className="name">MVP_Candidate_1..3.mp4</span>
                    <span>45–120s per candidate</span>
                  </li>
                  <li>
                    <span className="name">Event_Log.csv &amp; MVP_Candidate_Report.json</span>
                    <span>
                      Ready in basketball_output/{bundle?.manifest?.metadata.game_id ?? "GAME_001"}/
                    </span>
                  </li>
                </ul>

                <h2 style={{ marginTop: 18 }}>
                  GitHub App User-to-Server Actions (App ID: 5173239 · @alfredkeybusiness-eng)
                </h2>
                <div className="field">
                  <label htmlFor="ghClientId">
                    GitHub App Client ID (Default: <code>Iv23liAMEZjD4rPtZhe5</code>)
                  </label>
                  <input
                    id="ghClientId"
                    value={ghClientId}
                    onChange={(e) => setGhClientId(e.target.value)}
                    placeholder="Iv23liAMEZjD4rPtZhe5"
                  />
                </div>
                <div className="field">
                  <label htmlFor="ghUserToken">
                    User Access Token (<code>ghu_...</code> / OAuth token acting on your behalf)
                  </label>
                  <input
                    id="ghUserToken"
                    type="password"
                    value={ghUserToken}
                    onChange={(e) => setGhUserToken(e.target.value)}
                    placeholder="ghu_..."
                  />
                </div>
                <div className="row">
                  <button
                    onClick={async () => {
                      setGhStatus({ text: "Starting GitHub App Device Flow…", kind: "" });
                      const res = await fetch("/api/github-app", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "start_device_flow",
                          clientId: ghClientId,
                        }),
                      });
                      const d = await res.json();
                      if (d.user_code) {
                        setGhDeviceInfo(d);
                        setGhStatus({
                          text: `Open ${d.verification_uri} and enter code: ${d.user_code}`,
                          kind: "ok",
                        });
                      } else {
                        setGhStatus({
                          text: d.error || d.error_description || "Failed to start device flow",
                          kind: "err",
                        });
                      }
                    }}
                  >
                    1. Authorize App (Device Flow)
                  </button>
                  {ghDeviceInfo?.device_code && (
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/github-app", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "poll_device_token",
                            clientId: ghClientId,
                            deviceCode: ghDeviceInfo.device_code,
                          }),
                        });
                        const d = await res.json();
                        if (d.access_token) {
                          setGhUserToken(d.access_token);
                          setGhStatus({
                            text: "Received user-to-server token (ghu_...)!",
                            kind: "ok",
                          });
                        } else {
                          setGhStatus({
                            text: d.error_description || d.error || "Waiting for authorization…",
                            kind: "err",
                          });
                        }
                      }}
                    >
                      Poll Token
                    </button>
                  )}
                  <button
                    className="primary"
                    onClick={async () => {
                      setGhStatus({
                        text: "Posting MVP & Game Report Issue on behalf of user…",
                        kind: "",
                      });
                      const res = await fetch("/api/github-app", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "act_on_behalf",
                          userAccessToken: ghUserToken,
                          operation: "create_issue",
                          owner: "alfredkeybusiness-eng",
                          repo: "vidops",
                        }),
                      });
                      const d = await res.json();
                      if (d.ok && d.issue?.html_url) {
                        setGhStatus({
                          text: `Created Issue on behalf of user: ${d.issue.html_url}`,
                          kind: "ok",
                        });
                      } else {
                        setGhStatus({
                          text: d.error || d.issue?.message || "GitHub API call failed",
                          kind: "err",
                        });
                      }
                    }}
                  >
                    Post Game Report Issue (On Behalf)
                  </button>
                  <button
                    onClick={async () => {
                      setGhStatus({
                        text: "Creating Deployment on behalf of user…",
                        kind: "",
                      });
                      const res = await fetch("/api/github-app", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "act_on_behalf",
                          userAccessToken: ghUserToken,
                          operation: "create_deployment",
                          owner: "alfredkeybusiness-eng",
                          repo: "vidops",
                        }),
                      });
                      const d = await res.json();
                      if (d.ok && d.deployment?.id) {
                        setGhStatus({
                          text: `Deployment #${d.deployment.id} created on behalf of @alfredkeybusiness-eng`,
                          kind: "ok",
                        });
                      } else {
                        setGhStatus({
                          text: d.error || d.deployment?.message || "Deployment request failed",
                          kind: "err",
                        });
                      }
                    }}
                  >
                    Trigger Deployment (On Behalf)
                  </button>
                </div>
                <div className={`status ${ghStatus.kind}`}>{ghStatus.text}</div>
              </div>

              <div className="panel">
                <h2>9:16 Vertical Preview — {Math.round(duration)}s @ 1080×1920</h2>
                <div className="player-shell">
                  <Player
                    ref={playerRef}
                    component={MainComposition}
                    inputProps={props}
                    durationInFrames={Math.max(1, Math.ceil(duration * props.fps))}
                    fps={props.fps}
                    compositionWidth={props.resolution.width}
                    compositionHeight={props.resolution.height}
                    style={{ width: "100%", height: "100%" }}
                    controls
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
