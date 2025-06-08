// Common Grid Infrastructure
class BaseGridManager {
    constructor(containerId, options = {}) {
        this.gridContainer = document.getElementById(containerId);
        this.isDragging = false;
        this.currentSplitter = null;
        this.startPosition = 0;
        this.columnSizes = options.columnSizes || [1, 1, 1];
        this.rowSizes = options.rowSizes || [1, 1, 1];
        
        // Animation properties
        this.isAnimating = false;
        this.animationId = null;
        this.animationTime = 0;
        this.frequency = 0.5;
        this.amplitude = 0.3;
        this.animationAxis = 'xy'; // Default to both X and Y animation
        this.animationType = 'noise'; // 'noise' or 'pulse'
        this.holdTime = 0.5;
        this.baseColumnSizes = [...this.columnSizes];
        this.baseRowSizes = [...this.rowSizes];
        
        // Pulse animation properties
        this.pulseState = 'transitioning'; // 'transitioning' or 'holding'
        this.pulseTimer = 0;
        this.pulseStartColumns = [...this.columnSizes]; // Where we start each pulse from
        this.pulseStartRows = [...this.rowSizes];
        this.pulseTargetColumns = [...this.columnSizes]; // Where we're going to
        this.pulseTargetRows = [...this.rowSizes];
        this.pulseProgress = 0;
        
        this.init();
    }
    
    init() {
        this.setupSplitters();
        this.updateSplitterPositions();
        this.setupGridControls();
        this.setupCanvasSizeControls();
        this.setupAnimationControls();
        
        window.addEventListener('resize', () => {
            this.updateSplitterPositions();
        });
    }
    
    setupSplitters() {
        const splitters = this.gridContainer.querySelectorAll('.splitter');
        
        splitters.forEach(splitter => {
            splitter.addEventListener('mousedown', (e) => this.startDrag(e, splitter));
        });
        
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());
    }
    
    updateSplitterPositions() {
        const containerRect = this.gridContainer.getBoundingClientRect();
        const borderWidth = parseInt(getComputedStyle(this.gridContainer).borderLeftWidth) || 0;
        
        // Position vertical splitters
        const verticalSplitters = this.gridContainer.querySelectorAll('.splitter.vertical');
        const totalColumnFr = this.columnSizes.reduce((sum, size) => sum + size, 0);
        const containerWidth = containerRect.width - 2 * borderWidth;
        
        verticalSplitters.forEach((splitter, index) => {
            const columnIndex = parseInt(splitter.dataset.index);
            if (columnIndex < this.columnSizes.length - 1) {
                let accumulatedWidth = 0;
                for (let i = 0; i <= columnIndex; i++) {
                    accumulatedWidth += (this.columnSizes[i] / totalColumnFr) * containerWidth;
                }
                const leftPosition = accumulatedWidth - 4;
                splitter.style.left = `${leftPosition}px`;
            }
        });
        
        // Position horizontal splitters
        const horizontalSplitters = this.gridContainer.querySelectorAll('.splitter.horizontal');
        const totalRowFr = this.rowSizes.reduce((sum, size) => sum + size, 0);
        const containerHeight = containerRect.height - 2 * borderWidth;
        
        horizontalSplitters.forEach((splitter, index) => {
            const rowIndex = parseInt(splitter.dataset.index);
            if (rowIndex < this.rowSizes.length - 1) {
                let accumulatedHeight = 0;
                for (let i = 0; i <= rowIndex; i++) {
                    accumulatedHeight += (this.rowSizes[i] / totalRowFr) * containerHeight;
                }
                const topPosition = accumulatedHeight - 4;
                splitter.style.top = `${topPosition}px`;
            }
        });
    }
    
    startDrag(e, splitter) {
        e.preventDefault();
        this.isDragging = true;
        this.currentSplitter = splitter;
        
        if (splitter.classList.contains('vertical')) {
            this.startPosition = e.clientX;
        } else {
            this.startPosition = e.clientY;
        }
        
        document.body.classList.add('dragging');
        splitter.classList.add('dragging');
    }
    
    drag(e) {
        if (!this.isDragging || !this.currentSplitter) return;
        
        e.preventDefault();
        
        const containerRect = this.gridContainer.getBoundingClientRect();
        const borderWidth = parseInt(getComputedStyle(this.gridContainer).borderLeftWidth) || 0;
        
        if (this.currentSplitter.classList.contains('vertical')) {
            const splitterIndex = parseInt(this.currentSplitter.dataset.index);
            const containerWidth = containerRect.width - 2 * borderWidth;
            const mouseX = e.clientX - containerRect.left - borderWidth;
            const percentage = mouseX / containerWidth;
            
            this.resizeColumns(splitterIndex, percentage);
        } else {
            const splitterIndex = parseInt(this.currentSplitter.dataset.index);
            const containerHeight = containerRect.height - 2 * borderWidth;
            const mouseY = e.clientY - containerRect.top - borderWidth;
            const percentage = mouseY / containerHeight;
            
            this.resizeRows(splitterIndex, percentage);
        }
    }
    
    resizeColumns(splitterIndex, targetPercentage) {
        targetPercentage = Math.max(0.05, Math.min(0.95, targetPercentage));
        
        const containerRect = this.gridContainer.getBoundingClientRect();
        const borderWidth = parseInt(getComputedStyle(this.gridContainer).borderLeftWidth) || 0;
        const containerWidth = containerRect.width - 2 * borderWidth;
        const minCellWidth = 100;
        const minPercentagePerCell = minCellWidth / containerWidth;
        
        const totalFr = this.columnSizes.reduce((sum, size) => sum + size, 0);
        const targetFr = targetPercentage * totalFr;
        
        let currentFr = 0;
        for (let i = 0; i <= splitterIndex; i++) {
            currentFr += this.columnSizes[i];
        }
        
        const frDifference = targetFr - currentFr;
        
        if (splitterIndex < this.columnSizes.length - 1) {
            const leftColumnIndex = splitterIndex;
            const rightColumnIndex = splitterIndex + 1;
            
            const minSizeFr = (minPercentagePerCell * totalFr);
            
            const proposedLeftSize = this.columnSizes[leftColumnIndex] + frDifference;
            const proposedRightSize = this.columnSizes[rightColumnIndex] - frDifference;
            
            if (proposedLeftSize >= minSizeFr && proposedRightSize >= minSizeFr) {
                this.columnSizes[leftColumnIndex] = proposedLeftSize;
                this.columnSizes[rightColumnIndex] = proposedRightSize;
                
                this.updateGridColumns();
                this.updateSplitterPositions();
            }
        }
    }
    
    resizeRows(splitterIndex, targetPercentage) {
        targetPercentage = Math.max(0.05, Math.min(0.95, targetPercentage));
        
        const containerRect = this.gridContainer.getBoundingClientRect();
        const borderWidth = parseInt(getComputedStyle(this.gridContainer).borderLeftWidth) || 0;
        const containerHeight = containerRect.height - 2 * borderWidth;
        const minCellHeight = 100;
        const minPercentagePerCell = minCellHeight / containerHeight;
        
        const totalFr = this.rowSizes.reduce((sum, size) => sum + size, 0);
        const targetFr = targetPercentage * totalFr;
        
        let currentFr = 0;
        for (let i = 0; i <= splitterIndex; i++) {
            currentFr += this.rowSizes[i];
        }
        
        const frDifference = targetFr - currentFr;
        
        if (splitterIndex < this.rowSizes.length - 1) {
            const topRowIndex = splitterIndex;
            const bottomRowIndex = splitterIndex + 1;
            
            const minSizeFr = (minPercentagePerCell * totalFr);
            
            const proposedTopSize = this.rowSizes[topRowIndex] + frDifference;
            const proposedBottomSize = this.rowSizes[bottomRowIndex] - frDifference;
            
            if (proposedTopSize >= minSizeFr && proposedBottomSize >= minSizeFr) {
                this.rowSizes[topRowIndex] = proposedTopSize;
                this.rowSizes[bottomRowIndex] = proposedBottomSize;
                
                this.updateGridRows();
                this.updateSplitterPositions();
            }
        }
    }
    
    updateGridColumns() {
        const columnTemplate = this.columnSizes.map(size => `${size}fr`).join(' ');
        this.gridContainer.style.gridTemplateColumns = columnTemplate;
    }
    
    updateGridRows() {
        const rowTemplate = this.rowSizes.map(size => `${size}fr`).join(' ');
        this.gridContainer.style.gridTemplateRows = rowTemplate;
    }
    
    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        document.body.classList.remove('dragging');
        
        if (this.currentSplitter) {
            this.currentSplitter.classList.remove('dragging');
            this.currentSplitter = null;
        }
        
        // Hook for subclasses to override
        this.onDragEnd();
    }
    
    onDragEnd() {
        // Override in subclasses
    }
    
    setupGridControls() {
        // Grid structure controls - to be implemented by subclasses
    }
    
    setupCanvasSizeControls() {
        // Canvas size controls - to be implemented by subclasses  
    }
    
    setupAnimationControls() {
        // Animation controls - to be implemented by subclasses
    }
    
    updateCanvasSize(width, height) {
        width = Math.max(200, Math.min(2000, width));
        height = Math.max(200, Math.min(1500, height));
        
        document.documentElement.style.setProperty('--canvas-width', `${width}px`);
        document.documentElement.style.setProperty('--canvas-height', `${height}px`);
        
        setTimeout(() => {
            this.updateSplitterPositions();
        }, 100);
        
        console.log(`Canvas size updated to ${width}x${height}px`);
    }
    
    // Animation methods
    toggleAnimation(enabled) {
        this.isAnimating = enabled;
        
        if (enabled) {
            this.baseColumnSizes = [...this.columnSizes];
            this.baseRowSizes = [...this.rowSizes];
            this.animationTime = 0;
            
            // Initialize pulse animation state
            if (this.animationType === 'pulse') {
                this.pulseState = 'transitioning';
                this.pulseTimer = 0;
                this.pulseProgress = 0;
                this.pulseStartColumns = [...this.baseColumnSizes];
                this.pulseStartRows = [...this.baseRowSizes];
                this.generateNewPulseTargets();
            }
            
            this.startAnimation();
        } else {
            this.stopAnimation();
            this.columnSizes = [...this.baseColumnSizes];
            this.rowSizes = [...this.baseRowSizes];
            this.updateGridColumns();
            this.updateGridRows();
            this.updateSplitterPositions();
        }
    }
    
    startAnimation() {
        if (!this.isAnimating) return;
        
        this.animationId = requestAnimationFrame(() => {
            this.updateAnimation();
            this.startAnimation();
        });
    }
    
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    updateAnimation() {
        if (!this.isAnimating) return;
        
        const animationType = this.animationType || 'noise';
        
        if (animationType === 'noise') {
            this.updateNoiseAnimation();
        } else if (animationType === 'pulse') {
            this.updatePulseAnimation();
        }
        
        this.updateGridColumns();
        this.updateGridRows();
        this.updateSplitterPositions();
    }
    
    updateNoiseAnimation() {
        this.animationTime += 0.016 * this.frequency;
        
        const containerRect = this.gridContainer.getBoundingClientRect();
        const borderWidth = parseInt(getComputedStyle(this.gridContainer).borderLeftWidth) || 0;
        const containerWidth = containerRect.width - 2 * borderWidth;
        const containerHeight = containerRect.height - 2 * borderWidth;
        const minCellWidth = 100;
        const minCellHeight = 100;
        const minPercentagePerCellWidth = minCellWidth / containerWidth;
        const minPercentagePerCellHeight = minCellHeight / containerHeight;
        
        // Get animation axis preference (defaults to 'xy' if not set)
        const animationAxis = this.animationAxis || 'xy';
        
        // Animate columns (X-axis) if axis is 'x' or 'xy'
        if (animationAxis === 'x' || animationAxis === 'xy') {
            const totalColumnFr = this.baseColumnSizes.reduce((sum, size) => sum + size, 0);
            const minColumnSizeFr = minPercentagePerCellWidth * totalColumnFr;
            
            for (let i = 0; i < this.columnSizes.length; i++) {
                const phase = (i * 2.3) + this.animationTime;
                const noise = this.smoothNoise(phase);
                const variation = noise * this.amplitude;
                
                let newSize = this.baseColumnSizes[i] * (1 + variation);
                newSize = Math.max(minColumnSizeFr, newSize);
                
                this.columnSizes[i] = newSize;
            }
        } else {
            // Reset columns to base sizes when not animating X
            this.columnSizes = [...this.baseColumnSizes];
        }
        
        // Animate rows (Y-axis) if axis is 'y' or 'xy'
        if (animationAxis === 'y' || animationAxis === 'xy') {
            const totalRowFr = this.baseRowSizes.reduce((sum, size) => sum + size, 0);
            const minRowSizeFr = minPercentagePerCellHeight * totalRowFr;
            
            for (let i = 0; i < this.rowSizes.length; i++) {
                const phase = (i * 1.7) + this.animationTime + 100;
                const noise = this.smoothNoise(phase);
                const variation = noise * this.amplitude;
                
                let newSize = this.baseRowSizes[i] * (1 + variation);
                newSize = Math.max(minRowSizeFr, newSize);
                
                this.rowSizes[i] = newSize;
            }
        } else {
            // Reset rows to base sizes when not animating Y
            this.rowSizes = [...this.baseRowSizes];
        }
    }
    
    updatePulseAnimation() {
        const deltaTime = 0.016; // 60fps
        this.pulseTimer += deltaTime;
        
        const containerRect = this.gridContainer.getBoundingClientRect();
        const borderWidth = parseInt(getComputedStyle(this.gridContainer).borderLeftWidth) || 0;
        const containerWidth = containerRect.width - 2 * borderWidth;
        const containerHeight = containerRect.height - 2 * borderWidth;
        const minCellWidth = 100;
        const minCellHeight = 100;
        const minPercentagePerCellWidth = minCellWidth / containerWidth;
        const minPercentagePerCellHeight = minCellHeight / containerHeight;
        
        const animationAxis = this.animationAxis || 'xy';
        const transitionDuration = 1 / this.frequency; // Frequency controls transition speed
        
        if (this.pulseState === 'transitioning') {
            // Calculate progress (0 to 1) with precise clamping
            this.pulseProgress = Math.min(this.pulseTimer / transitionDuration, 1);
            
            // Smooth easing function - ensure it's exactly 0 or 1 at extremes
            let easedProgress = this.easeInOutCubic(this.pulseProgress);
            if (this.pulseProgress >= 1) easedProgress = 1;
            if (this.pulseProgress <= 0) easedProgress = 0;
            
            // Interpolate directly between start and target positions
            if (animationAxis === 'x' || animationAxis === 'xy') {
                const totalColumnFr = this.baseColumnSizes.reduce((sum, size) => sum + size, 0);
                const minColumnSizeFr = minPercentagePerCellWidth * totalColumnFr;
                
                for (let i = 0; i < this.columnSizes.length; i++) {
                    const interpolated = this.lerp(this.pulseStartColumns[i], this.pulseTargetColumns[i], easedProgress);
                    this.columnSizes[i] = Math.max(minColumnSizeFr, interpolated);
                }
            } else {
                this.columnSizes = [...this.baseColumnSizes];
            }
            
            if (animationAxis === 'y' || animationAxis === 'xy') {
                const totalRowFr = this.baseRowSizes.reduce((sum, size) => sum + size, 0);
                const minRowSizeFr = minPercentagePerCellHeight * totalRowFr;
                
                for (let i = 0; i < this.rowSizes.length; i++) {
                    const interpolated = this.lerp(this.pulseStartRows[i], this.pulseTargetRows[i], easedProgress);
                    this.rowSizes[i] = Math.max(minRowSizeFr, interpolated);
                }
            } else {
                this.rowSizes = [...this.baseRowSizes];
            }
            
            // Check if transition is complete
            if (this.pulseProgress >= 1) {
                this.pulseState = 'holding';
                this.pulseTimer = 0;
                
                // Ensure all elements are exactly at their target values
                if (animationAxis === 'x' || animationAxis === 'xy') {
                    const totalColumnFr = this.baseColumnSizes.reduce((sum, size) => sum + size, 0);
                    const minColumnSizeFr = minPercentagePerCellWidth * totalColumnFr;
                    
                    for (let i = 0; i < this.columnSizes.length; i++) {
                        this.columnSizes[i] = Math.max(minColumnSizeFr, this.pulseTargetColumns[i]);
                    }
                }
                
                if (animationAxis === 'y' || animationAxis === 'xy') {
                    const totalRowFr = this.baseRowSizes.reduce((sum, size) => sum + size, 0);
                    const minRowSizeFr = minPercentagePerCellHeight * totalRowFr;
                    
                    for (let i = 0; i < this.rowSizes.length; i++) {
                        this.rowSizes[i] = Math.max(minRowSizeFr, this.pulseTargetRows[i]);
                    }
                }
            }
        } else if (this.pulseState === 'holding') {
            // Hold the current state
            if (this.pulseTimer >= this.holdTime) {
                // Capture current positions as start positions for next pulse
                this.pulseStartColumns = [...this.columnSizes];
                this.pulseStartRows = [...this.rowSizes];
                
                // Generate new target positions BEFORE starting animation
                this.generateNewPulseTargets();
                
                // Debug logging
                console.log('Pulse transition starting:');
                console.log('Start columns:', this.pulseStartColumns.map(x => x.toFixed(2)));
                console.log('Target columns:', this.pulseTargetColumns.map(x => x.toFixed(2)));
                
                // Start new transition
                this.pulseState = 'transitioning';
                this.pulseTimer = 0;
                this.pulseProgress = 0;
            }
        }
    }
    
    generateNewPulseTargets() {
        const animationAxis = this.animationAxis || 'xy';
        
        const containerRect = this.gridContainer.getBoundingClientRect();
        const borderWidth = parseInt(getComputedStyle(this.gridContainer).borderLeftWidth) || 0;
        const containerWidth = containerRect.width - 2 * borderWidth;
        const containerHeight = containerRect.height - 2 * borderWidth;
        const minCellWidth = 100;
        const minCellHeight = 100;
        const minPercentagePerCellWidth = minCellWidth / containerWidth;
        const minPercentagePerCellHeight = minCellHeight / containerHeight;
        
        if (animationAxis === 'x' || animationAxis === 'xy') {
            const totalColumnFr = this.baseColumnSizes.reduce((sum, size) => sum + size, 0);
            const minColumnSizeFr = minPercentagePerCellWidth * totalColumnFr;
            
            for (let i = 0; i < this.columnSizes.length; i++) {
                // Generate targets relative to CURRENT position, not base position
                const currentSize = this.columnSizes[i];
                const baseSize = this.baseColumnSizes[i];
                
                // Create a maximum movement distance based on amplitude
                const maxMovement = baseSize * this.amplitude * 1.5; // Increase for more dramatic pulses
                
                // Generate a random direction and distance
                const direction = (Math.random() - 0.5) * 2; // -1 to 1
                const movement = direction * maxMovement;
                
                // Calculate target, ensuring it stays within bounds
                let target = currentSize + movement;
                target = Math.max(minColumnSizeFr, target);
                target = Math.max(baseSize * 0.2, target); // Allow smaller sizes
                target = Math.min(baseSize * 2.5, target); // Allow larger sizes
                
                this.pulseTargetColumns[i] = target;
            }
        }
        
        if (animationAxis === 'y' || animationAxis === 'xy') {
            const totalRowFr = this.baseRowSizes.reduce((sum, size) => sum + size, 0);
            const minRowSizeFr = minPercentagePerCellHeight * totalRowFr;
            
            for (let i = 0; i < this.rowSizes.length; i++) {
                // Generate targets relative to CURRENT position, not base position
                const currentSize = this.rowSizes[i];
                const baseSize = this.baseRowSizes[i];
                
                // Create a maximum movement distance based on amplitude
                const maxMovement = baseSize * this.amplitude * 1.5; // Increase for more dramatic pulses
                
                // Generate a random direction and distance
                const direction = (Math.random() - 0.5) * 2; // -1 to 1
                const movement = direction * maxMovement;
                
                // Calculate target, ensuring it stays within bounds
                let target = currentSize + movement;
                target = Math.max(minRowSizeFr, target);
                target = Math.max(baseSize * 0.2, target); // Allow smaller sizes
                target = Math.min(baseSize * 2.5, target); // Allow larger sizes
                
                this.pulseTargetRows[i] = target;
            }
        }
    }
    
    lerp(start, end, t) {
        return start + (end - start) * t;
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    smoothNoise(x) {
        const wave1 = Math.sin(x) * 0.5;
        const wave2 = Math.sin(x * 2.1 + 0.5) * 0.3;
        const wave3 = Math.sin(x * 0.7 + 1.2) * 0.2;
        
        return wave1 + wave2 + wave3;
    }
}

// Tab System
class TabManager {
    constructor() {
        this.tabs = new Map();
        this.activeTab = null;
        this.init();
    }
    
    init() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = button.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
        
        // Set initial active tab
        const activeButton = document.querySelector('.tab-btn.active');
        if (activeButton) {
            this.activeTab = activeButton.getAttribute('data-tab');
        }
    }
    
    switchTab(tabId) {
        // Remove active class from all buttons and contents
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        const targetButton = document.querySelector(`[data-tab="${tabId}"]`);
        const targetContent = document.getElementById(tabId);
        
        if (targetButton && targetContent) {
            targetButton.classList.add('active');
            targetContent.classList.add('active');
            this.activeTab = tabId;
            
            // Trigger tab-specific initialization if needed
            this.onTabSwitch(tabId);
        }
    }
    
    onTabSwitch(tabId) {
        // Hook for tab-specific initialization
        if (this.tabs.has(tabId)) {
            const tabInstance = this.tabs.get(tabId);
            if (tabInstance.onActivate) {
                tabInstance.onActivate();
            }
        }
    }
    
    registerTab(tabId, instance) {
        this.tabs.set(tabId, instance);
    }
    
    getActiveTab() {
        return this.activeTab;
    }
}

// Utility functions
function hslToRgb(h, s, l) {
    h /= 360;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h * 12) % 12;
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return [f(0), f(8), f(4)];
}

// Initialize tab system when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.tabManager = new TabManager();
}); 