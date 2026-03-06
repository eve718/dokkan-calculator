/**
 * Global Application Configuration
 * Centralized constants for timings, selectors, and styling
 * This prevents magic numbers scattered throughout the codebase
 * and makes future changes easier to manage
 */

const AppConfig = {
    // ============ ANIMATION TIMINGS ============
    // Page transitions and UI animations
    pageTransitionDuration: 300,      // ms for fade in/out effects
    inputDebounceDelay: 500,          // ms to wait before validating input
    inputCorrectionDelay: 800,        // ms before auto-correcting invalid input
    retryCheckDelay: 100,             // ms between retry attempts for DOM elements

    // ============ DOM SELECTORS & IDs ============
    // Primary container and content areas
    selectors: {
        content: '#content',
        breadcrumb: '#breadcrumb',
        enemyFormsContainer: '#enemy-forms-container',
        phaseSelect: '#phase-select',
    },

    // CSS class names
    cssClasses: {
        pageContent: 'page-content',
        pageActive: 'active',
        fadeOut: 'fade-out',
        fadeIn: 'fade-in',
        invisible: 'invisible',
    },

    // ============ INPUT VALIDATION ============
    // Default constraints for form inputs
    inputValidation: {
        errorBorderColor: '#ff4757',
        normalBorderColor: '',          // Empty string to reset to CSS default
        maxRetries: 5,                  // Number of retries before giving up on DOM element
    },

    // ============ NAMING PATTERNS ============
    // Patterns used for generating DOM element IDs
    // Keep these patterns consistent across all files
    idPatterns: {
        // Generates: "5150_input_id" (enemy_property format)
        enemy: (enemyId) => `enemy-${enemyId}`,
        input: (enemyId, inputId) => `${enemyId}_${inputId}`,
        output: (enemyId, outputId) => `${enemyId}_${outputId}`,
    },

    // ============ DEFAULT VALUES ============
    defaults: {
        emptyInputValue: 0,             // Default value when input is empty
    },

    // ============ MESSAGE TIMEOUTS ============
    // How long log messages should display (for future toast notifications)
    notifications: {
        errorDuration: 5000,            // ms to show error messages
        successDuration: 2000,          // ms to show success messages
    },

    // ============ VALIDATION METHODS ============
    /**
     * Safely retrieve an input element by enemy and input ID
     * @param {string} enemyId
     * @param {string} inputId
     * @returns {HTMLElement|null}
     */
    getInputElement: function(enemyId, inputId) {
        const elementId = this.idPatterns.input(enemyId, inputId);
        return document.getElementById(elementId);
    },

    /**
     * Safely retrieve an output element by enemy and output ID
     * @param {string} enemyId
     * @param {string} outputId
     * @returns {HTMLElement|null}
     */
    getOutputElement: function(enemyId, outputId) {
        const elementId = this.idPatterns.output(enemyId, outputId);
        return document.getElementById(elementId);
    },

    /**
     * Safely retrieve main content container
     * @returns {HTMLElement|null}
     */
    getContentContainer: function() {
        return document.querySelector(this.selectors.content);
    },

    /**
     * Safely retrieve breadcrumb element
     * @returns {HTMLElement|null}
     */
    getBreadcrumbContainer: function() {
        return document.querySelector(this.selectors.breadcrumb);
    },

    /**
     * Check if config values are valid (debugging helper)
     * @returns {boolean}
     */
    validate: function() {
        const errors = [];

        if (this.pageTransitionDuration <= 0) {
            errors.push('pageTransitionDuration must be positive');
        }
        if (this.inputDebounceDelay <= 0) {
            errors.push('inputDebounceDelay must be positive');
        }

        if (errors.length > 0) {
            console.warn('AppConfig validation errors:', errors);
            return false;
        }
        return true;
    }
};

// Validate config on load
AppConfig.validate();
