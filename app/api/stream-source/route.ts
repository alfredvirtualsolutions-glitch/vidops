import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

const ALLOWED_FACEBOOK_HOSTS = new Set([
  "www.facebook.com",
  "facebook.com",
  "m.facebook.com",
  "fb.watch",
  "web.facebook.com",
]);

const DANGEROUS_PATTERNS = /(<\s*script\b|javascript\s*:|data\s*:\s*text\/html|on\w+\s*=)/i;
const IFRAME_SRC_RE = /<iframe[^>]+src=["']([^"']+)["']/i;

async function probePublicFacebookMedia(fbUrl: string): Promise<{
  resolved_url?: string;
  title?: string;
  uploader?: string;
  duration_sec?: number;
}> {
  try {
    const winPy = path.join(process.cwd(), ".venv", "Scripts", "python.exe");
    const pyBin = process.platform === "win32" ? winPy : "python3";
    const script =
      "import sys, json; from worker.basketball_agent import SourceAccessGateway; print(json.dumps(SourceAccessGateway.probe_facebook_media_stream(sys.argv[1])))";
    const { stdout } = await execFileAsync(pyBin, ["-c", script, fbUrl], {
      cwd: process.cwd(),
      timeout: 15000,
    });
    return JSON.parse(stdout.trim());
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      rawInput?: string;
      authorizedMediaFeed?: string;
      operatorAuthorized?: boolean;
    };

    const text = (body.rawInput ?? "").trim();
    const feed = (body.authorizedMediaFeed ?? "").trim();
    const operatorAuthorized = body.operatorAuthorized ?? true;

    if (!text && !feed) {
      return NextResponse.json({
        valid_input: false,
        input_type: "INVALID",
        access_status: "INVALID_SOURCE",
        preview_available: false,
        can_record_and_process: false,
        status_message: "No livestream URL, iframe embed code, or media source provided.",
      });
    }

    // SEC-01: Reject malicious HTML / script injection
    if (DANGEROUS_PATTERNS.test(text) || DANGEROUS_PATTERNS.test(feed)) {
      return NextResponse.json({
        valid_input: false,
        input_type: "REJECTED_SECURITY",
        access_status: "REJECTED_MALICIOUS_OR_UNAPPROVED",
        preview_available: false,
        can_record_and_process: false,
        status_message: "SEC-01 Violation: Rejected malicious HTML/script or unsafe URI scheme.",
      });
    }

    // SEC-02: Require operator authorization
    if (!operatorAuthorized) {
      return NextResponse.json({
        valid_input: false,
        input_type: "REJECTED_SECURITY",
        access_status: "REJECTED_MALICIOUS_OR_UNAPPROVED",
        preview_available: false,
        can_record_and_process: false,
        status_message:
          "SEC-02 Violation: Operator authorization is required before recording or processing media.",
      });
    }

    let fbVideoUrl: string | null = null;
    let embedUrl: string | null = null;
    let resolvedFeed: string | null = feed || null;
    let inputType = "INVALID";

    if (text.toLowerCase().includes("<iframe")) {
      const match = IFRAME_SRC_RE.exec(text);
      if (!match) {
        return NextResponse.json({
          valid_input: false,
          input_type: "INVALID",
          access_status: "INVALID_SOURCE",
          preview_available: false,
          can_record_and_process: false,
          status_message: "Could not extract a valid src attribute from the iframe code.",
        });
      }
      const rawSrc = match[1].replace(/&amp;/g, "&").trim();
      let parsed: URL;
      try {
        parsed = new URL(rawSrc);
      } catch {
        return NextResponse.json({
          valid_input: false,
          input_type: "INVALID",
          access_status: "INVALID_SOURCE",
          preview_available: false,
          can_record_and_process: false,
          status_message: "Invalid URL inside iframe src attribute.",
        });
      }

      if (!ALLOWED_FACEBOOK_HOSTS.has(parsed.hostname)) {
        return NextResponse.json({
          valid_input: false,
          input_type: "REJECTED_SECURITY",
          access_status: "REJECTED_MALICIOUS_OR_UNAPPROVED",
          preview_available: false,
          can_record_and_process: false,
          status_message: `SEC-01 Violation: Unapproved iframe host '${parsed.hostname}'.`,
        });
      }

      embedUrl = rawSrc;
      const hrefParam = parsed.searchParams.get("href");
      if (hrefParam) {
        fbVideoUrl = hrefParam;
      }
      inputType = "FACEBOOK_IFRAME";
    } else if (/^(https?|rtmps?):\/\//i.test(text)) {
      let parsed: URL;
      try {
        parsed = new URL(text);
      } catch {
        return NextResponse.json({
          valid_input: false,
          input_type: "INVALID",
          access_status: "INVALID_SOURCE",
          preview_available: false,
          can_record_and_process: false,
          status_message: "Invalid stream URL format.",
        });
      }

      if (ALLOWED_FACEBOOK_HOSTS.has(parsed.hostname)) {
        fbVideoUrl = text;
        embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(text)}&show_text=false`;
        inputType = "FACEBOOK_URL";
      } else if (
        parsed.protocol.startsWith("rtmp") ||
        /\.(m3u8|mp4|ts|mkv)(\?.*)?$/i.test(parsed.pathname)
      ) {
        resolvedFeed = resolvedFeed || text;
        inputType = "DIRECT_MEDIA_FEED";
      } else {
        return NextResponse.json({
          valid_input: false,
          input_type: "REJECTED_SECURITY",
          access_status: "REJECTED_MALICIOUS_OR_UNAPPROVED",
          preview_available: false,
          can_record_and_process: false,
          status_message: `SEC-01 Violation: Unapproved URL destination '${parsed.hostname}'.`,
        });
      }
    } else {
      resolvedFeed = resolvedFeed || text;
      inputType = "LOCAL_FILE";
    }

    let streamTitle: string | undefined;
    let streamUploader: string | undefined;
    let streamDurationSec: number | undefined;

    if (!resolvedFeed && fbVideoUrl) {
      const probed = await probePublicFacebookMedia(fbVideoUrl);
      if (probed.resolved_url) {
        resolvedFeed = probed.resolved_url;
        streamTitle = probed.title;
        streamUploader = probed.uploader;
        streamDurationSec = probed.duration_sec;
      }
    }

    if (resolvedFeed) {
      const metaSuffix =
        streamTitle && streamDurationSec
          ? ` (${streamUploader}: '${streamTitle}', ${streamDurationSec.toFixed(1)}s)`
          : "";
      return NextResponse.json({
        valid_input: true,
        input_type: inputType,
        facebook_video_url: fbVideoUrl,
        embed_player_url: embedUrl,
        direct_media_url: resolvedFeed,
        stream_title: streamTitle,
        stream_uploader: streamUploader,
        stream_duration_sec: streamDurationSec,
        preview_available: true,
        can_record_and_process: true,
        access_status: "AUTHORIZED_MEDIA_READY",
        status_message: `Authorized media feed verified${metaSuffix} — continuous recording and AI analysis ready.`,
      });
    }

    // FB-03 requirement: Preview available — processing source unavailable
    return NextResponse.json({
      valid_input: true,
      input_type: inputType,
      facebook_video_url: fbVideoUrl,
      embed_player_url: embedUrl,
      direct_media_url: null,
      preview_available: true,
      can_record_and_process: false,
      access_status: "PREVIEW_ONLY_PROCESSING_UNAVAILABLE",
      status_message:
        "Preview available — processing source unavailable. Provide an authorized direct media feed (HLS/RTMP/file) to begin recording.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        valid_input: false,
        input_type: "INVALID",
        access_status: "INVALID_SOURCE",
        preview_available: false,
        can_record_and_process: false,
        status_message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
