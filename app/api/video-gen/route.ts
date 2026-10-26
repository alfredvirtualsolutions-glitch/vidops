import { execFile } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { SUPPORTED_LOCAL_MODELS, readVideoGenConfig, type VideoGenStatus } from "@/lib/videoGen";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

async function gpuPresent(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], {
      timeout: 5000,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  const { enabled, model } = readVideoGenConfig();
  const supported = (SUPPORTED_LOCAL_MODELS as readonly string[]).includes(model);
  const available = enabled ? await gpuPresent() : false;

  const status: VideoGenStatus = {
    enabled,
    model,
    supported,
    available,
    detail: !enabled
      ? "disabled"
      : !supported
        ? `unknown model "${model}"`
        : available
          ? "gpu ready"
          : "no nvidia-smi - run make install-gpu",
  };

  return NextResponse.json(status);
}
