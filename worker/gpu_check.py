import json
import shutil
import subprocess
import sys


def main() -> int:
    report = {"nvidia_smi": shutil.which("nvidia-smi") is not None}
    try:
        import torch

        report["torch"] = torch.__version__
        report["cuda_available"] = torch.cuda.is_available()
        if torch.cuda.is_available():
            report["device"] = torch.cuda.get_device_name(0)
            report["vram_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
    except ImportError:
        report["torch"] = None
        report["cuda_available"] = False
        report["error"] = "torch not installed - run: make install-gpu"

    print(json.dumps(report, indent=2))
    return 0 if report.get("cuda_available") else 1


if __name__ == "__main__":
    sys.exit(main())
