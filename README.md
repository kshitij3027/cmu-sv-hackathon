# AI Video Creation Studio

**Submission for CMU SV Hackathon**

An AI-powered video creation studio that lets you generate images from text, transform them into videos, and edit them into complete video sequences - all through a simple web interface.

## What Does This Do?

This application combines multiple AI technologies to create a complete video production workflow:

1. **AI Image Generation** - Describe what you want and get AI-generated images using Google Gemini
2. **Intelligent Image Editing** - The AI automatically detects if you want to create a new image or edit an existing one
3. **Image-to-Video Conversion** - Turn any image into a cinematic video using Google Veo 3
4. **Video Editing Suite** - Trim videos, arrange them into scenes, and export complete sequences
5. **Scene-Based Timeline** - Build multi-scene videos by combining and arranging your generated content

## Features

- **Smart Generation Modes**
  - Auto mode: AI determines if you want a new image or to edit existing one
  - New mode: Always generate fresh images
  - Edit mode: Modify existing images with text prompts

- **Video Creation**
  - Convert any image to video with AI
  - Add motion and cinematography automatically
  - Generate videos up to several seconds long

- **Video Editing**
  - Interactive timeline with draggable trim handles
  - Preview trimmed segments before exporting
  - Combine multiple videos into one sequence
  - Play all scenes in order

- **File Management**
  - Gallery view of all generated images and videos
  - Upload your own images to edit
  - Download any generated content
  - Delete unwanted files

- **User Experience**
  - Voice input support (in supported browsers)
  - Real-time status updates
  - Responsive design with Tailwind CSS
  - Dark mode interface

## Quick Start

### Prerequisites

- Python 3.8+
- Google Gemini API key
- OpenRouter API key (for AI intent detection)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd CMU SV Hackathon
```

2. Install dependencies
```bash
pip install -r requirements.txt
```

3. Set up environment variables

Create a `.env.local` file with your API keys:
```bash
GOOGLE_API_KEY=your-google-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
OPENAI_API_KEY=your-openai-api-key  # Optional
```

4. Run the application
```bash
python main.py
```

5. Open your browser to `http://127.0.0.1:8000`

## How to Use

### Generate Your First Image

1. Type a description like "A serene mountain landscape at sunset"
2. Select generation mode (Auto recommended for beginners)
3. Click "Generate"
4. Wait for your image to appear (10-30 seconds)

### Create a Video

1. Generate or upload an image
2. Click "Generate Video"
3. Wait for the AI to create your video (2-5 minutes)
4. Video appears with editing controls

### Edit Videos into Sequences

1. Use the timeline handles to trim your video
2. Click "Next Scene" to add more scenes
3. Generate or select different videos for each scene
4. Click "Export Full Video" to combine all scenes

## Technology Stack

- **Backend**: FastAPI, Python
- **Frontend**: HTML, JavaScript, Tailwind CSS
- **AI Services**:
  - Google Gemini (image generation)
  - Google Veo 3 (video generation)
  - OpenRouter Grok (intent detection)
- **Video Processing**: MoviePy
- **Image Processing**: Pillow (PIL)

## Project Structure

```
├── main.py              # FastAPI backend server
├── API_client.py        # AI API client wrapper
├── templates/           # HTML templates
├── static/              # CSS and JavaScript
├── generated_images/    # AI-generated images
├── uploaded_images/     # User uploads
└── generated_videos/    # Generated and edited videos
```

## Notes

- Video generation can take 2-5 minutes depending on complexity
- Generated files are stored locally and persist between sessions
- The app uses Google's latest Gemini and Veo models for best quality
- Intent detection helps the AI understand if you want to create or edit

## License

This project was created for the CMU SV Hackathon.

## Acknowledgments

Built with Google Gemini, Google Veo 3, and OpenRouter APIs.
