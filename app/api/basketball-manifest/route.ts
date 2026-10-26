import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const baseDir = path.join(process.cwd(), "basketball_output");
    const manifestPath = path.join(baseDir, "event_manifest", "events_manifest.json");
    const edlPath = path.join(baseDir, "event_manifest", "edit_decision_list.json");
    const mvpPath = path.join(baseDir, "mvp_candidates", "MVP_Candidate_Report.json");
    const qcPath = path.join(baseDir, "processing_logs", "quality_report.json");
    const summaryPath = path.join(baseDir, "processing_logs", "processing_summary.md");
    const segPath = path.join(baseDir, "recording_segments", "segments_index.json");

    const [manifestRaw, edlRaw, mvpRaw, qcRaw, summaryMd, segRaw] = await Promise.all([
      fs.readFile(manifestPath, "utf-8").catch(() => null),
      fs.readFile(edlPath, "utf-8").catch(() => null),
      fs.readFile(mvpPath, "utf-8").catch(() => null),
      fs.readFile(qcPath, "utf-8").catch(() => null),
      fs.readFile(summaryPath, "utf-8").catch(() => null),
      fs.readFile(segPath, "utf-8").catch(() => null),
    ]);

    return NextResponse.json({
      ok: true,
      manifest: manifestRaw ? JSON.parse(manifestRaw) : null,
      editDecisionList: edlRaw ? JSON.parse(edlRaw) : null,
      mvpReport: mvpRaw ? JSON.parse(mvpRaw) : null,
      qualityReport: qcRaw ? JSON.parse(qcRaw) : null,
      recordingSegments: segRaw ? JSON.parse(segRaw) : [],
      summaryMarkdown: summaryMd,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      eventId: string;
      primaryPlayer?: string;
      verificationStatus?: "VERIFIED" | "UNCERTAIN_REVIEW_REQUIRED";
      eventType?: string;
    };

    const baseDir = path.join(process.cwd(), "basketball_output");
    const manifestPath = path.join(baseDir, "event_manifest", "events_manifest.json");
    const auditPath = path.join(baseDir, "processing_logs", "operator_audit_log.json");

    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    let updatedEvent = null;
    for (const ev of manifest.events ?? []) {
      if (ev.event_id === body.eventId) {
        const prev = {
          primary_player: ev.primary_player,
          verification_status: ev.verification_status,
          event_type: ev.event_type,
        };
        if (body.primaryPlayer !== undefined) ev.primary_player = body.primaryPlayer;
        if (body.verificationStatus !== undefined) {
          ev.verification_status = body.verificationStatus;
          if (body.verificationStatus === "VERIFIED") {
            ev.confidence = Math.max(ev.confidence, 0.9);
            ev.clip_state = "VERIFIED";
          }
        }
        if (body.eventType !== undefined) ev.event_type = body.eventType;
        updatedEvent = ev;

        // Record operator correction in audit_logs (PRD Section 4 Data Integrity)
        const existingAuditRaw = await fs.readFile(auditPath, "utf-8").catch(() => "[]");
        const auditLogs = JSON.parse(existingAuditRaw);
        auditLogs.push({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          operator: "studio_operator",
          entity_type: "GameEvent",
          entity_id: body.eventId,
          previous_value: prev,
          new_value: {
            primary_player: ev.primary_player,
            verification_status: ev.verification_status,
            event_type: ev.event_type,
          },
        });
        await fs.writeFile(auditPath, JSON.stringify(auditLogs, null, 2), "utf-8");
        break;
      }
    }

    if (!updatedEvent) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
    }

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    return NextResponse.json({ ok: true, event: updatedEvent, manifest });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
