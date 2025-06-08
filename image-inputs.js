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
        
        this.setupImageUpload();
        this.setupImageSequence();
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
            this.currentImageDataUrl = imageData.dataUrl;
            this.isUsingDefaultImage = false;
            
            // Use preloaded image for smooth display
            this.loadImageFromDataUrl(imageData.dataUrl);
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
        
        const sequenceInfo = document.getElementById('sequenceInfo');
        sequenceInfo.style.display = 'none';
        
        console.log('Image sequence cleared');
    }
    
    setImageFitMode(mode) {
        console.log('setImageFitMode called with mode:', mode);
        const imageWrappers = document.querySelectorAll('#gridContainer .image-wrapper');
        
        this.clearImageBackground();
        
        imageWrappers.forEach(wrapper => {
            wrapper.classList.remove('fit-contain', 'fit-cover', 'debug-corners');
            this.clearDebugElements(wrapper);
        });
        
        switch(mode) {
            case 'fill':
                console.log('Image fit mode: Stretch to Fill Cell');
                break;
            case 'contain':
                imageWrappers.forEach(wrapper => {
                    wrapper.classList.add('fit-contain');
                });
                console.log('Image fit mode: Fit Within Cell');
                break;
            case 'cover':
                imageWrappers.forEach(wrapper => {
                    wrapper.classList.add('fit-cover');
                });
                console.log('Image fit mode: Fill Cell Completely');
                break;
            case 'debug-corners':
                imageWrappers.forEach(wrapper => {
                    this.setupDebugCorners(wrapper);
                });
                console.log('Image fit mode: Debug 4 Corners');
                break;
            case 'background':
                this.setupImageBackground();
                console.log('Image fit mode: Single Image Background');
                break;
            case 'single-corner-stretch':
                this.setupSingleCornerStretch();
                console.log('Image fit mode: Single Corner Stretch');
                break;
        }
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
        
        imageFitModeSelect.addEventListener('change', (e) => {
            this.setImageFitMode(e.target.value);
        });
        
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
        if (this.isRecording) {
            console.log('Already recording');
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
        
        this.startRecording(durationSeconds);
    }
    
    startRecording(duration) {
        try {
            // Create a canvas to capture the grid area
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match grid container but with higher resolution for better quality
            const gridRect = this.gridContainer.getBoundingClientRect();
            const scaleFactor = 2; // 2x resolution for better quality
            canvas.width = gridRect.width * scaleFactor;
            canvas.height = gridRect.height * scaleFactor;
            
            // Scale the context to maintain crisp rendering at higher resolution
            ctx.scale(scaleFactor, scaleFactor);
            
            // Get the stream from canvas at 60fps for smoother playback
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
            };
            
            // Start recording
            this.mediaRecorder.start();
            
            // Start the canvas drawing loop at 60fps
            this.startCanvasDrawing(canvas, ctx);
            
            // Stop recording after specified duration
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                    this.stopCanvasDrawing();
                }
            }, duration * 1000);
            
            console.log(`Started HIGH QUALITY recording for ${duration} seconds in ${fileExtension.toUpperCase()} format at ${canvas.width}x${canvas.height} resolution`);
            
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Error starting recording. Please try again.');
            this.isRecording = false;
            
            const exportBtn = document.getElementById('exportVideoBtn');
            exportBtn.textContent = 'Record MP4';
            exportBtn.disabled = false;
        }
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