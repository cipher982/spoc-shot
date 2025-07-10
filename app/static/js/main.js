// Main Application Entry Point
import { TabManager } from './modules/tabs.js';
import { UncertaintyAnalyzer } from './modules/uncertainty.js';
import { RaceController } from './modules/race.js';

// Application State
const app = {
  modules: {},
  initialized: false
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 SPOC-Shot initializing...');
  
  try {
    // Initialize core modules
    app.modules.tabs = new TabManager();
    app.modules.uncertainty = new UncertaintyAnalyzer();
    app.modules.race = new RaceController();
    
    // Initialize legacy code view
    initCodeView();
    
    app.initialized = true;
    console.log('✅ All modules initialized successfully');
    
    // Expose app for debugging
    window.SPOCShot = app;
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
  }
});

// Initialize code view functionality
function initCodeView() {
  const codeView = document.getElementById('code-view');
  const multiPassTemplate = document.getElementById('multi-pass-code');
  
  if (codeView && multiPassTemplate) {
    codeView.innerHTML = multiPassTemplate.innerHTML;
  }
}

// Export for potential external usage  
export { app };