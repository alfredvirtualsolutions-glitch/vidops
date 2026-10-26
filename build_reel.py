import os
import json
import random
import subprocess
from pathlib import Path

import braintrust

logger = braintrust.init_logger(project="vidops")
braintrust.auto_instrument()

import requests

# Paths to your OpenMontage directory and clip storage
OPENMONTAGE_DIR = os.path.join(os.getcwd(), "OpenMontage")
CLIP_STORAGE_DIR = os.path.join(os.getcwd(), "clips")
OUTPUT_DIR = os.path.join(os.getcwd(), "reels")

# Mureka API credentials (mocked - replace with your actual keys)
MUREKA_API_KEY = os.environ.get("MUREKA_API_KEY")
MUREKA_API_URL = "https://api.mureka.ai/v1/generate"

def fetch_mureka_audio(prompt: str, output_path: str):
    """
    Requests a generated track from Mureka and downloads it to the output path.
    """
    print(f"Requesting audio from Mureka: '{prompt}'")

    headers = {
        "Authorization": f"Bearer {MUREKA_API_KEY}",
        "Content-Type": "application/json"
    }

    # Payload structure based on typical AI audio generation APIs
    payload = {
        "prompt": prompt,
        "duration": 60, # 60 seconds
        "format": "mp3"
    }

    try:
        # 1. Trigger generation
        response = requests.post(MUREKA_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        audio_url = response.json().get("audio_url")

        # 2. Download the resulting audio file
        audio_data = requests.get(audio_url)
        with open(output_path, 'wb') as f:
            f.write(audio_data.content)

        print(f"Successfully downloaded Mureka audio to {output_path}")
        return output_path
    except Exception as e:
        print(f"Failed to fetch Mureka audio: {e}")
        # Fallback to a default track if API fails
        return os.path.join(CLIP_STORAGE_DIR, "default_beat.mp3")

def gather_clips_for_reel(category="highlights", target_duration=60):
    """
    Selects random clips from the specified category until the target duration is reached.
    (Assuming average clip length is 8 seconds for estimation).
    """
    target_folder = os.path.join(CLIP_STORAGE_DIR, category)

    # Recursively find all mp4s in the target folder (including 'solo' and 'team' subfolders)
    available_clips = list(Path(target_folder).rglob("*.mp4"))

    if not available_clips:
        print(f"No clips found in {target_folder}")
        return []

    # Shuffle to get a unique reel every time
    random.shuffle(available_clips)

    selected_clips = []
    estimated_duration = 0

    for clip in available_clips:
        if estimated_duration >= target_duration:
            break

        # We assume clips are ~8s based on previous FFmpeg trimming logic
        # In a production app, use ffprobe to get the exact duration
        selected_clips.append(str(clip.absolute()))
        estimated_duration += 8

    return selected_clips

def build_remotion_props(clips: list, audio_path: str, output_json: str):
    """
    Constructs the input.json file that OpenMontage uses to render the sequence.
    This configures a 1080x1920 (vertical) layout and sets video objects to 'cover' to crop natively.
    """
    # Remotion composition properties
    props = {
        "resolution": {"width": 1080, "height": 1920}, # 9:16 Vertical
        "fps": 30,
        "audioTrack": audio_path,
        "audioVolume": 0.8, # Keep music slightly lower than court noise
        "clips": []
    }

    for clip in clips:
        props["clips"].append({
            "src": clip,
            "objectFit": "cover", # Automatically center-crops the 16:9 video to 9:16
            "volume": 1.0,        # Keep court squeaks and crowd cheers
            # You can inject effects here if OpenMontage supports them natively
            "effects": ["slow_mo_end"] if random.random() > 0.7 else []
        })

    with open(output_json, 'w') as f:
        json.dump(props, f, indent=4)

    return output_json

def render_openmontage_reel(reel_type="highlights"):
    """
    The main orchestrator. Gathers clips, gets music, writes config, and triggers Remotion CLI.
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    reel_id = f"{reel_type}_reel_{random.randint(1000, 9999)}"

    # 1. Gather Clips
    print(f"Assembling {reel_type} reel...")
    clips = gather_clips_for_reel(
        category=reel_type,
        target_duration=60
    )

    if not clips:
        return

    # 2. Get Audio
    # Tailor the prompt depending on the action type
    audio_prompt = "Upbeat, high-energy trap beat for Coach A Triple Threat basketball highlights, 120 BPM"
    if reel_type == "bloopers":
        audio_prompt = "Comical, goofy tuba and pizzicato strings for sports mistakes"

    audio_dest = os.path.join(OUTPUT_DIR, f"{reel_id}_audio.mp3")
    audio_path = fetch_mureka_audio(audio_prompt, audio_dest)

    # 3. Build Remotion Config
    props_path = os.path.join(OPENMONTAGE_DIR, "reel_props.json")
    build_remotion_props(clips, audio_path, props_path)

    # 4. Execute Remotion CLI
    # This runs inside the OpenMontage directory where package.json lives
    final_video_path = os.path.join(OUTPUT_DIR, f"{reel_id}.mp4")

    remotion_cmd = [
        "npx", "remotion", "render",
        "src/index.ts",         # The entry point of the Remotion project
        "MainComposition",      # The React component name registered in Remotion
        final_video_path,
        f"--props={props_path}" # Feed our dynamically generated clips and audio
    ]

    print(f"Triggering OpenMontage render to {final_video_path}...")
    try:
        # Run the command with the working directory set to the cloned repo
        subprocess.run(remotion_cmd, cwd=OPENMONTAGE_DIR, check=True)
        print(f"Reel successfully generated! View it at: {final_video_path}")
    except subprocess.CalledProcessError as e:
        print(f"Remotion render failed: {e}")

if __name__ == "__main__":
    try:
        # Generate a highlight reel
        render_openmontage_reel(reel_type="highlights")

        # You could also generate a blooper reel if enough clips exist
        # render_openmontage_reel(reel_type="bloopers")
    finally:
        logger.flush()
