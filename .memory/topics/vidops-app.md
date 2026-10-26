# VidOps App

- 2026-10-04 — reviewed build_reel.py (Mureka + Remotion reel generator); saved as build_reel.py with fix list (timeouts, fallback validation, duration overshoot)
- 2026-10-05 — built full Next.js 15.5.27 + Remotion app (clip scanner, Mureka API, Player preview, MainComposition Sequence/Audio mapping)
- 2026-10-05 — deployed to production: https://vidops.vercel.app (project afinancial-partner/vidops, account info-89593731); Next 15.1.6 rejected by Vercel as vulnerable, upgraded to 15.5.27
- 2026-10-05 — added GPU support: Makefile (install-gpu/gpu-check), requirements-gpu.txt, VIDEO_GEN_LOCAL_ENABLED/MODEL env (models: wan2.2-ti2v-5b, wan2.1-1.3b/14b, hunyuan-1.5, ltx2-local, cogvideo-5b), /api/video-gen status route
