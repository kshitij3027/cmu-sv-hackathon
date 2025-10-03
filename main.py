from dotenv import load_dotenv

# Load environment variables from .env.local file
load_dotenv('.env.local')

from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import os
import uuid
import base64
import time
from API_client import make_API_call
from typing import List

# Initialize FastAPI app
app = FastAPI(title="Image Generator", description="Generate images using Google Gemini API")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Initialize Gemini client
client = genai.Client()

# Create images directory if it doesn't exist
os.makedirs("generated_images", exist_ok=True)
os.makedirs("uploaded_images", exist_ok=True)
os.makedirs("generated_videos", exist_ok=True)

class ImageRequest(BaseModel):
    prompt: str

class EditImageRequest(BaseModel):
    prompt: str
    image_path: str

class SceneItem(BaseModel):
    path: str
    start_time: float
    end_time: float

class ExportSequenceRequest(BaseModel):
    scenes: List[SceneItem]

class DeleteRequest(BaseModel):
    path: str

async def determine_request_type(prompt: str) -> str:
    """
    Use AI to determine if the user wants to generate a new image or edit an existing one.
    """
    try:
        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant that determines if a user's request is for generating a new image or editing an existing image. Analyze the prompt and respond with only 'new' or 'edit'."
            },
            {
                "role": "user",
                "content": f"Determine if this request is for generating a NEW image or EDITING an existing image: '{prompt}'. Respond with only 'new' or 'edit'."
            }
        ]

        response = await make_API_call("x-ai/grok-4-fast", messages, "openrouter")

        if response and response.choices:
            result = response.choices[0].message.content.strip().lower()
            if result in ['new', 'edit']:
                print(f"Request type: {result}")
                return result

        # Default to 'new' if AI determination fails
        return 'new'

    except Exception as e:
        print(f"Error determining request type: {e}")
        return 'new'

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Generate unique filename
        filename = f"{uuid.uuid4()}.png"
        filepath = os.path.join("uploaded_images", filename)

        # Read and save the uploaded image
        contents = await file.read()
        with open(filepath, "wb") as f:
            f.write(contents)

        return {"image_path": f"/uploaded_images/{filename}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")

@app.post("/generate-image")
async def generate_image(
    prompt: str = Form(...),
    mode: str = Form("auto"),  # "auto", "new", or "edit"
    current_image: str = Form(None)  # Path to current image for editing
):
    try:
        # Determine request type if auto mode
        if mode == "auto":
            request_type = await determine_request_type(prompt)
        else:
            request_type = mode

        contents = [prompt]

        # If editing and we have a current image, add it to contents
        if request_type == "edit" and current_image:
            # Remove the "/generated_images/" or "/uploaded_images/" prefix to get filename
            image_filename = current_image.replace("/generated_images/", "").replace("/uploaded_images/", "")
            image_path = None

            # Check both directories
            for dir_name in ["generated_images", "uploaded_images"]:
                potential_path = os.path.join(dir_name, image_filename)
                if os.path.exists(potential_path):
                    image_path = potential_path
                    break

            if image_path:
                # Load the existing image
                existing_image = Image.open(image_path)
                contents.append(existing_image)
            else:
                # If image not found, treat as new generation
                request_type = "new"

        # Generate image using Gemini API
        response = client.models.generate_content(
            model="gemini-2.5-flash-image-preview",
            contents=contents,
        )

        # Process the response to find the image
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                # Convert bytes to PIL Image
                image = Image.open(BytesIO(part.inline_data.data))

                # Generate unique filename
                filename = f"{uuid.uuid4()}.png"
                filepath = os.path.join("generated_images", filename)

                # Save the image
                image.save(filepath)

                # Return the image path and request type
                return {
                    "image_path": f"/generated_images/{filename}",
                    "request_type": request_type
                }

        # If no image was found in the response
        raise HTTPException(status_code=500, detail="No image generated in response")

    except Exception as e:
        print(f"❌ Error generating image: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating image: {str(e)}")

@app.get("/generated_images/{filename}")
async def get_generated_image(filename: str):
    filepath = os.path.join("generated_images", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="image/png")
    else:
        raise HTTPException(status_code=404, detail="Image not found")

@app.get("/uploaded_images/{filename}")
async def get_uploaded_image(filename: str):
    filepath = os.path.join("uploaded_images", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="image/png")
    else:
        raise HTTPException(status_code=404, detail="Image not found")

@app.post("/generate-video")
async def generate_video(image_path: str = Form(...), prompt: str = Form(...)):
    try:
        # Load the image from the provided path
        image_filename = image_path.replace("/generated_images/", "").replace("/uploaded_images/", "")
        image_full_path = None

        # Check both directories
        for dir_name in ["generated_images", "uploaded_images"]:
            potential_path = os.path.join(dir_name, image_filename)
            if os.path.exists(potential_path):
                image_full_path = potential_path
                break

        if not image_full_path:
            raise HTTPException(status_code=404, detail="Image not found")

        # Load and prepare the image using SDK field names (image_bytes + mime_type)
        image = Image.open(image_full_path)
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        formatted_image = types.Image(
            image_bytes=buffer.getvalue(),
            mime_type="image/png",
        )

        # Generate video using Gemini Veo 3 (text+image to video)
        operation = client.models.generate_videos(
            model="veo-3.0-fast-generate-001",
            prompt=prompt,
            image=formatted_image,
            config=types.GenerateVideosConfig(negative_prompt="cartoon, drawing, low quality"),
        )

        # Poll the operation status until the video is ready
        while not operation.done:
            print("Waiting for video generation to complete...")
            time.sleep(10)
            operation = client.operations.get(operation)

        # Check if operation completed successfully
        if not operation.response:
            raise Exception(f"Video generation failed: No response from operation. Operation error: {operation.error if hasattr(operation, 'error') else 'Unknown error'}")

        if not hasattr(operation.response, 'generated_videos') or not operation.response.generated_videos:
            raise Exception(f"Video generation failed: No videos in response. Response: {operation.response}")

        # Get the generated video
        generated_video = operation.response.generated_videos[0]

        # Generate unique filename for video
        video_filename = f"{uuid.uuid4()}.mp4"
        video_filepath = os.path.join("generated_videos", video_filename)

        # Download and save the video
        client.files.download(file=generated_video.video)
        generated_video.video.save(video_filepath)

        return {"video_path": f"/generated_videos/{video_filename}"}

    except Exception as e:
        print(f"❌ Error generating video: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating video: {str(e)}")

@app.get("/generated_videos/{filename}")
async def get_generated_video(filename: str):
    filepath = os.path.join("generated_videos", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="video/mp4")
    else:
        raise HTTPException(status_code=404, detail="Video not found")

@app.get("/list-files")
async def list_files():
    """List all generated images and videos."""
    try:
        images = []
        videos = []

        # Get all image files
        if os.path.exists("generated_images"):
            for filename in os.listdir("generated_images"):
                if filename.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                    images.append({
                        "filename": filename,
                        "path": f"/generated_images/{filename}",
                        "type": "image"
                    })

        # Get all video files
        if os.path.exists("generated_videos"):
            for filename in os.listdir("generated_videos"):
                if filename.endswith('.mp4'):
                    videos.append({
                        "filename": filename,
                        "path": f"/generated_videos/{filename}",
                        "type": "video"
                    })

        return {
            "images": images,
            "videos": videos
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")

@app.post("/trim-video")
async def trim_video(video_path: str = Form(...), start_time: float = Form(...), end_time: float = Form(...)):
    """Trim a video file based on start and end times."""
    try:
        # Extract filename from path
        video_filename = video_path.replace("/generated_videos/", "").replace("/uploaded_images/", "")
        video_full_path = None

        # Find the video file
        for dir_name in ["generated_videos", "uploaded_images"]:
            potential_path = os.path.join(dir_name, video_filename)
            if os.path.exists(potential_path):
                video_full_path = potential_path
                break

        if not video_full_path:
            raise HTTPException(status_code=404, detail="Video file not found")

        # Import moviepy here to avoid import errors if not installed
        try:
            from moviepy.editor import VideoFileClip
        except ImportError:
            raise HTTPException(status_code=500, detail="Video trimming requires moviepy. Please install with: pip install moviepy")

        # Load and trim the video
        video_clip = VideoFileClip(video_full_path)
        trimmed_clip = video_clip.subclip(start_time, end_time)

        # Generate unique filename for trimmed video
        trimmed_filename = f"trimmed_{uuid.uuid4()}.mp4"
        trimmed_filepath = os.path.join("generated_videos", trimmed_filename)

        # Export the trimmed video
        trimmed_clip.write_videofile(
            trimmed_filepath,
            codec="libx264",
            audio_codec="aac",
            temp_audiofile=f"temp_audio_{uuid.uuid4()}.m4a",
            remove_temp=True,
            verbose=False,
            logger=None
        )

        # Close the clips to free resources
        video_clip.close()
        trimmed_clip.close()

        return {"video_path": f"/generated_videos/{trimmed_filename}"}

    except Exception as e:
        print(f"Error trimming video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error trimming video: {str(e)}")

@app.post("/export-sequence")
async def export_sequence(payload: ExportSequenceRequest):
    """Concatenate multiple trimmed video segments into one video."""
    try:
        try:
            from moviepy.editor import VideoFileClip, concatenate_videoclips
        except ImportError:
            raise HTTPException(status_code=500, detail="MoviePy not installed. Please install moviepy and imageio-ffmpeg.")

        clips = []
        for item in payload.scenes:
            # locate file
            filename = item.path.replace("/generated_videos/", "").replace("/uploaded_images/", "")
            full_path = None
            for dir_name in ["generated_videos", "uploaded_images", "generated_images"]:
                p = os.path.join(dir_name, filename)
                if os.path.exists(p):
                    full_path = p
                    break
            if not full_path:
                raise HTTPException(status_code=404, detail=f"File not found: {item.path}")

            clip = VideoFileClip(full_path)
            start = max(0, min(item.start_time, clip.duration))
            end = max(start, min(item.end_time, clip.duration))
            clips.append(clip.subclip(start, end))

        if not clips:
            raise HTTPException(status_code=400, detail="No valid scenes to export")

        # Concatenate
        final = concatenate_videoclips(clips, method="compose")

        # Save
        out_name = f"sequence_{uuid.uuid4()}.mp4"
        out_path = os.path.join("generated_videos", out_name)

        final.write_videofile(
            out_path,
            codec="libx264",
            audio_codec="aac",
            temp_audiofile=f"temp_audio_{uuid.uuid4()}.m4a",
            remove_temp=True,
            verbose=False,
            logger=None
        )

        # Close all clips
        try:
            final.close()
        except Exception:
            pass
        for c in clips:
            try:
                c.close()
            except Exception:
                pass

        return {"video_path": f"/generated_videos/{out_name}"}

    except Exception as e:
        print(f"Error exporting sequence: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error exporting sequence: {str(e)}")

@app.post("/delete-file")
async def delete_file_endpoint(payload: DeleteRequest):
    """Delete an image or video file from allowed directories."""
    try:
        raw_path = payload.path.strip()
        if not raw_path:
            raise HTTPException(status_code=400, detail="Path is required")

        # Determine directory by prefix
        dir_map = {
            "/generated_images/": "generated_images",
            "/uploaded_images/": "uploaded_images",
            "/generated_videos/": "generated_videos",
        }

        target_dir = None
        for prefix, dirname in dir_map.items():
            if raw_path.startswith(prefix):
                target_dir = dirname
                filename = raw_path.replace(prefix, "")
                break

        if not target_dir:
            # Fallback: try to locate by filename in known dirs
            filename = os.path.basename(raw_path)
            for dirname in dir_map.values():
                potential = os.path.join(dirname, filename)
                if os.path.exists(potential):
                    target_dir = dirname
                    break

        if not target_dir:
            raise HTTPException(status_code=400, detail="Invalid path")

        # Security: only allow specific extensions
        allowed_exts = {"generated_images": {".png", ".jpg", ".jpeg", ".gif", ".webp"},
                        "uploaded_images": {".png", ".jpg", ".jpeg", ".gif", ".webp"},
                        "generated_videos": {".mp4"}}

        _, ext = os.path.splitext(filename.lower())
        if ext not in allowed_exts.get(target_dir, set()):
            raise HTTPException(status_code=400, detail="Unsupported file type")

        filepath = os.path.join(target_dir, filename)
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="File not found")

        os.remove(filepath)
        return {"deleted": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
