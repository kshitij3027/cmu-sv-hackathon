const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const voiceBtn = document.getElementById('voice-btn');
const statusMessage = document.getElementById('status-message');
const statusText = document.getElementById('status-text');
const loadingSpinner = document.getElementById('loading-spinner');
const resultContainer = document.getElementById('result-container');
const generatedImage = document.getElementById('generated-image');
const generatedVideo = document.getElementById('generated-video');
const modeRadios = document.querySelectorAll('input[name="mode"]');
const imageUploadSection = document.getElementById('image-upload-section');
const imageUpload = document.getElementById('image-upload');

// New elements for sidebar and unified display
const mediaDisplay = document.getElementById('media-display');
const mediaPlaceholder = document.getElementById('media-placeholder');
const downloadBtn = document.getElementById('download-btn');
const generateVideoBtn = document.getElementById('generate-video-btn');
const imagesGallery = document.getElementById('images-gallery');
const videosGallery = document.getElementById('videos-gallery');
const galleryLoading = document.getElementById('gallery-loading');
const galleryEmpty = document.getElementById('gallery-empty');

// Video trimmer elements
const videoTrimmer = document.getElementById('video-trimmer');
const timelineContainer = document.getElementById('timeline-container');
const progressBar = document.getElementById('progress-bar');
const currentPosition = document.getElementById('current-position');
const leftHandle = document.getElementById('left-handle');
const rightHandle = document.getElementById('right-handle');
const trimRegion = document.getElementById('trim-region');
const startTime = document.getElementById('start-time');
const currentTime = document.getElementById('current-time');
const endTime = document.getElementById('end-time');
const playTrimmedBtn = document.getElementById('play-trimmed-btn');
const resetTrimBtn = document.getElementById('reset-trim-btn');
const exportTrimBtn = document.getElementById('export-trim-btn');
const nextSceneBtn = document.getElementById('next-scene-btn');
const scenesStrip = document.getElementById('scenes-strip');
const playAllScenesBtn = document.getElementById('play-all-scenes-btn');
// Modal elements
const playlistModal = document.getElementById('playlist-modal');
const playlistVideo = document.getElementById('playlist-video');
const playlistStatus = document.getElementById('playlist-status');
const playlistCloseBtn = document.getElementById('playlist-close-btn');
const playlistPrevBtn = document.getElementById('playlist-prev-btn');
const playlistNextBtn = document.getElementById('playlist-next-btn');
const playlistStopBtn = document.getElementById('playlist-stop-btn');
const exportFullVideoBtn = document.getElementById('export-full-video-btn');

let currentUploadedImagePath = null;
let currentDisplayedFile = null; // Track currently displayed file in main area

// Video trimmer variables
let isDragging = false;
let dragHandle = null;
let videoDuration = 0;
let trimStart = 0; // in seconds
let trimEnd = 0; // in seconds
let isPlayingTrimmed = false;
let trimmedPlaybackInterval = null;
let scenes = []; // array of { id, title, media: {type:'image'|'video', path, filename}, trimStart, trimEnd, duration }
let activeSceneId = null;
let playlist = [];
let playlistIndex = 0;

let recognition = null;
let isListening = false;

// Gallery management functions
async function loadGalleryFiles() {
    try {
        galleryLoading.classList.remove('hidden');
        galleryEmpty.classList.add('hidden');

        const response = await fetch('/list-files');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Clear existing galleries
        imagesGallery.innerHTML = '';
        videosGallery.innerHTML = '';

        // Populate images
        if (data.images && data.images.length > 0) {
            data.images.forEach(image => {
                const imageItem = createGalleryItem(image, 'image');
                imagesGallery.appendChild(imageItem);
            });
        }

        // Populate videos
        if (data.videos && data.videos.length > 0) {
            data.videos.forEach(video => {
                const videoItem = createGalleryItem(video, 'video');
                videosGallery.appendChild(videoItem);
            });
        }

        // Show empty message if no files
        if ((!data.images || data.images.length === 0) && (!data.videos || data.videos.length === 0)) {
            galleryEmpty.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error loading gallery files:', error);
        showStatus('Failed to load existing files.', false);
    } finally {
        galleryLoading.classList.add('hidden');
    }
}

function createGalleryItem(file, type) {
    const item = document.createElement('div');
    item.className = 'gallery-item bg-gray-700 rounded-lg p-2 flex items-center space-x-2';
    item.dataset.path = file.path;
    item.dataset.type = type;
    item.dataset.filename = file.filename;

    // Create thumbnail/preview
    const preview = document.createElement(type === 'image' ? 'img' : 'video');
    preview.className = 'w-12 h-12 object-cover rounded';
    preview.src = file.path;

    if (type === 'video') {
        preview.muted = true;
        preview.preload = 'metadata';
        // Force video to show first frame as thumbnail
        preview.currentTime = 0.1;
        preview.addEventListener('loadeddata', function() {
            this.currentTime = 0.1;
        });
    }

    // Create filename text
    const filename = document.createElement('span');
    filename.className = 'text-xs text-gray-300 truncate flex-1';
    filename.textContent = file.filename;

    // Create file type icon
    const icon = document.createElement('div');
    icon.className = 'text-gray-400';
    icon.innerHTML = type === 'image'
        ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
        : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>';

    item.appendChild(preview);
    item.appendChild(filename);
    item.appendChild(icon);

    // Delete button
    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.title = 'Delete file';
    del.textContent = '×';
    del.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!confirm('Delete this file?')) return;
        try {
            const res = await fetch('/delete-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: file.path })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // If the deleted file is currently displayed, clear or move away
            if (currentDisplayedFile && currentDisplayedFile.path === file.path) {
                mediaPlaceholder.classList.remove('hidden');
                generatedImage.classList.add('hidden');
                generatedVideo.classList.add('hidden');
                videoTrimmer.classList.add('hidden');
                currentDisplayedFile = null;
                currentUploadedImagePath = null;
            }

            // Remove from scenes if present
            if (Array.isArray(scenes) && scenes.length) {
                let changed = false;
                scenes.forEach(s => {
                    if (s.media && s.media.path === file.path) {
                        s.media = null;
                        s.trimStart = 0;
                        s.trimEnd = 0;
                        s.duration = 0;
                        changed = true;
                    }
                });
                if (changed) updateScenesStrip();
            }

            await loadGalleryFiles();
            showStatus('File deleted.', false);
            setTimeout(() => hideStatus(), 1500);
        } catch (err) {
            console.error('delete error', err);
            showStatus('Failed to delete file.', false);
            setTimeout(() => hideStatus(), 2000);
        }
    });
    item.appendChild(del);

    // Double-click handler
    item.addEventListener('dblclick', () => displayFileInMainArea(file, type));

    return item;
}

function displayFileInMainArea(file, type) {
    // Hide placeholder
    mediaPlaceholder.classList.add('hidden');

    // Reset both media elements
    generatedImage.classList.add('hidden');
    generatedVideo.classList.add('hidden');

    // Hide trimmer by default
    videoTrimmer.classList.add('hidden');
    stopTrimmedPlayback();

    // Show appropriate media
    if (type === 'image') {
        generatedImage.src = file.path;
        generatedImage.classList.remove('hidden');
        downloadBtn.textContent = 'Download Image';
        generateVideoBtn.classList.remove('hidden');
    } else if (type === 'video') {
        generatedVideo.src = file.path;
        generatedVideo.classList.remove('hidden');
        downloadBtn.textContent = 'Download Video';
        generateVideoBtn.classList.add('hidden');

        // Initialize trimmer when video loads
        generatedVideo.addEventListener('loadedmetadata', initializeTrimmer, { once: true });
    }

    // Show result container and download button
    resultContainer.classList.remove('hidden');
    downloadBtn.classList.remove('hidden');

    // Update current displayed file
    currentDisplayedFile = { ...file, type };
    currentUploadedImagePath = file.path;

    // Update active scene media
    if (activeSceneId) {
        const scene = scenes.find(s => s.id === activeSceneId);
        if (scene) {
            scene.media = { type, path: file.path, filename: file.filename };
            if (type === 'video') {
                // Persist trims after metadata loads
                generatedVideo.addEventListener('loadedmetadata', () => {
                    scene.duration = generatedVideo.duration || 0;
                    // If scene had trims already, keep them within duration
                    if (typeof scene.trimStart === 'number' && typeof scene.trimEnd === 'number' && scene.trimEnd > 0) {
                        scene.trimStart = Math.max(0, Math.min(scene.trimStart, scene.duration));
                        scene.trimEnd = Math.max(scene.trimStart, Math.min(scene.trimEnd, scene.duration));
                    } else {
                        scene.trimStart = 0;
                        scene.trimEnd = scene.duration;
                    }
                    updateScenesStrip();
                }, { once: true });
            } else {
                updateScenesStrip();
            }
        }
    }

    // Remove selection from all gallery items
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Add selection to clicked item
    if (event && event.target) {
        const galleryItem = event.target.closest('.gallery-item');
        if (galleryItem) {
            galleryItem.classList.add('selected');
        }
    }

    showStatus(`${type === 'image' ? 'Image' : 'Video'} loaded successfully!`, false);
    setTimeout(() => hideStatus(), 2000);
}

// Video Trimmer Functions
function initializeTrimmer() {
    if (generatedVideo.duration && !isNaN(generatedVideo.duration)) {
        videoDuration = generatedVideo.duration;
        trimStart = 0;
        trimEnd = videoDuration;
        updateTrimmerDisplay();

        // Reset current position indicator
        currentPosition.style.left = '0%';
        currentPosition.style.opacity = '0.8';

        videoTrimmer.classList.remove('hidden');
    }
}

function updateTrimmerDisplay() {
    const containerWidth = timelineContainer.offsetWidth;
    const startPercent = (trimStart / videoDuration) * 100;
    const endPercent = (trimEnd / videoDuration) * 100;

    // Update handles position
    leftHandle.style.left = `${startPercent}%`;
    rightHandle.style.left = `${endPercent}%`;

    // Update trim region
    trimRegion.style.left = `${startPercent}%`;
    trimRegion.style.width = `${endPercent - startPercent}%`;

    // Update time displays
    startTime.textContent = formatTime(trimStart);
    endTime.textContent = formatTime(trimEnd);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getMousePosition(event) {
    const rect = timelineContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    return percent * videoDuration;
}

// Handle dragging functions
function startDrag(event, handle) {
    event.preventDefault();
    isDragging = true;
    dragHandle = handle;
    timelineContainer.classList.add('dragging');
    handle.classList.add('trim-handle-active');
    handle.classList.add('dragging');

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
}

function handleDrag(event) {
    if (!isDragging || !dragHandle) return;

    const newTime = getMousePosition(event);
    let seekTime = 0;

    if (dragHandle === leftHandle) {
        trimStart = Math.max(0, Math.min(trimEnd - 1, newTime));
        seekTime = trimStart;
    } else if (dragHandle === rightHandle) {
        trimEnd = Math.max(trimStart + 1, Math.min(videoDuration, newTime));
        seekTime = trimEnd;
    }

    updateTrimmerDisplay();

    // Persist into active scene during drag
    if (activeSceneId) {
        const scene = scenes.find(s => s.id === activeSceneId);
        if (scene) {
            scene.trimStart = trimStart;
            scene.trimEnd = trimEnd;
        }
    }

    // Provide real-time feedback by seeking video to the handle position
    if (generatedVideo && !isNaN(seekTime) && seekTime >= 0 && seekTime <= videoDuration) {
        // Temporarily pause video to prevent conflicts during seeking
        const wasPlaying = !generatedVideo.paused;
        if (wasPlaying) {
            generatedVideo.pause();
        }

        // Add visual feedback for seeking
        timelineContainer.style.opacity = '0.7';

        generatedVideo.currentTime = seekTime;

        // Resume playing if it was playing before (but only if within trim bounds)
        if (wasPlaying && generatedVideo.currentTime >= trimStart && generatedVideo.currentTime <= trimEnd) {
            // Small delay to ensure seek is complete
            setTimeout(() => {
                if (generatedVideo.currentTime >= trimStart && generatedVideo.currentTime <= trimEnd) {
                    generatedVideo.play();
                }
                timelineContainer.style.opacity = '1';
            }, 100);
        } else {
            // Reset opacity for non-playing state
            setTimeout(() => {
                timelineContainer.style.opacity = '1';
            }, 100);
        }
    }
}

function stopDrag() {
    if (!isDragging) return;

    isDragging = false;
    timelineContainer.classList.remove('dragging');

    if (dragHandle) {
        dragHandle.classList.remove('trim-handle-active');
        dragHandle.classList.remove('dragging');
        dragHandle = null;
    }

    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// Timeline click handler
function handleTimelineClick(event) {
    if (isDragging) return;

    const clickTime = getMousePosition(event);
    const clickPercent = (event.clientX - timelineContainer.getBoundingClientRect().left) / timelineContainer.offsetWidth;

    // Determine which handle is closer
    const leftHandlePercent = trimStart / videoDuration;
    const rightHandlePercent = trimEnd / videoDuration;

    const distanceToLeft = Math.abs(clickPercent - leftHandlePercent);
    const distanceToRight = Math.abs(clickPercent - rightHandlePercent);

    let seekTime = 0;

    if (distanceToLeft < distanceToRight) {
        trimStart = Math.max(0, Math.min(trimEnd - 1, clickTime));
        seekTime = trimStart;
    } else {
        trimEnd = Math.max(trimStart + 1, Math.min(videoDuration, clickTime));
        seekTime = trimEnd;
    }

    updateTrimmerDisplay();

    // Persist into active scene on click
    if (activeSceneId) {
        const scene = scenes.find(s => s.id === activeSceneId);
        if (scene) {
            scene.trimStart = trimStart;
            scene.trimEnd = trimEnd;
            updateScenesStrip();
        }
    }

    // Provide real-time feedback by seeking video to the clicked position
    if (generatedVideo && !isNaN(seekTime) && seekTime >= 0 && seekTime <= videoDuration) {
        // Add visual feedback for seeking
        timelineContainer.style.opacity = '0.7';
        generatedVideo.currentTime = seekTime;

        // Reset opacity after seek
        setTimeout(() => {
            timelineContainer.style.opacity = '1';
        }, 100);
    }
}

// Play trimmed video function
function playTrimmedVideo() {
    if (isPlayingTrimmed) {
        stopTrimmedPlayback();
        return;
    }

    isPlayingTrimmed = true;
    playTrimmedBtn.textContent = 'Stop Playing';

    generatedVideo.currentTime = trimStart;
    generatedVideo.play();

    // Monitor playback and stop at trim end
    trimmedPlaybackInterval = setInterval(() => {
        currentTime.textContent = formatTime(generatedVideo.currentTime);

        if (generatedVideo.currentTime >= trimEnd) {
            stopTrimmedPlayback();
        }
    }, 100);
}

function stopTrimmedPlayback() {
    isPlayingTrimmed = false;
    playTrimmedBtn.textContent = 'Play Trimmed';
    generatedVideo.pause();

    if (trimmedPlaybackInterval) {
        clearInterval(trimmedPlaybackInterval);
        trimmedPlaybackInterval = null;
    }
}

function resetTrimmer() {
    trimStart = 0;
    trimEnd = videoDuration;
    updateTrimmerDisplay();
    stopTrimmedPlayback();

    // Persist into active scene
    if (activeSceneId) {
        const scene = scenes.find(s => s.id === activeSceneId);
        if (scene) {
            scene.trimStart = trimStart;
            scene.trimEnd = trimEnd;
            updateScenesStrip();
        }
    }
}

async function exportTrimmedVideo() {
    if (!currentDisplayedFile || currentDisplayedFile.type !== 'video') {
        showStatus('No video loaded for trimming.', false);
        return;
    }

    if (trimStart >= trimEnd) {
        showStatus('Invalid trim range. End time must be greater than start time.', false);
        return;
    }

    exportTrimBtn.disabled = true;
    exportTrimBtn.textContent = 'Exporting...';
    showStatus('Exporting trimmed video... This may take a few moments.', true);

    try {
        const formData = new FormData();
        formData.append('video_path', currentDisplayedFile.path);
        formData.append('start_time', trimStart.toString());
        formData.append('end_time', trimEnd.toString());

        const response = await fetch('/trim-video', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Display the trimmed video
        displayFileInMainArea({
            path: data.video_path,
            filename: data.video_path.split('/').pop(),
            type: 'video'
        }, 'video');

        // Reload gallery to include the new trimmed video
        loadGalleryFiles();

        showStatus('Trimmed video exported successfully!', false);
        setTimeout(() => hideStatus(), 3000);

    } catch (error) {
        console.error('Error exporting trimmed video:', error);
        showStatus('Failed to export trimmed video. Please try again.', false);
    } finally {
        exportTrimBtn.disabled = false;
        exportTrimBtn.textContent = 'Export Trimmed';
    }
}

// Initialize speech recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = function() {
        isListening = true;
        voiceBtn.classList.add('text-red-500');
        voiceBtn.classList.remove('text-gray-400');
        showStatus('Listening...', true);
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        promptInput.value = transcript;
        showStatus('Voice input captured!', false);
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        showStatus('Voice recognition failed. Please try again.', false);
    };

    recognition.onend = function() {
        isListening = false;
        voiceBtn.classList.remove('text-red-500');
        voiceBtn.classList.add('text-gray-400');
        if (statusMessage.classList.contains('hidden') === false) {
            setTimeout(() => hideStatus(), 2000);
        }
    };
} else {
    voiceBtn.disabled = true;
    voiceBtn.classList.add('opacity-50', 'cursor-not-allowed');
    voiceBtn.title = 'Speech recognition not supported in this browser';
}

// Voice button click handler
voiceBtn.addEventListener('click', function() {
    if (!recognition) {
        alert('Speech recognition is not supported in this browser.');
        return;
    }

    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

// Generate button click handler
generateBtn.addEventListener('click', async function() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showStatus('Please enter a description for the image.', false);
        return;
    }

    // Get selected mode
    const selectedMode = document.querySelector('input[name="mode"]:checked').value;

    // Check if edit mode and no image uploaded
    if (selectedMode === 'edit' && !currentUploadedImagePath) {
        showStatus('Please upload an image to edit first.', false);
        return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    showStatus('Generating your image...', true);

    try {
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('mode', selectedMode);

        if (currentUploadedImagePath) {
            formData.append('current_image', currentUploadedImagePath);
        }

        const response = await fetch('/generate-image', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Display the generated image in the unified display
        displayFileInMainArea({
            path: data.image_path,
            filename: data.image_path.split('/').pop(),
            type: 'image'
        }, 'image');

        // Reload gallery to include the new image
        loadGalleryFiles();

        showStatus('Image generated successfully!', false);
        setTimeout(() => hideStatus(), 3000);

    } catch (error) {
        console.error('Error:', error);
        showStatus('Failed to generate image. Please try again.', false);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate';
    }
});

// Mode change handler
modeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'edit') {
            imageUploadSection.classList.remove('hidden');
            // Auto-use the scene's current image if present
            if (activeSceneId) {
                const scene = scenes.find(s => s.id === activeSceneId);
                if (scene && scene.media && scene.media.type === 'image') {
                    currentUploadedImagePath = scene.media.path;
                    showStatus('Using current scene image for editing.', false);
                    setTimeout(() => hideStatus(), 1500);
                }
            }
        } else {
            imageUploadSection.classList.add('hidden');
            imageUpload.value = '';
            currentUploadedImagePath = null;
        }
    });
});

// Image upload handler
imageUpload.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload-image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            currentUploadedImagePath = data.image_path;
            showStatus('Image uploaded successfully!', false);
            setTimeout(() => hideStatus(), 2000);

        } catch (error) {
            console.error('Error uploading image:', error);
            showStatus('Failed to upload image. Please try again.', false);
        }
    }
});

// Download button handler
downloadBtn.addEventListener('click', function() {
    if (!currentDisplayedFile) return;

    const link = document.createElement('a');
    link.href = currentDisplayedFile.path;

    // Set appropriate filename based on file type
    const extension = currentDisplayedFile.type === 'image' ? 'png' : 'mp4';
    link.download = currentDisplayedFile.filename || `generated-${currentDisplayedFile.type}.${extension}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Video generation button handler
generateVideoBtn.addEventListener('click', async function() {
    if (!currentUploadedImagePath) {
        showStatus('No image available for video generation.', false);
        return;
    }

    generateVideoBtn.disabled = true;
    generateVideoBtn.textContent = 'Generating Video...';
    showStatus('Generating video from image... This may take several minutes.', true);

    try {
        const formData = new FormData();
        formData.append('image_path', currentUploadedImagePath);
        formData.append('prompt', promptInput.value || 'Create a cinematic video based on this image');

        const response = await fetch('/generate-video', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Display the generated video in the unified display
        displayFileInMainArea({
            path: data.video_path,
            filename: data.video_path.split('/').pop(),
            type: 'video'
        }, 'video');

        // Reload gallery to include the new video
        loadGalleryFiles();

        // Scroll to result container
        resultContainer.scrollIntoView({ behavior: 'smooth' });

        showStatus('Video generated successfully!', false);
        setTimeout(() => hideStatus(), 3000);

        // Initialize trimmer for the new video
        generatedVideo.addEventListener('loadedmetadata', initializeTrimmer, { once: true });

    } catch (error) {
        console.error('Error generating video:', error);
        showStatus('Failed to generate video. Please try again.', false);
    } finally {
        generateVideoBtn.disabled = false;
        generateVideoBtn.textContent = 'Generate Video';
    }
});


// Enter key handler
promptInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        generateBtn.click();
    }
});

function showStatus(message, showSpinner) {
    statusText.textContent = message;
    statusMessage.classList.remove('hidden');

    if (showSpinner) {
        loadingSpinner.classList.remove('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
    }
}

function hideStatus() {
    statusMessage.classList.add('hidden');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Load existing files into the gallery
    loadGalleryFiles();

    // Initialize trimmer event listeners
    initializeTrimmerEventListeners();

    // Initialize scenes model
    initializeScenes();
    if (nextSceneBtn) nextSceneBtn.addEventListener('click', () => addSceneAndSelect());
    if (playAllScenesBtn) playAllScenesBtn.addEventListener('click', openPlaylistModal);
    if (playlistCloseBtn) playlistCloseBtn.addEventListener('click', closePlaylistModal);
    if (playlistPrevBtn) playlistPrevBtn.addEventListener('click', () => stepPlaylist(-1));
    if (playlistNextBtn) playlistNextBtn.addEventListener('click', () => stepPlaylist(1));
    if (playlistStopBtn) playlistStopBtn.addEventListener('click', stopPlaylistPlayback);
    if (exportFullVideoBtn) exportFullVideoBtn.addEventListener('click', exportFullVideo);
});

// Scenes management
function initializeScenes() {
    if (!scenes || scenes.length === 0) {
        const first = createEmptyScene(1);
        scenes.push(first);
        activeSceneId = first.id;
    }
    updateScenesStrip();
}

function createEmptyScene(index) {
    return {
        id: cryptoRandomId(),
        title: `Scene ${index}`,
        media: null, // { type, path, filename }
        trimStart: 0,
        trimEnd: 0,
        duration: 0,
    };
}

function addSceneAndSelect() {
    const index = scenes.length + 1;
    const scene = createEmptyScene(index);
    scenes.push(scene);
    activeSceneId = scene.id;
    updateScenesStrip();
    // Clear main area for new scene
    mediaPlaceholder.classList.remove('hidden');
    generatedImage.classList.add('hidden');
    generatedVideo.classList.add('hidden');
    videoTrimmer.classList.add('hidden');
}

function selectScene(id) {
    const scene = scenes.find(s => s.id === id);
    if (!scene) return;
    activeSceneId = id;
    updateScenesStrip();

    if (scene.media) {
        displayFileInMainArea({ path: scene.media.path, filename: scene.media.filename }, scene.media.type);
        if (scene.media.type === 'video') {
            generatedVideo.addEventListener('loadedmetadata', () => {
                videoDuration = generatedVideo.duration || 0;
                trimStart = Math.min(scene.trimStart || 0, videoDuration);
                trimEnd = Math.min(scene.trimEnd || videoDuration, videoDuration);
                updateTrimmerDisplay();
            }, { once: true });
        }
    } else {
        // No media yet
        mediaPlaceholder.classList.remove('hidden');
        generatedImage.classList.add('hidden');
        generatedVideo.classList.add('hidden');
        videoTrimmer.classList.add('hidden');
    }
}

function updateScenesStrip() {
    if (!scenesStrip) return;
    scenesStrip.innerHTML = '';

    scenes.forEach((scene, idx) => {
        const card = document.createElement('div');
        card.className = `scene-card ${scene.id === activeSceneId ? 'active' : ''}`;

        const thumb = document.createElement(scene.media && scene.media.type === 'image' ? 'img' : 'video');
        thumb.className = 'scene-thumb';
        if (scene.media && scene.media.path) {
            thumb.src = scene.media.path;
            if (scene.media.type === 'video') {
                thumb.muted = true; thumb.preload = 'metadata'; thumb.controls = false;
            }
        } else {
            // placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'scene-thumb scene-add';
            placeholder.innerHTML = '<div class="text-center"><div class="text-2xl">+</div><div class="scene-subtitle">Add media</div></div>';
            card.appendChild(placeholder);
        }

        if (scene.media) card.appendChild(thumb);

        const meta = document.createElement('div');
        meta.className = 'scene-meta';
        meta.innerHTML = `<div class="scene-title">${scene.title}</div><div class="scene-subtitle">${scene.media ? (scene.media.type === 'video' ? 'Video' : 'Image') : 'Empty'}</div>`;
        card.appendChild(meta);

        card.addEventListener('click', () => selectScene(scene.id));
        scenesStrip.appendChild(card);
    });

    // Add tile
    const addTile = document.createElement('div');
    addTile.className = 'scene-card scene-add';
    addTile.style.width = '120px';
    addTile.innerHTML = '<div class="scene-thumb scene-add"><div class="text-3xl">+</div></div><div class="scene-meta"><div class="scene-subtitle">New Scene</div></div>';
    addTile.addEventListener('click', addSceneAndSelect);
    scenesStrip.appendChild(addTile);
}

function cryptoRandomId() {
    // Fallback simple random id
    if (window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(4);
        window.crypto.getRandomValues(arr);
        return Array.from(arr).map(n => n.toString(16)).join('');
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Playlist / Play All
function openPlaylistModal() {
    // Build playlist from scenes that have video media
    playlist = scenes
        .filter(s => s.media && s.media.type === 'video')
        .map(s => ({
            path: s.media.path,
            start: typeof s.trimStart === 'number' ? s.trimStart : 0,
            end: typeof s.trimEnd === 'number' && s.trimEnd > 0 ? s.trimEnd : (s.duration || 0),
            title: s.title
        }));

    if (!playlist.length) {
        showStatus('No video scenes to play.', false);
        return;
    }

    playlistIndex = 0;
    playlistModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    startPlaylistPlayback();
}

function closePlaylistModal() {
    stopPlaylistPlayback();
    playlistModal.classList.add('hidden');
    document.body.style.overflow = '';
}

function startPlaylistPlayback() {
    if (!playlist.length) return;
    const item = playlist[playlistIndex];
    playlistVideo.src = item.path;
    playlistVideo.pause();
    playlistVideo.currentTime = 0;
    playlistVideo.addEventListener('loadedmetadata', () => {
        const duration = playlistVideo.duration || 0;
        const start = Math.max(0, Math.min(item.start, duration));
        const end = Math.max(start, Math.min(item.end || duration, duration));
        playlistVideo.currentTime = start;
        playlistStatus.textContent = `${item.title} — Scene ${playlistIndex + 1} / ${playlist.length}`;
        playlistVideo.play();
        const watcher = setInterval(() => {
            if (playlistVideo.currentTime >= end - 0.05 || playlistVideo.ended) {
                clearInterval(watcher);
                stepPlaylist(1);
            }
        }, 100);
    }, { once: true });
}

function stepPlaylist(delta) {
    playlistIndex += delta;
    if (playlistIndex < 0) playlistIndex = 0;
    if (playlistIndex >= playlist.length) {
        // done
        closePlaylistModal();
        return;
    }
    startPlaylistPlayback();
}

function stopPlaylistPlayback() {
    try { playlistVideo.pause(); } catch {}
    playlistVideo.src = '';
}

async function exportFullVideo() {
    // Build scenes payload from scenes list for videos only
    const scenesPayload = scenes
        .filter(s => s.media && s.media.type === 'video')
        .map(s => ({
            path: s.media.path,
            start_time: typeof s.trimStart === 'number' ? s.trimStart : 0,
            end_time: typeof s.trimEnd === 'number' && s.trimEnd > 0 ? s.trimEnd : (s.duration || 0),
        }));

    if (!scenesPayload.length) {
        showStatus('No video scenes to export.', false);
        return;
    }

    exportFullVideoBtn.disabled = true;
    exportFullVideoBtn.textContent = 'Exporting...';
    showStatus('Exporting full video. This may take a while…', true);

    try {
        const res = await fetch('/export-sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenes: scenesPayload })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Show the exported video in the main viewer
        displayFileInMainArea({ path: data.video_path, filename: data.video_path.split('/').pop(), type: 'video' }, 'video');
        loadGalleryFiles();
        showStatus('Full video exported successfully!', false);
        setTimeout(() => hideStatus(), 3000);
    } catch (e) {
        console.error('exportFullVideo error', e);
        showStatus('Failed to export full video.', false);
    } finally {
        exportFullVideoBtn.disabled = false;
        exportFullVideoBtn.textContent = 'Export Full Video';
    }
}

function initializeTrimmerEventListeners() {
    // Handle dragging
    leftHandle.addEventListener('mousedown', (e) => startDrag(e, leftHandle));
    rightHandle.addEventListener('mousedown', (e) => startDrag(e, rightHandle));

    // Timeline click
    timelineContainer.addEventListener('click', handleTimelineClick);

    // Trimmer controls
    playTrimmedBtn.addEventListener('click', playTrimmedVideo);
    resetTrimBtn.addEventListener('click', resetTrimmer);
    exportTrimBtn.addEventListener('click', exportTrimmedVideo);

    // Prevent text selection during dragging
    document.addEventListener('selectstart', (e) => {
        if (isDragging) {
            e.preventDefault();
        }
    });

    // Update current time display and position indicator
    generatedVideo.addEventListener('timeupdate', () => {
        if (generatedVideo.currentTime && videoDuration > 0) {
            currentTime.textContent = formatTime(generatedVideo.currentTime);

            // Update current position indicator
            const currentPercent = (generatedVideo.currentTime / videoDuration) * 100;
            currentPosition.style.left = `${currentPercent}%`;

            // Show/hide current position based on whether we're in trimmed mode
            if (isPlayingTrimmed) {
                // Only show current position if within trim bounds
                if (generatedVideo.currentTime >= trimStart && generatedVideo.currentTime <= trimEnd) {
                    currentPosition.style.opacity = '0.8';
                } else {
                    currentPosition.style.opacity = '0';
                }
            } else {
                currentPosition.style.opacity = '0.8';
            }
        }
    });
}
