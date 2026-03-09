/**
 * Initialize the application and load the events page
 * Triggered when the DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize footer to be visible
    const footer = document.querySelector('footer');
    if (footer) {
        footer.style.opacity = '1';
    }
    
    showPage('events');
    
    // Setup character input listeners for damage calculator
    setTimeout(() => {
        setupCharacterInputListeners();
    }, 100);
});