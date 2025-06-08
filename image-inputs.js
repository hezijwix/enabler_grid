// Image Inputs Grid Manager
class ImageGridManager extends BaseGridManager {
    constructor() {
        super('gridContainer');
        this.selectedCell = null;
        this.defaultImageDataUrl = null;
        this.currentImageDataUrl = null;
        this.isUsingDefaultImage = true;
        
        // Video recording properties
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        
        // Image sequence properties
        this.imageSequence = [];
        this.currentSequenceIndex = 0;
        this.sequenceTimer = null;
        this.preloadedImages = new Map(); // For smooth playback
        
        // Performance caching for heavy image processing modes
        this.processedImageCache = new Map(); // Cache processed images by dataUrl + mode
        this.processingDebounceTimer = null;
        
        // Pre-processed sequence system for heavy modes
        this.processedSequences = new Map(); // Cache entire processed sequences by mode
        this.isProcessingSequence = false;
        
        // Video recording cache
        this.preCalculatedFrames = [];
        this.isPreCalculating = false;
        
        this.setupImageUpload();
        this.setupImageSequence();
        this.setupImageFitModeDropdown();
        this.setupGridControls();
        this.setupCanvasSizeControls();
        this.setupAnimationControls();
        this.setupExportControls();
        this.setupHelpModal();
    }
    
    onActivate() {
        // Called when Image Inputs tab becomes active
        if (!this.initialized) {
            // Event listeners are already set up in constructor, no need to duplicate
            // this.setupImageUpload();
            // this.setupGridControls();
            // this.setupCanvasSizeControls();
            // this.setupAnimationControls();
            // this.setupExportControls();
            // this.setupDefaultContent(); // Removed - no default image
            this.initialized = true;
        }
        console.log('Image Inputs tab activated');
    }
    
    setupImageUpload() {
        const imageUpload = document.getElementById('imageUpload');
        
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.clearImageSequence(); // Clear sequence when single image is loaded
                this.loadImageToAllCells(file, false);
                // Ensure dropdown shows all options for single images
                this.updateFitModeDropdown(false);
            }
            imageUpload.value = '';
        });
    }
    
    setupImageSequence() {
        const folderUpload = document.getElementById('folderUpload');
        
        // Folder upload handler
        folderUpload.addEventListener('change', (e) => {
            const files = Array.from(e.target.files).filter(file => 
                file.type.startsWith('image/')
            );
            if (files.length > 0) {
                this.detectAndLoadSequences(files);
            }
            folderUpload.value = '';
        });
    }
    
    setupImageFitModeDropdown() {
        const imageFitMode = document.getElementById('imageFitMode');
        
        // Store all possible options for restoration
        this.allFitModeOptions = [
            { value: 'fill', text: 'stretch' },
            { value: 'contain', text: 'fit' },
            { value: 'cover', text: 'fill' },
            { value: 'debug-corners', text: 'corner stretch' },
            { value: 'background', text: 'single stretch' },
            { value: 'single-corner-stretch', text: 'pixel sorting' }
        ];
        
        // Options allowed when sequence is active (hide corner stretch and pixel sorting)
        this.sequenceFitModeOptions = [
            { value: 'fill', text: 'stretch' },
            { value: 'contain', text: 'fit' },
            { value: 'cover', text: 'fill' },
            { value: 'background', text: 'single stretch' }
        ];
        
        // Set up change handler
        imageFitMode.addEventListener('change', (e) => {
            this.setImageFitMode(e.target.value);
        });
        
        // Initialize with full options
        this.updateFitModeDropdown(false);
    }
    
    updateFitModeDropdown(hasSequence) {
        const imageFitMode = document.getElementById('imageFitMode');
        const currentValue = imageFitMode.value;
        
        // Clear existing options
        imageFitMode.innerHTML = '';
        
        // Choose which options to show
        const optionsToShow = hasSequence ? this.sequenceFitModeOptions : this.allFitModeOptions;
        
        // Add options
        optionsToShow.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            imageFitMode.appendChild(optionElement);
        });
        
        // Try to maintain current selection if still available
        if (optionsToShow.some(option => option.value === currentValue)) {
            imageFitMode.value = currentValue;
        } else {
            // If current mode is not available, switch to first available option
            imageFitMode.value = optionsToShow[0].value;
            // Apply the new mode immediately
            this.setImageFitMode(imageFitMode.value);
        }
        
        console.log(`Fit mode dropdown updated for ${hasSequence ? 'sequence' : 'single image'} mode`);
    }
    
    setupDefaultContent() {
        this.createDefaultCircleImage().then(dataUrl => {
            this.defaultImageDataUrl = dataUrl;
            this.currentImageDataUrl = dataUrl;
            this.isUsingDefaultImage = true;
            this.loadImageToAllCells(null, true);
        });
    }
    
    createDefaultCircleImage() {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 200;
            
            // Background
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, 200, 200);
            
            // Main circle
            ctx.fillStyle = '#007acc';
            ctx.beginPath();
            ctx.arc(100, 100, 60, 0, 2 * Math.PI);
            ctx.fill();
            
            // Corner circles for nine-slice testing
            ctx.fillStyle = '#ff4444';
            const corners = [[30, 30], [170, 30], [30, 170], [170, 170]];
            corners.forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x, y, 15, 0, 2 * Math.PI);
                ctx.fill();
            });
            
            // Border pattern
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;
            ctx.strokeRect(5, 5, 190, 190);
            
            resolve(canvas.toDataURL());
        });
    }
    
    loadImageToAllCells(file, useDefault = false) {
        if (useDefault) {
            this.currentImageDataUrl = this.defaultImageDataUrl;
            this.isUsingDefaultImage = true;
            this.loadImageFromDataUrl(this.defaultImageDataUrl);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentImageDataUrl = e.target.result;
                this.isUsingDefaultImage = false;
                this.loadImageFromDataUrl(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }
    
    loadImageFromDataUrl(dataUrl) {
        // Clear cache when loading new image
        if (dataUrl !== this.currentImageDataUrl) {
            this.processedImageCache.clear();
        }
        
        this.currentImageDataUrl = dataUrl;
        
        const gridItems = document.querySelectorAll('#gridContainer .grid-item');
        
        gridItems.forEach(cellElement => {
            const imageWrapper = cellElement.querySelector('.image-wrapper');
            const cellLabel = cellElement.querySelector('.cell-label');
            
            const existingImg = imageWrapper.querySelector('img');
            if (existingImg) {
                existingImg.remove();
            }
            
            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = `Image in cell ${cellElement.getAttribute('data-cell')}`;
            
            imageWrapper.appendChild(img);
            cellLabel.classList.add('hidden');
        });
        
        setTimeout(() => {
            this.updateSplitterPositions();
            
            // Apply the current fit mode after loading the image
            const currentFitMode = document.getElementById('imageFitMode').value;
            this.setImageFitMode(currentFitMode);
        }, 100);
        
        console.log('Image loaded to all cells');
    }
    
    clearAllImages() {
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        const cellLabels = document.querySelectorAll('#gridContainer .cell-label');
        
        // Remove all images from image wrappers
        imageWrappers.forEach(wrapper => {
            const img = wrapper.querySelector('img');
            if (img) {
                img.remove();
            }
            // Also clear any debug elements or special styling
            this.clearDebugElements(wrapper);
            wrapper.classList.remove('fit-contain', 'fit-cover', 'debug-corners');
        });
        
        // Show all cell labels (numbered grid)
        cellLabels.forEach(label => {
            label.classList.remove('hidden');
        });
        
        // Clear any background image styling
        this.clearImageBackground();
        
        // Reset state
        this.currentImageDataUrl = null;
        this.isUsingDefaultImage = false;
        
        // Clear image sequence
        this.clearImageSequence();
        
        // Clear video recording cache
        this.preCalculatedFrames = [];
        this.isPreCalculating = false;
        
        console.log('All images cleared - returned to empty grid');
    }
    
    // Image Sequence Methods
    async detectAndLoadSequences(files) {
        this.clearImageSequence();
        
        // Show loading state
        const sequenceStatus = document.getElementById('sequenceStatus');
        sequenceStatus.textContent = `Analyzing ${files.length} images...`;
        
        try {
            // Group files by detected sequences
            const sequences = this.detectSequencePatterns(files);
            
            if (sequences.length === 0) {
                sequenceStatus.textContent = 'No sequences detected';
                return;
            }
            
            // Use the longest sequence (most likely the main one)
            const mainSequence = sequences.reduce((longest, current) => 
                current.files.length > longest.files.length ? current : longest
            );
            
            sequenceStatus.textContent = `Loading sequence: ${mainSequence.pattern} (${mainSequence.files.length} frames)`;
            
            // Load and preload the sequence
            await this.loadImageSequence(mainSequence.files);
            
        } catch (error) {
            console.error('Error detecting sequences:', error);
            sequenceStatus.textContent = 'Error loading sequence';
        }
    }
    
    detectSequencePatterns(files) {
        const sequences = [];
        const processedFiles = new Set();
        
        files.forEach(file => {
            if (processedFiles.has(file.name)) return;
            
            const pattern = this.extractSequencePattern(file.name);
            if (!pattern) return;
            
            // Find all files matching this pattern
            const matchingFiles = files.filter(f => {
                const filePattern = this.extractSequencePattern(f.name);
                return filePattern && 
                       filePattern.prefix === pattern.prefix && 
                       filePattern.suffix === pattern.suffix &&
                       filePattern.digits === pattern.digits;
            });
            
            if (matchingFiles.length > 1) {
                // Sort by sequence number
                matchingFiles.sort((a, b) => {
                    const aNum = this.extractSequenceNumber(a.name);
                    const bNum = this.extractSequenceNumber(b.name);
                    return aNum - bNum;
                });
                
                sequences.push({
                    pattern: pattern.prefix + pattern.numberFormat + pattern.suffix,
                    files: matchingFiles
                });
                
                // Mark all files as processed
                matchingFiles.forEach(f => processedFiles.add(f.name));
            }
        });
        
        return sequences;
    }
    
    extractSequencePattern(filename) {
        // Patterns to match: name_001.jpg, name001.jpg, 0001.jpg, etc.
        const patterns = [
            /^(.+?)_(\d{2,4})(\.[^.]+)$/,  // name_001.jpg
            /^(.+?)(\d{2,4})(\.[^.]+)$/,   // name001.jpg  
            /^(\d{2,4})(\.[^.]+)$/         // 0001.jpg
        ];
        
        for (let pattern of patterns) {
            const match = filename.match(pattern);
            if (match) {
                if (pattern.source.includes('^(\\d')) {
                    // Pattern like 0001.jpg
                    return {
                        prefix: '',
                        digits: match[1].length,
                        suffix: match[2],
                        numberFormat: '0'.repeat(match[1].length)
                    };
                } else {
                    // Patterns like name_001.jpg or name001.jpg
                    return {
                        prefix: match[1] + (filename.includes('_') ? '_' : ''),
                        digits: match[2].length,
                        suffix: match[3],
                        numberFormat: '0'.repeat(match[2].length)
                    };
                }
            }
        }
        return null;
    }
    
    extractSequenceNumber(filename) {
        const patterns = [
            /(\d{2,4})(?:\.[^.]+)?$/  // Extract number from end
        ];
        
        for (let pattern of patterns) {
            const match = filename.match(pattern);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        return 0;
    }
    
    async loadImageSequence(files) {
        this.imageSequence = [];
        this.preloadedImages.clear();
        this.currentSequenceIndex = 0;
        
        // Preload all images for smooth playback
        const sequenceStatus = document.getElementById('sequenceStatus');
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            sequenceStatus.textContent = `Preloading ${i + 1}/${files.length}: ${file.name}`;
            
            // Create image element for smooth rendering
            const img = new Image();
            const dataUrl = await this.fileToDataUrl(file);
            
            await new Promise((resolve) => {
                img.onload = resolve;
                img.src = dataUrl;
            });
            
            this.imageSequence.push({
                name: file.name,
                image: img,
                dataUrl: dataUrl
            });
            
            this.preloadedImages.set(i, img);
        }
        
        // Show sequence info and start auto-play
        const sequenceInfo = document.getElementById('sequenceInfo');
        sequenceInfo.style.display = 'block';
        sequenceStatus.textContent = `${this.imageSequence.length} frames • Playing at 30 FPS`;
        
        // Load first frame and start auto-play
        this.showSequenceImage(0);
        this.startAutoPlay();
        
        // Update dropdown to hide heavy processing modes during sequence playback
        this.updateFitModeDropdown(true);
        
        console.log(`Sequence loaded and auto-playing: ${this.imageSequence.length} frames at 30 FPS`);
    }
    
    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    showSequenceImage(index) {
        if (index >= 0 && index < this.imageSequence.length) {
            this.currentSequenceIndex = index;
            const imageData = this.imageSequence[index];
            
            // For sequences, use simplified loading to avoid heavy processing on every frame
            this.loadSequenceImageOptimized(imageData.dataUrl);
        }
    }
    
    loadSequenceImageOptimized(dataUrl) {
        // Set current image without clearing cache (for sequence performance)
        this.currentImageDataUrl = dataUrl;
        this.isUsingDefaultImage = false;
        
        const currentFitMode = document.getElementById('imageFitMode').value;
        
        // For heavy modes during sequence playback, only apply if we haven't cached this exact frame + mode combo
        if (['debug-corners', 'background', 'single-corner-stretch'].includes(currentFitMode)) {
            // Create cache key for this specific frame
            const gridDimensions = `${this.columnSizes.join(',')}_${this.rowSizes.join(',')}`;
            const containerRect = this.gridContainer.getBoundingClientRect();
            const cacheKey = `${dataUrl}_${currentFitMode}_${gridDimensions}_${Math.round(containerRect.width)}_${Math.round(containerRect.height)}`;
            
            // Only process if not cached, otherwise skip heavy processing during playback
            if (this.processedImageCache.has(cacheKey)) {
                this.applyCachedImageMode(currentFitMode, this.processedImageCache.get(cacheKey));
                return;
            }
        }
        
        // For simple modes or uncached heavy modes, load normally  
        const gridItems = document.querySelectorAll('#gridContainer .grid-item');
        
        gridItems.forEach(cellElement => {
            const imageWrapper = cellElement.querySelector('.image-wrapper');
            const cellLabel = cellElement.querySelector('.cell-label');
            
            const existingImg = imageWrapper.querySelector('img');
            if (existingImg) {
                existingImg.src = dataUrl; // Update existing image src for better performance
            } else {
                const img = document.createElement('img');
                img.src = dataUrl;
                img.alt = `Image in cell ${cellElement.getAttribute('data-cell')}`;
                imageWrapper.appendChild(img);
            }
            cellLabel.classList.add('hidden');
        });
        
        // Apply fit mode without heavy debouncing for cached results
        if (['debug-corners', 'background', 'single-corner-stretch'].includes(currentFitMode)) {
            // Skip heavy processing during rapid sequence playback
            return;
        } else {
            // Apply simple fit modes immediately
            this.setImageFitMode(currentFitMode);
        }
    }
    
    startAutoPlay() {
        this.stopAutoPlay(); // Clear any existing timer
        
        if (this.imageSequence.length <= 1) return;
        
        // 30 FPS = 1000ms / 30 = 33.33ms per frame
        const interval = 1000 / 30;
        
        this.sequenceTimer = setInterval(() => {
            this.nextSequenceImage();
        }, interval);
    }
    
    stopAutoPlay() {
        if (this.sequenceTimer) {
            clearInterval(this.sequenceTimer);
            this.sequenceTimer = null;
        }
    }
    
    nextSequenceImage() {
        if (this.imageSequence.length === 0) return;
        
        let nextIndex = this.currentSequenceIndex + 1;
        
        // Always loop infinitely
        if (nextIndex >= this.imageSequence.length) {
            nextIndex = 0;
        }
        
        this.showSequenceImage(nextIndex);
    }
    

    
    clearImageSequence() {
        this.stopAutoPlay();
        this.imageSequence = [];
        this.preloadedImages.clear();
        this.currentSequenceIndex = 0;
        
        // Clear processed sequences
        this.processedSequences.clear();
        this.currentProcessedSequence = null;
        this.currentProcessedMode = null;
        this.currentProcessedIndex = 0;
        this.isProcessingSequence = false;
        
        // Clear video recording cache
        this.preCalculatedFrames = [];
        this.isPreCalculating = false;
        
        const sequenceInfo = document.getElementById('sequenceInfo');
        sequenceInfo.style.display = 'none';
        
        // Restore full dropdown options when sequence is cleared
        this.updateFitModeDropdown(false);
        
        console.log('Image sequence cleared');
    }
    
    // Async processing methods for heavy image modes
    async processDebugCornersMode() {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                const ctx = tempCanvas.getContext('2d');
                
                tempCanvas.width = img.naturalWidth;
                tempCanvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);
                
                const quarterWidth = Math.floor(tempCanvas.width / 2);
                const quarterHeight = Math.floor(tempCanvas.height / 2);
                
                const result = {
                    mode: 'debug-corners',
                    cornerSlices: {},
                    edgeStretches: {},
                    centerColor: null
                };
                
                // Create corner slices
                result.cornerSlices.topLeft = this.createSliceDataUrl(ctx, 0, 0, quarterWidth, quarterHeight);
                result.cornerSlices.topRight = this.createSliceDataUrl(ctx, quarterWidth, 0, quarterWidth, quarterHeight);
                result.cornerSlices.bottomLeft = this.createSliceDataUrl(ctx, 0, quarterHeight, quarterWidth, quarterHeight);
                result.cornerSlices.bottomRight = this.createSliceDataUrl(ctx, quarterWidth, quarterHeight, quarterWidth, quarterHeight);
                
                // Create edge stretches
                result.edgeStretches.left = this.createSliceDataUrl(ctx, 0, quarterHeight, quarterWidth, 1);
                result.edgeStretches.right = this.createSliceDataUrl(ctx, quarterWidth, quarterHeight, quarterWidth, 1);
                result.edgeStretches.top = this.createSliceDataUrl(ctx, quarterWidth - 1, 0, 1, quarterHeight);
                result.edgeStretches.bottom = this.createSliceDataUrl(ctx, quarterWidth - 1, quarterHeight, 1, quarterHeight);
                
                // Get center color
                const centerPixelData = ctx.getImageData(quarterWidth, quarterHeight, 1, 1);
                const pixel = centerPixelData.data;
                result.centerColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
                
                resolve(result);
            };
            img.src = this.currentImageDataUrl;
        });
    }
    
    async processBackgroundMode() {
        return new Promise((resolve) => {
            const tempImg = new Image();
            tempImg.onload = () => {
                const sourceCanvas = document.createElement('canvas');
                const sourceCtx = sourceCanvas.getContext('2d');
                
                const containerRect = this.gridContainer.getBoundingClientRect();
                const containerWidth = containerRect.width - 4;
                const containerHeight = containerRect.height - 4;
                
                sourceCanvas.width = containerWidth;
                sourceCanvas.height = containerHeight;
                sourceCtx.drawImage(tempImg, 0, 0, containerWidth, containerHeight);
                
                // Calculate grid positions
                const totalColumnFr = this.columnSizes.reduce((sum, size) => sum + size, 0);
                const totalRowFr = this.rowSizes.reduce((sum, size) => sum + size, 0);
                
                let colPositions = [0];
                let currentColPos = 0;
                for (let i = 0; i < this.columnSizes.length; i++) {
                    currentColPos += (this.columnSizes[i] / totalColumnFr) * containerWidth;
                    colPositions.push(currentColPos);
                }
                
                let rowPositions = [0];
                let currentRowPos = 0;
                for (let i = 0; i < this.rowSizes.length; i++) {
                    currentRowPos += (this.rowSizes[i] / totalRowFr) * containerHeight;
                    rowPositions.push(currentRowPos);
                }
                
                const result = {
                    mode: 'background',
                    slices: []
                };
                
                // Create slices for each cell
                const totalCells = this.columnSizes.length * this.rowSizes.length;
                for (let cellNumber = 1; cellNumber <= totalCells; cellNumber++) {
                    const col = (cellNumber - 1) % this.columnSizes.length;
                    const row = Math.floor((cellNumber - 1) / this.columnSizes.length);
                    
                    const left = Math.round(colPositions[col]);
                    const right = Math.round(colPositions[col + 1]);
                    const top = Math.round(rowPositions[row]);
                    const bottom = Math.round(rowPositions[row + 1]);
                    
                    const sliceWidth = right - left;
                    const sliceHeight = bottom - top;
                    
                    const sliceDataUrl = this.createSliceFromCanvas(sourceCtx, left, top, sliceWidth, sliceHeight);
                    
                    result.slices.push({
                        cellNumber: cellNumber,
                        dataUrl: sliceDataUrl
                    });
                }
                
                resolve(result);
            };
            tempImg.src = this.currentImageDataUrl;
        });
    }
    
    async processSingleCornerStretchMode() {
        // First get the background slices
        const backgroundResult = await this.processBackgroundMode();
        
        // Then apply corner stretch to each slice
        const result = {
            mode: 'single-corner-stretch',
            processedSlices: []
        };
        
        for (let slice of backgroundResult.slices) {
            const processedSlice = await this.applyCornerStretchToDataUrl(slice.dataUrl);
            result.processedSlices.push({
                cellNumber: slice.cellNumber,
                dataUrl: processedSlice
            });
        }
        
        return result;
    }
    
    createSliceDataUrl(ctx, x, y, width, height) {
        const canvas = document.createElement('canvas');
        const canvasCtx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        const imageData = ctx.getImageData(x, y, width, height);
        canvasCtx.putImageData(imageData, 0, 0);
        
        return canvas.toDataURL();
    }
    
    createSliceFromCanvas(sourceCtx, left, top, width, height) {
        const sliceCanvas = document.createElement('canvas');
        const sliceCtx = sliceCanvas.getContext('2d');
        sliceCanvas.width = width;
        sliceCanvas.height = height;
        
        const imageData = sourceCtx.getImageData(left, top, width, height);
        sliceCtx.putImageData(imageData, 0, 0);
        
        return sliceCanvas.toDataURL();
    }
    
    async applyCornerStretchToDataUrl(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw original image first
                ctx.drawImage(img, 0, 0);
                
                // Apply corner stretch effect
                // Get the top-left corner pixel
                const cornerPixelData = ctx.getImageData(0, 0, 1, 1);
                const cornerPixel = cornerPixelData.data;
                const cornerColor = `rgb(${cornerPixel[0]}, ${cornerPixel[1]}, ${cornerPixel[2]})`;
                
                // Create a gradient from corner color to the image
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // Apply corner stretch effect - blend corner color with original image
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const index = (y * canvas.width + x) * 4;
                        
                        // Calculate distance from corner (0,0)
                        const distance = Math.sqrt(x * x + y * y);
                        const maxDistance = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
                        const blendFactor = Math.min(distance / maxDistance, 1.0);
                        
                        // Blend corner color with original pixel based on distance
                        data[index] = cornerPixel[0] * (1 - blendFactor) + data[index] * blendFactor;     // Red
                        data[index + 1] = cornerPixel[1] * (1 - blendFactor) + data[index + 1] * blendFactor; // Green
                        data[index + 2] = cornerPixel[2] * (1 - blendFactor) + data[index + 2] * blendFactor; // Blue
                        // Alpha stays the same
                    }
                }
                
                // Put the modified image data back
                ctx.putImageData(imageData, 0, 0);
                
                resolve(canvas.toDataURL());
            };
            img.src = dataUrl;
        });
    }
    
    applyCachedImageMode(mode, cachedResult) {
        switch(mode) {
            case 'debug-corners':
                this.applyDebugCornersResult(cachedResult);
                break;
            case 'background':
                this.applyBackgroundResult(cachedResult);
                break;
            case 'single-corner-stretch':
                this.applySingleCornerStretchResult(cachedResult);
                break;
        }
    }
    
    applyDebugCornersResult(result) {
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        imageWrappers.forEach(wrapper => {
            wrapper.classList.add('debug-corners');
            
            // Create corner slices
            this.createCachedCornerSlice(wrapper, result.cornerSlices.topLeft, 'top-left');
            this.createCachedCornerSlice(wrapper, result.cornerSlices.topRight, 'top-right');
            this.createCachedCornerSlice(wrapper, result.cornerSlices.bottomLeft, 'bottom-left');
            this.createCachedCornerSlice(wrapper, result.cornerSlices.bottomRight, 'bottom-right');
            
            // Create edge stretches
            this.createCachedEdgeStretch(wrapper, result.edgeStretches.left, 'left', 'vertical');
            this.createCachedEdgeStretch(wrapper, result.edgeStretches.right, 'right', 'vertical');
            this.createCachedEdgeStretch(wrapper, result.edgeStretches.top, 'top', 'horizontal');
            this.createCachedEdgeStretch(wrapper, result.edgeStretches.bottom, 'bottom', 'horizontal');
            
            // Create center area
            this.createCachedCenterArea(wrapper, result.centerColor);
        });
    }
    
    applyBackgroundResult(result) {
        // Hide original images and show sliced versions
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        
        result.slices.forEach(slice => {
            const cellElement = document.querySelector(`[data-cell="${slice.cellNumber}"]`);
            if (cellElement) {
                const wrapper = cellElement.querySelector('.image-wrapper');
                wrapper.innerHTML = '';
                
                const sliceImg = document.createElement('img');
                sliceImg.src = slice.dataUrl;
                sliceImg.style.width = '100%';
                sliceImg.style.height = '100%';
                sliceImg.style.display = 'block';
                
                wrapper.appendChild(sliceImg);
            }
        });
        
        // Hide cell labels
        const cellLabels = document.querySelectorAll('#gridContainer .cell-label');
        cellLabels.forEach(label => {
            label.classList.add('hidden');
        });
    }
    
    applySingleCornerStretchResult(result) {
        // Apply the processed slices
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        
        result.processedSlices.forEach(slice => {
            const cellElement = document.querySelector(`[data-cell="${slice.cellNumber}"]`);
            if (cellElement) {
                const wrapper = cellElement.querySelector('.image-wrapper');
                wrapper.innerHTML = '';
                
                const sliceImg = document.createElement('img');
                sliceImg.src = slice.dataUrl;
                sliceImg.style.width = '100%';
                sliceImg.style.height = '100%';
                sliceImg.style.display = 'block';
                
                wrapper.appendChild(sliceImg);
            }
        });
        
        // Hide cell labels
        const cellLabels = document.querySelectorAll('#gridContainer .cell-label');
        cellLabels.forEach(label => {
            label.classList.add('hidden');
        });
    }
    
    createCachedCornerSlice(wrapper, dataUrl, position) {
        const div = document.createElement('div');
        div.className = `debug-corner-slice ${position}`;
        div.style.backgroundImage = `url("${dataUrl}")`;
        wrapper.appendChild(div);
    }
    
    createCachedEdgeStretch(wrapper, dataUrl, position, direction) {
        const div = document.createElement('div');
        div.className = `debug-${direction}-stretch ${position}-stretch`;
        div.style.position = 'absolute';
        div.style.backgroundImage = `url("${dataUrl}")`;
        div.style.backgroundRepeat = direction === 'vertical' ? 'repeat-y' : 'repeat-x';
        div.style.zIndex = '10';
        
        // Position the stretch elements
        if (direction === 'vertical') {
            div.style[position] = '0px';
            div.style.top = '50px';
            div.style.width = '50px';
            div.style.height = 'calc(100% - 100px)';
            div.style.backgroundSize = '50px 1px';
        } else {
            div.style[position] = '0px';
            div.style.left = '50px';
            div.style.width = 'calc(100% - 100px)';
            div.style.height = '50px';
            div.style.backgroundSize = '1px 50px';
        }
        
        wrapper.appendChild(div);
    }
    
    createCachedCenterArea(wrapper, centerColor) {
        const centerDiv = document.createElement('div');
        centerDiv.className = 'debug-center-area';
        centerDiv.style.position = 'absolute';
        centerDiv.style.left = '50px';
        centerDiv.style.top = '50px';
        centerDiv.style.width = 'calc(100% - 100px)';
        centerDiv.style.height = 'calc(100% - 100px)';
        centerDiv.style.backgroundColor = centerColor;
        centerDiv.style.zIndex = '5';
        
        wrapper.appendChild(centerDiv);
    }
    
    async preProcessImageSequence(mode) {
        if (this.isProcessingSequence) {
            console.log('Already processing sequence');
            return;
        }
        
        // Create sequence key for caching
        const gridDimensions = `${this.columnSizes.join(',')}_${this.rowSizes.join(',')}`;
        const containerRect = this.gridContainer.getBoundingClientRect();
        const sequenceKey = `${mode}_${gridDimensions}_${Math.round(containerRect.width)}_${Math.round(containerRect.height)}_${this.imageSequence.length}`;
        
        // Check if we already have this processed sequence
        if (this.processedSequences.has(sequenceKey)) {
            console.log(`Using cached processed sequence for ${mode}`);
            this.useProcessedSequence(mode, this.processedSequences.get(sequenceKey));
            return;
        }
        
        this.isProcessingSequence = true;
        this.stopAutoPlay(); // Stop current playback
        
        const sequenceStatus = document.getElementById('sequenceStatus');
        const originalStatusText = sequenceStatus.textContent;
        
        try {
            sequenceStatus.textContent = `Processing ${mode} mode: 0/${this.imageSequence.length} frames...`;
            
            const processedSequence = [];
            
            // Process each frame in the sequence
            for (let i = 0; i < this.imageSequence.length; i++) {
                const frame = this.imageSequence[i];
                sequenceStatus.textContent = `Processing ${mode} mode: ${i + 1}/${this.imageSequence.length} frames...`;
                
                // Set current image temporarily for processing
                const oldImageDataUrl = this.currentImageDataUrl;
                this.currentImageDataUrl = frame.dataUrl;
                
                let processedResult = null;
                
                switch(mode) {
                    case 'debug-corners':
                        processedResult = await this.processDebugCornersMode();
                        break;
                    case 'background':
                        processedResult = await this.processBackgroundMode();
                        break;
                    case 'single-corner-stretch':
                        processedResult = await this.processSingleCornerStretchMode();
                        break;
                }
                
                if (processedResult) {
                    processedSequence.push({
                        originalFrame: frame,
                        processedResult: processedResult,
                        frameIndex: i
                    });
                }
                
                // Restore original current image
                this.currentImageDataUrl = oldImageDataUrl;
                
                // Small delay to prevent blocking UI
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Cache the processed sequence
            this.processedSequences.set(sequenceKey, processedSequence);
            
            // Start using the processed sequence
            this.useProcessedSequence(mode, processedSequence);
            
            sequenceStatus.textContent = `${this.imageSequence.length} frames • Playing processed ${mode} at 30 FPS`;
            console.log(`Sequence pre-processing complete for ${mode} mode`);
            
        } catch (error) {
            console.error('Error processing sequence:', error);
            sequenceStatus.textContent = originalStatusText;
            // Fallback to original sequence
            this.startAutoPlay();
        } finally {
            this.isProcessingSequence = false;
        }
    }
    
    useProcessedSequence(mode, processedSequence) {
        this.currentProcessedSequence = processedSequence;
        this.currentProcessedMode = mode;
        this.currentProcessedIndex = 0;
        
        // Show first processed frame
        this.showProcessedFrame(0);
        
        // Start processed sequence playback
        this.startProcessedSequencePlayback();
    }
    
    showProcessedFrame(index) {
        if (!this.currentProcessedSequence || index >= this.currentProcessedSequence.length) return;
        
        const processedFrame = this.currentProcessedSequence[index];
        this.currentProcessedIndex = index;
        
        // Apply the processed result directly (no re-processing needed)
        this.applyCachedImageMode(this.currentProcessedMode, processedFrame.processedResult);
    }
    
    startProcessedSequencePlayback() {
        this.stopAutoPlay(); // Stop any existing playback
        
        if (!this.currentProcessedSequence || this.currentProcessedSequence.length <= 1) return;
        
        // 30 FPS = 1000ms / 30 = 33.33ms per frame
        const interval = 1000 / 30;
        
        this.sequenceTimer = setInterval(() => {
            this.nextProcessedFrame();
        }, interval);
    }
    
    nextProcessedFrame() {
        if (!this.currentProcessedSequence || this.currentProcessedSequence.length === 0) return;
        
        let nextIndex = this.currentProcessedIndex + 1;
        
        // Always loop infinitely
        if (nextIndex >= this.currentProcessedSequence.length) {
            nextIndex = 0;
        }
        
        this.showProcessedFrame(nextIndex);
    }
    
    setImageFitMode(mode) {
        console.log('setImageFitMode called with mode:', mode);
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        
        // Clear previous states
        this.clearImageBackground();
        imageWrappers.forEach(wrapper => {
            wrapper.classList.remove('fit-contain', 'fit-cover', 'debug-corners');
            this.clearDebugElements(wrapper);
        });
        
        // Handle simple modes immediately
        const isSimpleMode = ['fill', 'contain', 'cover'].includes(mode);
        
        if (isSimpleMode) {
            // If switching from processed sequence back to simple mode, revert to original sequence
            if (this.currentProcessedSequence && this.imageSequence.length > 1) {
                this.currentProcessedSequence = null;
                this.currentProcessedMode = null;
                this.startAutoPlay(); // Resume original sequence playback
            }
            
            switch(mode) {
                case 'fill':
                    console.log('Image fit mode: Stretch to Fill Cell');
                    return;
                case 'contain':
                    imageWrappers.forEach(wrapper => {
                        wrapper.classList.add('fit-contain');
                    });
                    console.log('Image fit mode: Fit Within Cell');
                    return;
                case 'cover':
                    imageWrappers.forEach(wrapper => {
                        wrapper.classList.add('fit-cover');
                    });
                    console.log('Image fit mode: Fill Cell Completely');
                    return;
            }
        }
        
        // Handle heavy processing modes with caching and debouncing
        this.setHeavyImageFitMode(mode);
    }
    
    setHeavyImageFitMode(mode) {
        if (!this.currentImageDataUrl) return;
        
        // If we have an active image sequence, pre-process the entire sequence
        if (this.imageSequence.length > 1) {
            this.preProcessImageSequence(mode);
            return;
        }
        
        // For single images, use the existing cache system
        const gridDimensions = `${this.columnSizes.join(',')}_${this.rowSizes.join(',')}`;
        const containerRect = this.gridContainer.getBoundingClientRect();
        const cacheKey = `${this.currentImageDataUrl}_${mode}_${gridDimensions}_${Math.round(containerRect.width)}_${Math.round(containerRect.height)}`;
        
        // Check if we have cached result
        if (this.processedImageCache.has(cacheKey)) {
            console.log(`Using cached result for ${mode}`);
            this.applyCachedImageMode(mode, this.processedImageCache.get(cacheKey));
            return;
        }
        
        // Debounce heavy processing to prevent flickering during rapid changes
        if (this.processingDebounceTimer) {
            clearTimeout(this.processingDebounceTimer);
        }
        
        // Show loading state for heavy modes
        this.showProcessingState(mode);
        
        this.processingDebounceTimer = setTimeout(() => {
            this.processHeavyImageMode(mode, cacheKey);
        }, 100); // 100ms debounce
    }
    
    showProcessingState(mode) {
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        imageWrappers.forEach(wrapper => {
            wrapper.style.opacity = '0.7';
        });
        console.log(`Processing ${mode} mode...`);
    }
    
    async processHeavyImageMode(mode, cacheKey) {
        try {
            let result = null;
            
            switch(mode) {
                case 'debug-corners':
                    result = await this.processDebugCornersMode();
                    break;
                case 'background':
                    result = await this.processBackgroundMode();
                    break;
                case 'single-corner-stretch':
                    result = await this.processSingleCornerStretchMode();
                    break;
            }
            
            if (result) {
                // Cache the result
                this.processedImageCache.set(cacheKey, result);
                
                // Apply the result
                this.applyCachedImageMode(mode, result);
                console.log(`${mode} mode processed and cached`);
            }
            
        } catch (error) {
            console.error(`Error processing ${mode} mode:`, error);
            // Fallback to basic mode
            this.setImageFitMode('fill');
        }
        
        // Remove loading state
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        imageWrappers.forEach(wrapper => {
            wrapper.style.opacity = '1';
        });
    }
    
    setupDebugCorners(wrapper) {
        const img = wrapper.querySelector('img');
        
        if (!img || !img.src) {
            return;
        }
        
        wrapper.classList.add('debug-corners');
        
        const createCornerSlices = () => {
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            
            tempCanvas.width = img.naturalWidth;
            tempCanvas.height = img.naturalHeight;
            
            if (tempCanvas.width === 0 || tempCanvas.height === 0) {
                return;
            }
            
            ctx.drawImage(img, 0, 0);
            
            const quarterWidth = Math.floor(tempCanvas.width / 2);
            const quarterHeight = Math.floor(tempCanvas.height / 2);
            
            // Create corner slices
            this.createCornerSlice(wrapper, ctx, 0, 0, quarterWidth, quarterHeight, 'top-left');
            this.createCornerSlice(wrapper, ctx, quarterWidth, 0, quarterWidth, quarterHeight, 'top-right');
            this.createCornerSlice(wrapper, ctx, 0, quarterHeight, quarterWidth, quarterHeight, 'bottom-left');
            this.createCornerSlice(wrapper, ctx, quarterWidth, quarterHeight, quarterWidth, quarterHeight, 'bottom-right');
            
            // Create edge stretches
            this.createEdgeStretches(wrapper, ctx, quarterWidth, quarterHeight);
            
            // Create center area
            this.createCenterArea(wrapper, ctx, quarterWidth, quarterHeight);
        };
        
        if (img.complete && img.naturalWidth > 0) {
            createCornerSlices();
        } else {
            img.onload = createCornerSlices;
        }
    }
    
    createCornerSlice(wrapper, ctx, x, y, width, height, position) {
        const canvas = document.createElement('canvas');
        const canvasCtx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        const imageData = ctx.getImageData(x, y, width, height);
        canvasCtx.putImageData(imageData, 0, 0);
        
        const div = document.createElement('div');
        div.className = `debug-corner-slice ${position}`;
        div.style.backgroundImage = `url("${canvas.toDataURL()}")`;
        wrapper.appendChild(div);
    }
    
    createEdgeStretches(wrapper, ctx, quarterWidth, quarterHeight) {
        // Left edge
        this.createEdgeStretch(wrapper, ctx, 0, quarterHeight, quarterWidth, 1, 'left', 'vertical');
        // Right edge
        this.createEdgeStretch(wrapper, ctx, quarterWidth, quarterHeight, quarterWidth, 1, 'right', 'vertical');
        // Top edge
        this.createEdgeStretch(wrapper, ctx, quarterWidth - 1, 0, 1, quarterHeight, 'top', 'horizontal');
        // Bottom edge
        this.createEdgeStretch(wrapper, ctx, quarterWidth - 1, quarterHeight, 1, quarterHeight, 'bottom', 'horizontal');
    }
    
    createEdgeStretch(wrapper, ctx, x, y, width, height, position, direction) {
        const canvas = document.createElement('canvas');
        const canvasCtx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        const imageData = ctx.getImageData(x, y, width, height);
        canvasCtx.putImageData(imageData, 0, 0);
        
        const div = document.createElement('div');
        div.className = `debug-${direction}-stretch ${position}-stretch`;
        div.style.position = 'absolute';
        div.style.backgroundImage = `url("${canvas.toDataURL()}")`;
        div.style.backgroundRepeat = direction === 'vertical' ? 'repeat-y' : 'repeat-x';
        div.style.zIndex = '10';
        
        // Position the stretch elements
        if (direction === 'vertical') {
            div.style[position] = '0px';
            div.style.top = '50px';
            div.style.width = '50px';
            div.style.height = 'calc(100% - 100px)';
            div.style.backgroundSize = '50px 1px';
        } else {
            div.style[position] = '0px';
            div.style.left = '50px';
            div.style.width = 'calc(100% - 100px)';
            div.style.height = '50px';
            div.style.backgroundSize = '1px 50px';
        }
        
        wrapper.appendChild(div);
    }
    
    createCenterArea(wrapper, ctx, quarterWidth, quarterHeight) {
        const centerPixelData = ctx.getImageData(quarterWidth, quarterHeight, 1, 1);
        const pixel = centerPixelData.data;
        const centerColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        
        const centerDiv = document.createElement('div');
        centerDiv.className = 'debug-center-area';
        centerDiv.style.position = 'absolute';
        centerDiv.style.left = '50px';
        centerDiv.style.top = '50px';
        centerDiv.style.width = 'calc(100% - 100px)';
        centerDiv.style.height = 'calc(100% - 100px)';
        centerDiv.style.backgroundColor = centerColor;
        centerDiv.style.zIndex = '5';
        
        wrapper.appendChild(centerDiv);
    }
    
    clearDebugElements(wrapper) {
        const debugElements = wrapper.querySelectorAll('.debug-corner-slice, .debug-vertical-stretch, .debug-horizontal-stretch, .debug-center-area');
        debugElements.forEach(element => element.remove());
    }
    
    setupImageBackground() {
        if (!this.currentImageDataUrl) {
            return;
        }
        
        this.gridContainer.style.backgroundImage = `url("${this.currentImageDataUrl}")`;
        this.gridContainer.style.backgroundSize = '100% 100%';
        this.gridContainer.style.backgroundPosition = 'center';
        this.gridContainer.style.backgroundRepeat = 'no-repeat';
        
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        imageWrappers.forEach(wrapper => {
            const img = wrapper.querySelector('img');
            if (img) {
                img.style.display = 'none';
            }
        });
        
        const gridItems = document.querySelectorAll('#gridContainer .grid-item');
        gridItems.forEach(item => {
            item.style.backgroundColor = 'transparent';
        });
        
        const cellLabels = document.querySelectorAll('#gridContainer .cell-label');
        cellLabels.forEach(label => {
            label.classList.add('hidden');
        });
        
        this.sliceImageIntoGrid();
    }
    
    sliceImageIntoGrid() {
        if (!this.currentImageDataUrl) return;
        
        const tempImg = new Image();
        tempImg.onload = () => {
            const sourceCanvas = document.createElement('canvas');
            const sourceCtx = sourceCanvas.getContext('2d');
            
            const containerRect = this.gridContainer.getBoundingClientRect();
            const containerWidth = containerRect.width - 4;
            const containerHeight = containerRect.height - 4;
            
            sourceCanvas.width = containerWidth;
            sourceCanvas.height = containerHeight;
            
            sourceCtx.drawImage(tempImg, 0, 0, containerWidth, containerHeight);
            
            // Calculate grid positions
            const totalColumnFr = this.columnSizes.reduce((sum, size) => sum + size, 0);
            const totalRowFr = this.rowSizes.reduce((sum, size) => sum + size, 0);
            
            let colPositions = [0];
            let currentColPos = 0;
            for (let i = 0; i < this.columnSizes.length; i++) {
                currentColPos += (this.columnSizes[i] / totalColumnFr) * containerWidth;
                colPositions.push(currentColPos);
            }
            
            let rowPositions = [0];
            let currentRowPos = 0;
            for (let i = 0; i < this.rowSizes.length; i++) {
                currentRowPos += (this.rowSizes[i] / totalRowFr) * containerHeight;
                rowPositions.push(currentRowPos);
            }
            
            // Create slices for each cell
            const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
            imageWrappers.forEach((wrapper, index) => {
                const cellElement = wrapper.closest('.grid-item');
                const cellNumber = parseInt(cellElement.getAttribute('data-cell'));
                
                const col = (cellNumber - 1) % this.columnSizes.length;
                const row = Math.floor((cellNumber - 1) / this.columnSizes.length);
                
                const left = Math.round(colPositions[col]);
                const right = Math.round(colPositions[col + 1]);
                const top = Math.round(rowPositions[row]);
                const bottom = Math.round(rowPositions[row + 1]);
                
                const sliceWidth = right - left;
                const sliceHeight = bottom - top;
                
                const sliceCanvas = document.createElement('canvas');
                const sliceCtx = sliceCanvas.getContext('2d');
                sliceCanvas.width = sliceWidth;
                sliceCanvas.height = sliceHeight;
                
                const imageData = sourceCtx.getImageData(left, top, sliceWidth, sliceHeight);
                sliceCtx.putImageData(imageData, 0, 0);
                
                wrapper.innerHTML = '';
                const sliceImg = document.createElement('img');
                sliceImg.src = sliceCanvas.toDataURL();
                sliceImg.style.width = '100%';
                sliceImg.style.height = '100%';
                sliceImg.style.display = 'block';
                
                wrapper.appendChild(sliceImg);
            });
            
            this.gridContainer.style.backgroundImage = '';
        };
        
        tempImg.src = this.currentImageDataUrl;
    }
    
    clearImageBackground() {
        this.gridContainer.style.backgroundImage = '';
        this.gridContainer.style.backgroundSize = '';
        this.gridContainer.style.backgroundPosition = '';
        this.gridContainer.style.backgroundRepeat = '';
        
        if (this.currentImageDataUrl) {
            const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
            imageWrappers.forEach(wrapper => {
                wrapper.innerHTML = '';
                
                const img = document.createElement('img');
                img.src = this.currentImageDataUrl;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.display = 'block';
                
                wrapper.appendChild(img);
            });
        }
        
        const gridItems = document.querySelectorAll('#gridContainer .grid-item');
        gridItems.forEach(item => {
            item.style.backgroundColor = '';
        });
        
        const cellLabels = document.querySelectorAll('#gridContainer .cell-label');
        cellLabels.forEach(label => {
            label.classList.add('hidden');
        });
    }
    
    setupSingleCornerStretch() {
        if (!this.currentImageDataUrl) {
            return;
        }
        
        this.resetGridToEvenDistribution();
        
        const gridItems = document.querySelectorAll('#gridContainer .grid-item');
        gridItems.forEach(item => {
            item.style.backgroundColor = 'transparent';
        });
        
        const cellLabels = document.querySelectorAll('#gridContainer .cell-label');
        cellLabels.forEach(label => {
            label.classList.add('hidden');
        });
        
        setTimeout(() => {
            this.sliceImageIntoGridThenApplyCornerStretch();
        }, 50);
    }
    
    sliceImageIntoGridThenApplyCornerStretch() {
        if (!this.currentImageDataUrl) return;
        
        const tempImg = new Image();
        tempImg.onload = () => {
            // Use same slicing logic as regular slice
            const sourceCanvas = document.createElement('canvas');
            const sourceCtx = sourceCanvas.getContext('2d');
            
            const containerRect = this.gridContainer.getBoundingClientRect();
            const containerWidth = containerRect.width - 4;
            const containerHeight = containerRect.height - 4;
            
            sourceCanvas.width = containerWidth;
            sourceCanvas.height = containerHeight;
            
            sourceCtx.drawImage(tempImg, 0, 0, containerWidth, containerHeight);
            
            const totalColumnFr = this.columnSizes.reduce((sum, size) => sum + size, 0);
            const totalRowFr = this.rowSizes.reduce((sum, size) => sum + size, 0);
            
            let colPositions = [0];
            let currentColPos = 0;
            for (let i = 0; i < this.columnSizes.length; i++) {
                currentColPos += (this.columnSizes[i] / totalColumnFr) * containerWidth;
                colPositions.push(currentColPos);
            }
            
            let rowPositions = [0];
            let currentRowPos = 0;
            for (let i = 0; i < this.rowSizes.length; i++) {
                currentRowPos += (this.rowSizes[i] / totalRowFr) * containerHeight;
                rowPositions.push(currentRowPos);
            }
            
            const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
            imageWrappers.forEach((wrapper, index) => {
                const cellElement = wrapper.closest('.grid-item');
                const cellNumber = parseInt(cellElement.getAttribute('data-cell'));
                
                const col = (cellNumber - 1) % this.columnSizes.length;
                const row = Math.floor((cellNumber - 1) / this.columnSizes.length);
                
                const left = Math.round(colPositions[col]);
                const right = Math.round(colPositions[col + 1]);
                const top = Math.round(rowPositions[row]);
                const bottom = Math.round(rowPositions[row + 1]);
                
                const sliceWidth = right - left;
                const sliceHeight = bottom - top;
                
                const sliceCanvas = document.createElement('canvas');
                const sliceCtx = sliceCanvas.getContext('2d');
                sliceCanvas.width = sliceWidth;
                sliceCanvas.height = sliceHeight;
                
                const imageData = sourceCtx.getImageData(left, top, sliceWidth, sliceHeight);
                sliceCtx.putImageData(imageData, 0, 0);
                
                wrapper.innerHTML = '';
                
                const sliceDataUrl = sliceCanvas.toDataURL();
                const tempSliceImg = document.createElement('img');
                tempSliceImg.src = sliceDataUrl;
                
                tempSliceImg.onload = () => {
                    this.applyCornerStretchToSlice(wrapper, tempSliceImg);
                };
            });
        };
        
        tempImg.src = this.currentImageDataUrl;
    }
    
    applyCornerStretchToSlice(wrapper, sliceImg) {
        wrapper.classList.add('debug-corners');
        
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        
        tempCanvas.width = sliceImg.naturalWidth;
        tempCanvas.height = sliceImg.naturalHeight;
        
        if (tempCanvas.width === 0 || tempCanvas.height === 0) {
            return;
        }
        
        ctx.drawImage(sliceImg, 0, 0);
        
        const quarterWidth = Math.floor(tempCanvas.width / 2);
        const quarterHeight = Math.floor(tempCanvas.height / 2);
        
        // Create corner stretch elements using existing methods
        this.createCornerSlice(wrapper, ctx, 0, 0, quarterWidth, quarterHeight, 'top-left');
        this.createCornerSlice(wrapper, ctx, quarterWidth, 0, quarterWidth, quarterHeight, 'top-right');
        this.createCornerSlice(wrapper, ctx, 0, quarterHeight, quarterWidth, quarterHeight, 'bottom-left');
        this.createCornerSlice(wrapper, ctx, quarterWidth, quarterHeight, quarterWidth, quarterHeight, 'bottom-right');
        
        this.createEdgeStretches(wrapper, ctx, quarterWidth, quarterHeight);
        this.createCenterArea(wrapper, ctx, quarterWidth, quarterHeight);
    }
    
    resetGridToEvenDistribution() {
        const numColumns = this.columnSizes.length;
        this.columnSizes = new Array(numColumns).fill(1);
        
        const numRows = this.rowSizes.length;
        this.rowSizes = new Array(numRows).fill(1);
        
        this.baseColumnSizes = [...this.columnSizes];
        this.baseRowSizes = [...this.rowSizes];
        
        this.updateGridColumns();
        this.updateGridRows();
        this.updateSplitterPositions();
    }
    
    setupGridControls() {
        const clearAllBtn = document.getElementById('clearAllBtn');
        const imageFitModeSelect = document.getElementById('imageFitMode');
        const showSplittersCheckbox = document.getElementById('showSplitters');
        
        clearAllBtn.addEventListener('click', () => {
            this.clearAllImages();
        });
        
        // Note: imageFitMode change handler is set up in setupImageFitModeDropdown()
        
        showSplittersCheckbox.addEventListener('change', (e) => {
            this.toggleSplitterVisibility(e.target.checked);
        });
        
        this.updateGridControlButtons();
    }
    
    setupCanvasSizeControls() {
        const canvasWidthInput = document.getElementById('canvasWidth');
        const canvasHeightInput = document.getElementById('canvasHeight');
        const applySizeBtn = document.getElementById('applySizeBtn');
        
        applySizeBtn.addEventListener('click', () => {
            const width = parseInt(canvasWidthInput.value) || 800;
            const height = parseInt(canvasHeightInput.value) || 600;
            this.updateCanvasSize(width, height);
        });
        
        [canvasWidthInput, canvasHeightInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applySizeBtn.click();
                }
            });
        });
    }
    
    setupAnimationControls() {
        const animationToggle = document.getElementById('animationToggle');
        const frequencySlider = document.getElementById('frequencySlider');
        const amplitudeSlider = document.getElementById('amplitudeSlider');
        const frequencyValue = document.getElementById('frequencyValue');
        const amplitudeValue = document.getElementById('amplitudeValue');

        
        animationToggle.addEventListener('change', (e) => {
            this.toggleAnimation(e.target.checked);
        });
        
        frequencySlider.addEventListener('input', (e) => {
            this.frequency = parseFloat(e.target.value);
            frequencyValue.textContent = this.frequency;
        });
        
        amplitudeSlider.addEventListener('input', (e) => {
            this.amplitude = parseFloat(e.target.value);
            amplitudeValue.textContent = this.amplitude;
        });
        
        // Animation axis controls
        const axisButtons = document.querySelectorAll('.axis-btn');
        axisButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                axisButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                // Set animation axis
                this.animationAxis = e.target.getAttribute('data-axis');
                console.log(`Animation axis set to: ${this.animationAxis.toUpperCase()}`);
            });
        });
        
        // Initialize animation axis from active button
        const activeAxis = document.querySelector('.axis-btn.active');
        this.animationAxis = activeAxis ? activeAxis.getAttribute('data-axis') : 'xy';
        
        // Animation type controls (noise/pulse)
        const typeButtons = document.querySelectorAll('.type-btn');
        const holdControlRow = document.getElementById('holdControlRow');
        const holdSlider = document.getElementById('holdSlider');
        const holdValue = document.getElementById('holdValue');
        
        typeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                typeButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                // Set animation type
                this.animationType = e.target.getAttribute('data-type');
                
                // Show/hide hold control based on type
                if (this.animationType === 'pulse') {
                    holdControlRow.style.display = 'flex';
                } else {
                    holdControlRow.style.display = 'none';
                }
                
                console.log(`Animation type set to: ${this.animationType.toUpperCase()}`);
            });
        });
        
        // Hold slider control
        holdSlider.addEventListener('input', (e) => {
            this.holdTime = parseFloat(e.target.value);
            holdValue.textContent = this.holdTime;
        });
        
        // Initialize animation type and hold time
        const activeType = document.querySelector('.type-btn.active');
        this.animationType = activeType ? activeType.getAttribute('data-type') : 'noise';
        this.holdTime = parseFloat(holdSlider.value);
    }
    
    addColumn() {
        this.columnSizes.push(1);
        this.baseColumnSizes.push(1);
        this.updateGridStructure();
        this.updateGridControlButtons();
    }
    
    removeColumn() {
        if (this.columnSizes.length > 1) {
            this.columnSizes.pop();
            this.baseColumnSizes.pop();
            this.updateGridStructure();
            this.updateGridControlButtons();
        }
    }
    
    addRow() {
        this.rowSizes.push(1);
        this.baseRowSizes.push(1);
        this.updateGridStructure();
        this.updateGridControlButtons();
    }
    
    removeRow() {
        if (this.rowSizes.length > 1) {
            this.rowSizes.pop();
            this.baseRowSizes.pop();
            this.updateGridStructure();
            this.updateGridControlButtons();
        }
    }
    
    updateGridControlButtons() {
        const columnCount = document.getElementById('columnCount');
        const rowCount = document.getElementById('rowCount');
        const removeColumnBtn = document.getElementById('removeColumnBtn');
        const removeRowBtn = document.getElementById('removeRowBtn');
        
        columnCount.textContent = this.columnSizes.length;
        rowCount.textContent = this.rowSizes.length;
        
        removeColumnBtn.disabled = this.columnSizes.length <= 1;
        removeRowBtn.disabled = this.rowSizes.length <= 1;
    }
    
    updateGridStructure() {
        // Clear image processing cache when grid structure changes
        this.processedImageCache.clear();
        
        const currentFitMode = document.getElementById('imageFitMode').value;
        
        document.documentElement.style.setProperty('--grid-columns', this.columnSizes.length);
        document.documentElement.style.setProperty('--grid-rows', this.rowSizes.length);
        
        this.updateGridColumns();
        this.updateGridRows();
        
        this.regenerateGridItems();
        this.regenerateSplitters();
        
        if (this.currentImageDataUrl) {
            this.loadImageFromDataUrl(this.currentImageDataUrl);
            
            setTimeout(() => {
                this.setImageFitMode(currentFitMode);
            }, 150);
        }
        
        setTimeout(() => {
            this.updateSplitterPositions();
        }, 200);
    }
    
    regenerateGridItems() {
        const existingItems = this.gridContainer.querySelectorAll('.grid-item');
        existingItems.forEach(item => item.remove());
        
        const totalCells = this.columnSizes.length * this.rowSizes.length;
        for (let i = 1; i <= totalCells; i++) {
            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item';
            gridItem.setAttribute('data-cell', i);
            
            gridItem.innerHTML = `
                <div class="cell-content">
                    <div class="image-wrapper">
                        <!-- Image will be inserted here -->
                    </div>
                    <div class="cell-label">${i}</div>
                </div>
            `;
            
            this.gridContainer.appendChild(gridItem);
        }
    }
    
    regenerateSplitters() {
        const existingSplitters = this.gridContainer.querySelectorAll('.splitter');
        existingSplitters.forEach(splitter => splitter.remove());
        
        // Create vertical splitters
        for (let i = 0; i < this.columnSizes.length - 1; i++) {
            const splitter = document.createElement('div');
            splitter.className = 'splitter vertical';
            splitter.setAttribute('data-index', i);
            this.gridContainer.appendChild(splitter);
        }
        
        // Create horizontal splitters
        for (let i = 0; i < this.rowSizes.length - 1; i++) {
            const splitter = document.createElement('div');
            splitter.className = 'splitter horizontal';
            splitter.setAttribute('data-index', i);
            this.gridContainer.appendChild(splitter);
        }
        
        this.setupSplitters();
    }
    
    updateCanvasSize(width, height) {
        super.updateCanvasSize(width, height);
        
        // Update input values to reflect any clamping
        document.getElementById('canvasWidth').value = width;
        document.getElementById('canvasHeight').value = height;
    }
    
    toggleSplitterVisibility(show) {
        if (show) {
            this.gridContainer.classList.remove('hide-splitters');
            console.log('Grid splitters shown');
        } else {
            this.gridContainer.classList.add('hide-splitters');
            console.log('Grid splitters hidden');
        }
    }
    
    setupExportControls() {
        const exportVideoBtn = document.getElementById('exportVideoBtn');
        
        exportVideoBtn.addEventListener('click', () => {
            this.promptAndStartRecording();
        });
    }
    
    setupHelpModal() {
        const helpModal = document.getElementById('helpModal');
        
        // Close modal when clicking outside the content
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                this.closeHelp();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const helpModal = document.getElementById('helpModal');
                if (helpModal.classList.contains('show')) {
                    this.closeHelp();
                }
            }
        });
    }
    
    promptAndStartRecording() {
        if (this.isRecording || this.isPreCalculating) {
            console.log('Already recording or calculating');
            return;
        }
        
        // Prompt user for duration
        const duration = prompt('Enter recording duration in seconds:', '5');
        
        if (duration === null) {
            return; // User cancelled
        }
        
        const durationSeconds = parseFloat(duration);
        
        if (isNaN(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60) {
            alert('Please enter a valid duration between 1 and 60 seconds.');
            return;
        }
        
        // Start with frame pre-calculation
        this.preCalculateFramesForRecording(durationSeconds);
    }
    
    async preCalculateFramesForRecording(duration) {
        try {
            this.isPreCalculating = true;
            this.preCalculatedFrames = [];
            
            const exportBtn = document.getElementById('exportVideoBtn');
            exportBtn.textContent = 'Calculating...';
            exportBtn.disabled = true;
            
            // Create canvas for pre-rendering
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match grid container but with higher resolution
            const gridRect = this.gridContainer.getBoundingClientRect();
            const scaleFactor = 2; // 2x resolution for better quality
            canvas.width = gridRect.width * scaleFactor;
            canvas.height = gridRect.height * scaleFactor;
            ctx.scale(scaleFactor, scaleFactor);
            
            // Calculate number of frames needed (60 FPS)
            const frameRate = 60;
            const totalFrames = Math.ceil(duration * frameRate);
            const frameInterval = 1000 / frameRate; // ms per frame
            
            console.log(`Pre-calculating ${totalFrames} frames for ${duration}s recording...`);
            
            // If we have a sequence, we need to track timing
            let sequenceFrameIndex = 0;
            const hasSequence = this.imageSequence.length > 1 || this.currentProcessedSequence;
            
            // Store current animation state if any
            const wasAnimating = this.isAnimating;
            const originalTime = this.animationStartTime;
            
            // Pre-render all frames
            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                const timeStamp = frameIndex * frameInterval;
                
                // Update button text with progress
                const progress = Math.round((frameIndex / totalFrames) * 100);
                exportBtn.textContent = `Calculating... ${progress}%`;
                
                // If we have sequence playback, advance to correct frame
                if (hasSequence) {
                    // Calculate which sequence frame should be displayed at this timestamp
                    const sequenceInterval = 1000 / 30; // 30 FPS for sequences
                    const currentSequenceFrame = Math.floor(timeStamp / sequenceInterval);
                    
                    if (this.currentProcessedSequence) {
                        // Use processed sequence
                        const frameIdx = currentSequenceFrame % this.currentProcessedSequence.length;
                        this.showProcessedFrame(frameIdx);
                    } else if (this.imageSequence.length > 1) {
                        // Use regular sequence
                        const frameIdx = currentSequenceFrame % this.imageSequence.length;
                        this.showSequenceImage(frameIdx);
                    }
                }
                
                // If animation is enabled, update animation state
                if (wasAnimating) {
                    // Simulate animation time progression
                    this.animationStartTime = originalTime - timeStamp;
                    this.updateAnimation();
                }
                
                // Wait for any image loading to complete
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Capture frame to canvas
                this.captureGridToCanvas(canvas, ctx);
                
                // Store frame as ImageData for better performance
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                this.preCalculatedFrames.push({
                    imageData: imageData,
                    timestamp: timeStamp
                });
                
                // Small delay to prevent blocking UI
                if (frameIndex % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            // Restore original animation state
            if (wasAnimating) {
                this.animationStartTime = originalTime;
            }
            
            console.log(`Pre-calculation complete: ${this.preCalculatedFrames.length} frames ready`);
            
            // Start actual recording with pre-calculated frames
            this.startRecordingWithPreCalculatedFrames(duration, canvas, scaleFactor);
            
        } catch (error) {
            console.error('Error pre-calculating frames:', error);
            this.isPreCalculating = false;
            
            const exportBtn = document.getElementById('exportVideoBtn');
            exportBtn.textContent = 'Record MP4';
            exportBtn.disabled = false;
            
            alert('Error pre-calculating frames. Please try again.');
        }
    }
    
    startRecordingWithPreCalculatedFrames(duration, canvas, scaleFactor) {
        try {
            this.isPreCalculating = false;
            
            // Get the stream from canvas at 60fps
            const stream = canvas.captureStream(60);
            
            // Enhanced codec selection for better compatibility
            let mimeType = 'video/webm;codecs=vp9';
            let fileExtension = 'webm';
            
            // Try more specific H.264 codec with baseline profile for maximum compatibility
            const compatibleMP4Codecs = [
                'video/mp4;codecs=avc1.42E01E', // H.264 Baseline Profile Level 3.0 - most compatible
                'video/mp4;codecs=avc1.42001E', // H.264 Baseline Profile Level 1.5
                'video/mp4;codecs=h264,aac',     // H.264 with AAC audio codec specified
                'video/mp4;codecs=h264',         // Generic H.264
                'video/mp4'                      // Generic MP4
            ];
            
            // Test codecs in order of compatibility
            for (const codec of compatibleMP4Codecs) {
                if (MediaRecorder.isTypeSupported(codec)) {
                    mimeType = codec;
                    fileExtension = 'mp4';
                    console.log(`Using MP4 codec: ${codec}`);
                    break;
                }
            }
            
            // If no MP4 codec works, try WebM alternatives
            if (fileExtension === 'webm') {
                const webmCodecs = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus', 
                    'video/webm;codecs=vp9',
                    'video/webm;codecs=vp8',
                    'video/webm'
                ];
                
                for (const codec of webmCodecs) {
                    if (MediaRecorder.isTypeSupported(codec)) {
                        mimeType = codec;
                        console.log(`Using WebM codec: ${codec}`);
                        break;
                    }
                }
            }
            
            // Setup MediaRecorder with compatibility-focused settings
            const recordingOptions = {
                mimeType: mimeType,
                videoBitsPerSecond: 6000000 // Reduced to 6 Mbps for better compatibility
            };
            
            // Only add bitrate if supported to avoid errors
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                console.warn(`Codec ${mimeType} not supported, trying without bitrate`);
                delete recordingOptions.videoBitsPerSecond;
                recordingOptions.mimeType = fileExtension === 'mp4' ? 'video/mp4' : 'video/webm';
            }

            this.mediaRecorder = new MediaRecorder(stream, recordingOptions);
            
            this.recordedChunks = [];
            this.isRecording = true;
            this.currentFileExtension = fileExtension;
            this.recordingScaleFactor = scaleFactor;
            
            // Update button state
            const exportBtn = document.getElementById('exportVideoBtn');
            exportBtn.textContent = 'Recording...';
            exportBtn.disabled = true;
            
            // Handle data available event
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                this.saveRecording();
                this.isRecording = false;
                exportBtn.textContent = 'Record MP4';
                exportBtn.disabled = false;
                
                // Clear pre-calculated frames to free memory
                this.preCalculatedFrames = [];
            };
            
            // Start recording
            this.mediaRecorder.start();
            
            // Start playback of pre-calculated frames
            this.startPreCalculatedFramePlayback(canvas);
            
            // Stop recording after specified duration
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                    this.stopPreCalculatedFramePlayback();
                }
            }, duration * 1000);
            
            console.log(`Started HIGH QUALITY recording with ${this.preCalculatedFrames.length} pre-calculated frames for ${duration} seconds in ${fileExtension.toUpperCase()} format at ${canvas.width}x${canvas.height} resolution`);
            
        } catch (error) {
            console.error('Error starting recording with pre-calculated frames:', error);
            alert('Error starting recording. Please try again.');
            this.isRecording = false;
            this.isPreCalculating = false;
            
            const exportBtn = document.getElementById('exportVideoBtn');
            exportBtn.textContent = 'Record MP4';
            exportBtn.disabled = false;
        }
    }
    
    startPreCalculatedFramePlayback(canvas) {
        const ctx = canvas.getContext('2d');
        let frameIndex = 0;
        const frameRate = 60;
        
        this.preCalculatedPlaybackInterval = setInterval(() => {
            if (frameIndex < this.preCalculatedFrames.length) {
                const frame = this.preCalculatedFrames[frameIndex];
                ctx.putImageData(frame.imageData, 0, 0);
                frameIndex++;
            } else {
                // Loop back to beginning if we've played all frames
                frameIndex = 0;
            }
        }, 1000 / frameRate);
    }
    
    stopPreCalculatedFramePlayback() {
        if (this.preCalculatedPlaybackInterval) {
            clearInterval(this.preCalculatedPlaybackInterval);
            this.preCalculatedPlaybackInterval = null;
        }
    }
    
    startRecording(duration) {
        // Legacy fallback method - now redirects to pre-calculated recording
        console.log('Using legacy recording fallback - redirecting to pre-calculated method');
        this.preCalculateFramesForRecording(duration);
    }
    
    startCanvasDrawing(canvas, ctx) {
        this.drawingInterval = setInterval(() => {
            this.captureGridToCanvas(canvas, ctx);
        }, 1000 / 60); // 60 FPS for smoother video
    }
    
    stopCanvasDrawing() {
        if (this.drawingInterval) {
            clearInterval(this.drawingInterval);
            this.drawingInterval = null;
        }
    }
    
    captureGridToCanvas(canvas, ctx) {
        try {
            // Get grid dimensions (not scaled canvas dimensions)
            const gridRect = this.gridContainer.getBoundingClientRect();
            
            // Clear canvas (use grid dimensions since context is scaled)
            ctx.fillStyle = getComputedStyle(this.gridContainer).backgroundColor || '#181818';
            ctx.fillRect(0, 0, gridRect.width, gridRect.height);
            
            // Use html2canvas alternative - draw each grid cell
            const gridItems = this.gridContainer.querySelectorAll('.grid-item');
            const containerRect = this.gridContainer.getBoundingClientRect();
            
            gridItems.forEach(item => {
                const itemRect = item.getBoundingClientRect();
                const x = itemRect.left - containerRect.left;
                const y = itemRect.top - containerRect.top;
                const width = itemRect.width;
                const height = itemRect.height;
                
                // Draw cell background
                ctx.fillStyle = getComputedStyle(item).backgroundColor || '#161616';
                ctx.fillRect(x, y, width, height);
                
                // Draw cell border with crisp lines
                ctx.strokeStyle = getComputedStyle(item).borderColor || '#2a2a2a';
                ctx.lineWidth = 1 / (this.recordingScaleFactor || 1); // Adjust line width for scale
                ctx.strokeRect(x, y, width, height);
                
                // Draw image if present with high quality
                const img = item.querySelector('img');
                if (img && img.complete) {
                    // Use smooth scaling for better image quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, x, y, width, height);
                }
                
                // Draw cell label if visible with crisp text
                const label = item.querySelector('.cell-label');
                if (label && !label.classList.contains('hidden')) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.fillRect(x + 6, y + 6, 20, 12);
                    ctx.fillStyle = 'white';
                    ctx.font = `${9 / (this.recordingScaleFactor || 1)}px monospace`; // Scale font size
                    ctx.textBaseline = 'top';
                    ctx.fillText(label.textContent, x + 8, y + 8);
                }
            });
            
            // Draw splitters if visible with crisp lines
            if (!this.gridContainer.classList.contains('hide-splitters')) {
                const splitters = this.gridContainer.querySelectorAll('.splitter');
                splitters.forEach(splitter => {
                    const splitterRect = splitter.getBoundingClientRect();
                    const x = splitterRect.left - containerRect.left;
                    const y = splitterRect.top - containerRect.top;
                    const width = splitterRect.width;
                    const height = splitterRect.height;
                    
                    ctx.fillStyle = getComputedStyle(splitter).backgroundColor || 'transparent';
                    if (ctx.fillStyle !== 'transparent' && ctx.fillStyle !== 'rgba(0, 0, 0, 0)') {
                        ctx.fillRect(x, y, width, height);
                    }
                });
            }
            
        } catch (error) {
            console.error('Error capturing grid to canvas:', error);
        }
    }
    
    saveRecording() {
        try {
            // Force correct MIME type for blob creation to ensure compatibility
            let blobMimeType;
            if (this.currentFileExtension === 'mp4') {
                // Use generic MP4 MIME type for blob to ensure compatibility
                blobMimeType = 'video/mp4';
            } else {
                blobMimeType = 'video/webm';
            }
            
            const blob = new Blob(this.recordedChunks, { type: blobMimeType });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `grid-recording-${Date.now()}.${this.currentFileExtension}`;
            
            // Trigger download
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            URL.revokeObjectURL(url);
            this.recordedChunks = [];
            
            console.log(`Recording saved successfully as ${this.currentFileExtension.toUpperCase()} with MIME type: ${blobMimeType}`);
            
        } catch (error) {
            console.error('Error saving recording:', error);
            alert('Error saving recording. Please try again.');
        }
    }
    
    // Help Modal Functions
    showHelp() {
        const helpModal = document.getElementById('helpModal');
        helpModal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    closeHelp() {
        const helpModal = document.getElementById('helpModal');
        helpModal.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Initialize image inputs when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const imageGridManager = new ImageGridManager();
    window.imageGridManager = imageGridManager; // Make globally available for onclick
    window.tabManager.registerTab('image-inputs', imageGridManager);
}); 