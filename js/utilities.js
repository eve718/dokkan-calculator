/**
 * Utilities Module - Shared Functionality
 * 
 * Handles favorites system, theme management, clipboard operations,
 * image export, and onboarding features
 */

/**
 * Favorites Management System
 * Persists phase favorites to localStorage
 */
const FavoritesSystem = {
    STORAGE_KEY: 'dokkan_calculator_phases',
    
    /**
     * Get all favorite phases
     * @returns {Array} Array of favorite phase IDs
     */
    getAll() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.warn('FavoritesSystem: Failed to retrieve favorites', e);
            return [];
        }
    },

    /**
     * Check if a phase is favorited
     * @param {string} id - Phase ID to check
     * @returns {boolean} True if favorited
     */
    isFavorited(id) {
        return this.getAll().includes(id);
    },

    /**
     * Toggle favorite status for a phase
     * @param {string} id - Phase ID to toggle
     * @returns {boolean} New favorite state (true = added, false = removed)
     */
    toggle(id) {
        const favorites = this.getAll();
        const index = favorites.indexOf(id);
        
        if (index > -1) {
            // Remove
            favorites.splice(index, 1);
        } else {
            // Add
            favorites.push(id);
        }
        
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
            return index === -1; // Return true if added
        } catch (e) {
            console.error('FavoritesSystem: Failed to save favorites', e);
            return false;
        }
    }
};

/**
 * Clipboard Operations
 * Copy results and other content to clipboard
 */
const ClipboardOps = {
    /**
     * Copy text to clipboard with visual feedback
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - Button element to show feedback on
     */
    async copy(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            
            // Visual feedback
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            button.textContent = '✗ Failed to copy';
            setTimeout(() => {
                button.textContent = 'Copy Results';
            }, 2000);
        }
    },

    /**
     * Format results for clipboard sharing
     * @param {Object} enemy - Enemy data
     * @param {Object} results - Calculation results
     * @param {Object} inputs - Input values
     * @returns {string} Formatted text for sharing
     */
    formatResults(enemy, results, inputs) {
        const resultLines = [];
        resultLines.push(`${enemy.name} - ATK Calculation`);
        resultLines.push('─'.repeat(40));
        
        if (enemy.outputs && Array.isArray(enemy.outputs)) {
            for (const output of enemy.outputs) {
                const value = results[output.id];
                if (value !== undefined && value !== null) {
                    const formatted = Math.round(value).toLocaleString();
                    resultLines.push(`${output.label}: ${formatted}`);
                }
            }
        }
        
        return resultLines.join('\n');
    }
};

/**
 * Image Export System
 * Capture results card and export as image with enhanced UI feedback
 */
const ImageExport = {
    /**
     * Download results card as PNG image with visual feedback
     * @param {HTMLElement} element - Element to capture
     * @param {string} fileName - Output file name (without extension)
     * @param {HTMLElement} triggerButton - Optional button to show feedback on
     * @returns {Promise} Resolves when download completes or rejects on error
     */
    async downloadAsImage(element, fileName = 'dokkan-results', triggerButton = null) {
        try {
            // Check if html2canvas is available
            if (typeof html2canvas === 'undefined') {
                console.warn('html2canvas library not loaded - cannot export image');
                this.showFeedback('Image export requires library', false, triggerButton);
                return Promise.reject(new Error('html2canvas not loaded'));
            }

            // Show loading state if button provided
            if (triggerButton) {
                const originalText = triggerButton.textContent;
                triggerButton.textContent = '⏳ Preparing...';
                triggerButton.disabled = true;

                try {
                    // Capture with higher quality settings
                    const canvas = await html2canvas(element, {
                        backgroundColor: '#1a202c',
                        scale: 2.5,  // Higher quality
                        useCORS: true,
                        logging: false,
                        allowTaint: true
                    });

                    const link = document.createElement('a');
                    link.href = canvas.toDataURL('image/png');
                    link.download = `${fileName}.png`;
                    link.click();

                    // Show success feedback
                    triggerButton.textContent = '✓ Downloaded!';
                    
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            triggerButton.textContent = originalText;
                            triggerButton.disabled = false;
                            resolve();
                        }, 2000);
                    });
                } catch (innerError) {
                    triggerButton.textContent = originalText;
                    triggerButton.disabled = false;
                    throw innerError;
                }
            } else {
                // No button provided - just capture and download
                const canvas = await html2canvas(element, {
                    backgroundColor: '#1a202c',
                    scale: 2.5,
                    useCORS: true,
                    logging: false,
                    allowTaint: true
                });

                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${fileName}.png`;
                link.click();
                
                return Promise.resolve();
            }
        } catch (error) {
            console.error('Failed to export image:', error);
            this.showFeedback('Failed to export image', false, triggerButton);
            return Promise.reject(error);
        }
    },

    /**
     * Show feedback notification for image export
     * @param {string} message - Message to display
     * @param {boolean} isSuccess - Whether it's a success or error
     * @param {HTMLElement} triggerButton - Optional button that triggered this
     */
    showFeedback(message, isSuccess = true, triggerButton = null) {
        const notification = document.createElement('div');
        notification.className = isSuccess ? 'export-notification success' : 'export-notification error';
        notification.textContent = isSuccess ? `✓ ${message}` : `✗ ${message}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${isSuccess ? '#2ed573' : '#ff4757'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }
};

/**
 * Onboarding & Tutorial System
 * Shows helpful tutorial on first visit
 */
const OnboardingSystem = {
    STORAGE_KEY: 'dokkan_calculator_tutorial_seen',

    /**
     * Check if user has seen the tutorial
     * @returns {boolean} True if already seen
     */
    hasSeenTutorial() {
        return localStorage.getItem(this.STORAGE_KEY) === 'true';
    },

    /**
     * Mark tutorial as seen
     */
    markAsSeen() {
        localStorage.setItem(this.STORAGE_KEY, 'true');
    },

    /**
     * Create and show tutorial overlay
     */
    show() {
        if (this.hasSeenTutorial()) return;

        const overlay = document.createElement('div');
        overlay.className = 'tutorial-overlay';
        overlay.id = 'tutorial-overlay';

        const content = document.createElement('div');
        content.className = 'tutorial-content';
        content.innerHTML = `
            <button class="tutorial-close">×</button>
            <h2>Welcome to Dokkan Battle ATK Calculator</h2>
            <div class="tutorial-steps">
                <div class="tutorial-step">
                    <span class="step-number">1</span>
                    <p><strong>Choose an Event</strong> - Select the event you're currently playing</p>
                </div>
                <div class="tutorial-step">
                    <span class="step-number">2</span>
                    <p><strong>Select Stage & Battle</strong> - Navigate to your current stage</p>
                </div>
                <div class="tutorial-step">
                    <span class="step-number">3</span>
                    <p><strong>Pick Phase & Enemy</strong> - Use tabs to switch phases quickly</p>
                </div>
                <div class="tutorial-step">
                    <span class="step-number">4</span>
                    <p><strong>Enter Your Stats</strong> - Input current buffs and conditions</p>
                </div>
                <div class="tutorial-step">
                    <span class="step-number">5</span>
                    <p><strong>Instant Results</strong> - See damage calculation immediately</p>
                </div>
            </div>
            <p style="text-align: center; margin-top: 20px; color: #a0aec0; font-size: 0.9rem;">
                <strong>Pro tip:</strong> Check different events to explore all available battles!
            </p>
            <button class="tutorial-start">Get Started</button>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        // Close tutorial when clicking the close button
        const closeBtn = content.querySelector('.tutorial-close');
        closeBtn.addEventListener('click', () => {
            overlay.remove();
            this.markAsSeen();
        });
        
        // Close tutorial when clicking outside the content (on the overlay)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                this.markAsSeen();
            }
        });
        
        // Close tutorial when clicking Get Started button
        const startBtn = content.querySelector('.tutorial-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                overlay.remove();
                this.markAsSeen();
            });
        }
    }
};

/**
 * Keyboard Shortcuts Handler - REMOVED
 * Focus is on core calculations, not navigation shortcuts
 */
// Keyboard shortcuts removed - not mandatory and can cause conflicts

// Initialize on page load if not already done
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Show tutorial to first-time visitors
        if (!OnboardingSystem.hasSeenTutorial()) {
            setTimeout(() => OnboardingSystem.show(), 500);
        }
    });
}
