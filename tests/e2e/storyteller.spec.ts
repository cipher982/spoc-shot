import { test, expect } from '@playwright/test';

test.describe('The Storyteller - Basic Functionality', () => {
  test('should load the storyteller interface', async ({ page }) => {
    await page.goto('/');

    // Check that the page title is correct
    await expect(page).toHaveTitle('The Storyteller\'s Quill');

    // Check for the main header
    await expect(page.getByText('The Storyteller')).toBeVisible();

    // Check for the subtitle
    await expect(page.getByText('Weaving tales from the ether, one rune at a time')).toBeVisible();

    // Check for the control panel elements
    await expect(page.getByText('The Tale\'s Beginning')).toBeVisible();
    await expect(page.locator('#prompt-input')).toBeVisible();
  });

  test('should have working parameter controls', async ({ page }) => {
    await page.goto('/');

    // Check that temperature slider exists and has default value
    const tempSlider = page.locator('#temp-slider');
    await expect(tempSlider).toBeVisible();
    await expect(tempSlider).toHaveValue('0.7');

    // Check temperature display
    await expect(page.getByText('Chaos (Temp): 0.7')).toBeVisible();

    // Check that top-p slider exists and has default value
    const topPSlider = page.locator('#top-p-slider');
    await expect(topPSlider).toBeVisible();
    await expect(topPSlider).toHaveValue('0.9');

    // Check top-p display
    await expect(page.getByText('Focus (Top-P): 0.9')).toBeVisible();
  });

  test('should update parameter displays when sliders change', async ({ page }) => {
    await page.goto('/');

    // Change temperature slider
    const tempSlider = page.locator('#temp-slider');
    await tempSlider.fill('1.2');
    await expect(page.getByText('Chaos (Temp): 1.2')).toBeVisible();

    // Change top-p slider
    const topPSlider = page.locator('#top-p-slider');
    await topPSlider.fill('0.5');
    await expect(page.getByText('Focus (Top-P): 0.5')).toBeVisible();
  });

  test('should have the write button enabled initially', async ({ page }) => {
    await page.goto('/');

    const writeButton = page.locator('#run-button');
    await expect(writeButton).toBeVisible();
    await expect(writeButton).toBeEnabled();
    await expect(writeButton).toHaveText('Write');
  });

  test('should show the initial placeholder text', async ({ page }) => {
    await page.goto('/');

    // Check for the initial placeholder text in the story area
    await expect(page.getByText('"The blank page is the most terrifying thing the writer faces..."')).toBeVisible();
    await expect(page.getByText('Type a topic above and command the quill to write.')).toBeVisible();
  });
});

test.describe('The Storyteller - Input Validation', () => {
  test('should accept text input in the prompt field', async ({ page }) => {
    await page.goto('/');

    const promptInput = page.locator('#prompt-input');
    await promptInput.fill('A robot learning to paint in a post-apocalyptic garden');

    // Verify the input was accepted
    await expect(promptInput).toHaveValue('A robot learning to paint in a post-apocalyptic garden');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/');

    const promptInput = page.locator('#prompt-input');
    await promptInput.fill('Test story prompt');

    // Test Ctrl+Enter (or Cmd+Enter on Mac) to generate
    // Note: This might not work in headless mode due to WebLLM requirements
    await page.keyboard.press('Meta+Enter'); // Cmd+Enter on Mac

    // We can't easily test the actual generation without WebLLM,
    // but we can at least verify the UI doesn't break
    await expect(page.locator('#run-button')).toBeVisible();
  });
});

test.describe('The Storyteller - UI Responsiveness', () => {
  test('should maintain layout on different viewport sizes', async ({ page }) => {
    await page.goto('/');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByText('The Storyteller')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByText('The Storyteller')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByText('The Storyteller')).toBeVisible();
  });
});
