// Tab Management Module
export class TabManager {
  constructor() {
    this.init();
  }

  init() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    console.log('🔍 Tab initialization:', {
      tabButtons: tabButtons.length,
      tabPanels: tabPanels.length
    });
    
    if (tabButtons.length === 0 || tabPanels.length === 0) {
      console.error('❌ Tab elements not found!');
      return;
    }
    
    tabButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(button.dataset.tab, tabButtons, tabPanels);
      });
    });
    
    console.log('✅ Tab management initialized');
  }

  switchTab(targetTab, tabButtons, tabPanels) {
    console.log('🔄 Switching to tab:', targetTab);
    
    // Update tab buttons
    tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${targetTab}"]`).classList.add('active');
    
    // Update tab panels
    tabPanels.forEach(panel => panel.classList.remove('active'));
    const targetPanel = document.getElementById(`${targetTab}-content`);
    if (targetPanel) {
      targetPanel.classList.add('active');
      console.log('✅ Tab switched to:', targetTab);
    } else {
      console.error('❌ Target panel not found:', `${targetTab}-content`);
    }
  }
}