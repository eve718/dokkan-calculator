/**
 * Utilities Module - Shared Functionality
 * 
 * Handles favorites system, theme management, clipboard operations,
 * image export, and onboarding features
 */

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
