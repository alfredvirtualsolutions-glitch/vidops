import { NextResponse } from "next/server";

/**
 * GitHub App User-to-Server Authentication & On-Behalf-Of Actions
 * ================================================================
 * Supports:
 * 1. Device Flow initiation (`POST /api/github-app` with `{ action: "start_device_flow", clientId }`)
 * 2. Device Flow token polling (`POST /api/github-app` with `{ action: "poll_device_token", clientId, deviceCode }`)
 * 3. Web OAuth code exchange (`POST /api/github-app` with `{ action: "exchange_code", clientId, clientSecret, code }`)
 * 4. Acting on behalf of the user (`POST /api/github-app` with `{ action: "act_on_behalf", userAccessToken, operation, ... }`)
 *    - `get_authenticated_user`: Verifies user identity (e.g. `alfredkeybusiness-eng` / Chubby Genius)
 *    - `create_issue`: Creates a game report or review issue attributed to the user + GitHub App badge
 *    - `create_deployment`: Triggers a deployment event attributed to the user
 */

const GITHUB_API = "https://api.github.com";

function githubHeaders(userAccessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${userAccessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "VidOps-Basketball-AI-Studio-App",
  };
}

export async function GET() {
  const clientId = process.env.GITHUB_APP_CLIENT_ID ?? "";
  const hasUserToken = Boolean(process.env.GITHUB_USER_ACCESS_TOKEN);
  return NextResponse.json({
    ok: true,
    configured: Boolean(clientId || hasUserToken),
    clientId: clientId || null,
    hasEnvUserToken: hasUserToken,
    authorizeUrl: clientId
      ? `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}`
      : "https://github.com/settings/apps",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action:
        | "start_device_flow"
        | "poll_device_token"
        | "exchange_code"
        | "act_on_behalf";
      clientId?: string;
      clientSecret?: string;
      code?: string;
      deviceCode?: string;
      userAccessToken?: string;
      operation?: "get_authenticated_user" | "create_issue" | "create_deployment";
      owner?: string;
      repo?: string;
      title?: string;
      issueBody?: string;
      ref?: string;
      environment?: string;
    };

    const clientId = (body.clientId || process.env.GITHUB_APP_CLIENT_ID || "").trim();
    const clientSecret = (
      body.clientSecret ||
      process.env.GITHUB_APP_CLIENT_SECRET ||
      ""
    ).trim();

    if (body.action === "start_device_flow") {
      if (!clientId) {
        return NextResponse.json(
          { ok: false, error: "Missing GitHub App Client ID (Iv1... / Iv23...)." },
          { status: 400 }
        );
      }
      const res = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok, ...data });
    }

    if (body.action === "poll_device_token") {
      if (!clientId || !body.deviceCode) {
        return NextResponse.json(
          { ok: false, error: "Missing clientId or deviceCode." },
          { status: 400 }
        );
      }
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: body.deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok && Boolean(data.access_token), ...data });
    }

    if (body.action === "exchange_code") {
      if (!clientId || !clientSecret || !body.code) {
        return NextResponse.json(
          { ok: false, error: "Missing clientId, clientSecret, or OAuth code." },
          { status: 400 }
        );
      }
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: body.code,
        }),
      });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok && Boolean(data.access_token), ...data });
    }

    if (body.action === "act_on_behalf") {
      const token = (
        body.userAccessToken ||
        process.env.GITHUB_USER_ACCESS_TOKEN ||
        ""
      ).trim();

      if (!token) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Missing GitHub App user-to-server token (ghu_...). Authorize your GitHub App first.",
          },
          { status: 401 }
        );
      }

      const owner = body.owner || "alfredkeybusiness-eng";
      const repo = body.repo || "vidops";

      if (body.operation === "get_authenticated_user") {
        const res = await fetch(`${GITHUB_API}/user`, {
          headers: githubHeaders(token),
        });
        const data = await res.json();
        return NextResponse.json({
          ok: res.ok,
          programmatic_access_type: "GitHub App user-to-server token",
          user: data,
        });
      }

      if (body.operation === "create_issue") {
        const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues`, {
          method: "POST",
          headers: {
            ...githubHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title:
              body.title ||
              "Basketball AI Studio — Post-Game Highlight & MVP Report (GAME_1743500926740597)",
            body:
              body.issueBody ||
              "Automated post-game highlight & MVP candidate report posted on behalf of @alfredkeybusiness-eng (Chubby Genius).",
          }),
        });
        const data = await res.json();
        return NextResponse.json({
          ok: res.ok,
          programmatic_access_type: "GitHub App user-to-server token",
          issue: data,
        });
      }

      if (body.operation === "create_deployment") {
        const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/deployments`, {
          method: "POST",
          headers: {
            ...githubHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ref: body.ref || "master",
            environment: body.environment || "production",
            auto_merge: false,
            required_contexts: [],
            description: "VidOps Basketball AI Studio Deployment on behalf of user",
          }),
        });
        const data = await res.json();
        return NextResponse.json({
          ok: res.ok,
          programmatic_access_type: "GitHub App user-to-server token",
          deployment: data,
        });
      }
    }

    return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
