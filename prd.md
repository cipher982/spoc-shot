Of course. Here is a full Product Requirements Document (PRD) for the "SPOC-Shot" demo application.

---

### **Product Requirements Document: "SPOC-Shot" Live Demo**

**Version:** 1.1
**Date:** June 12, 2025
**Status:** Core implementation complete.
**Author:** Cline (in collaboration with David Rose)

#### **1. Introduction & Vision**

**1.1. Problem Statement**
LLM-powered agents often rely on a multi-pass "ReAct" (Reason-Act) loop. When a tool call fails, the agent must initiate one or more new, full LLM requests to analyze the error and retry. This process is latent, expensive in terms of token consumption, and inefficient.

**1.2. Vision**
To create a compelling, live, interactive web application that visually and quantitatively demonstrates the superiority of a **single-pass, self-patching agent loop** (inspired by papers like SPOC) over the traditional multi-pass approach. The demo will serve as the centerpiece of a 20-minute technical presentation, making the benefits of this advanced architecture immediately obvious and memorable.

**1.3. Target Audience**
*   **Primary:** The presenter (David Rose).
*   **Secondary:** A technical audience of Data Scientists, AI Engineers, and Software Engineers at the team meeting.

#### **2. Goals & Objectives**

*   **P0 (Critical):** Visually prove that the single-pass method is significantly more efficient across three key metrics: **Latency**, **Token Usage**, and **LLM Round Trips**.
*   **P1 (High):** Provide a stable, reliable, and easy-to-control visual aid for a live presentation.
*   **P2 (Medium):** Demystify the underlying technical difference between the two agent architectures for the audience.
*   **P3 (Low):** Produce a clean, reusable codebase that can serve as a starting point for future agent development.

#### **3. User Stories & Features**

**Epic 1: A/B Comparison Framework**
*   **[COMPLETE] ✅ Story 1.1:** As a Presenter, I want to see two distinct modes, "Multi-Pass (Baseline)" and "Single-Pass (SPOC)," so that I can run them back-to-back for direct comparison.
*   **[COMPLETE] ✅ Story 1.2:** As a Presenter, I want a text input field to submit a prompt that reliably triggers a tool-use failure, so that I can consistently demonstrate the self-patching mechanism.
*   **[COMPLETE] ✅ Story 1.3:** As a Presenter, I want a single "Run" button that initiates the selected agent workflow.

**Epic 2: Real-time Performance Dashboard**
*   **[COMPLETE] ✅ Story 2.1:** As an Audience Member, I want to see large, clear, real-time counters for "Latency (ms)," "Tokens Used," and "LLM Calls," so that I can instantly grasp the quantitative difference between the two modes.
*   **[COMPLETE] ✅ Story 2.2:** As a Presenter, I want the metric counters to update live as the agent runs and reset to zero before each new run, ensuring a clean and fair comparison.

**Epic 3: Rich, Animated Log Stream**
*   **[COMPLETE] ✅ Story 3.1:** As an Audience Member, I want to follow the agent's step-by-step execution in a live-updating log panel, so that I can understand its reasoning process.
*   **[COMPLETE] ✅ Story 3.2:** As an Audience Member, I want each log entry to be visually distinct with icons, colors, and clear labels (e.g., `[PROPOSE] 🧠`, `[EXECUTE] ⚙️`, `[FAILURE] ❌`, `[PATCH] 🔧`, `[SUCCESS] ✅`, `[ANSWER] 💬`), so that the workflow is easy to parse at a glance.

**Epic 4: Technical Demystification View**
*   **[COMPLETE] ✅ Story 4.1:** As a Technical Audience Member, I want to see a small panel displaying a simplified pseudo-code snippet of the core agent loop, so that I can understand the fundamental architectural difference.
*   **[COMPLETE] ✅ Story 4.2:** As a Presenter, I want this code snippet to automatically change when I toggle the mode, visually reinforcing the difference between the multi-pass `for` loop and the single-pass `while` loop.

#### **4. Design & UX Requirements**

*   **Layout:** A four-panel dashboard layout:
    1.  **Top-Left (Controls):** Prompt input and Mode toggle.
    2.  **Top-Right (Metrics):** Three large, bold metric cards.
    3.  **Bottom-Left (Log Stream):** The primary view, showing the animated log of the agent's run.
    4.  **Bottom-Right (Code View):** The static panel showing the relevant pseudo-code.
*   **Styling:** A clean, modern, "dashboard" aesthetic using TailwindCSS. High-contrast text, clear iconography, and subtle animations on the log stream to enhance readability and engagement.
*   **Interactivity:** The UI must feel responsive. The "Run" button should provide immediate feedback, and the log stream should appear without perceptible delay.

#### **5. Technical Specifications & Architecture**

*   **Frontend:** A single `index.html` file.
    *   **Framework:** HTMX for server communication and partial page updates.
    *   **Styling:** TailwindCSS loaded from a CDN.
    *   **Client-Side Logic:** Minimal vanilla JavaScript to handle SSE events and update the metric counters.
*   **Backend:** A Python FastAPI application.
    *   **Endpoint (`/solve`):** Accepts a POST request with the prompt and mode.
    *   **Streaming:** Uses `sse-starlette` to stream structured JSON events to the frontend.
*   **Agent Logic (`app/agent.py`):**
    *   Will contain two distinct functions: `solve_multi_pass` (the existing logic) and `solve_single_pass` (the new logic).
    *   The agent will yield detailed JSON objects for each step, including `phase`, `data`, and cumulative `metrics`.
*   **Inference Server:**
    *   **Technology:** vLLM.
    *   **API:** Must be run with the `--openai-api-server` flag to be compatible with the Python `openai` client.
    *   **Core Requirement:** Must support `request_id` to enable KV-cache reuse, which is essential for the `solve_single_pass` function to work correctly.
*   **Deployment:** The vLLM server runs on a remote machine on port `8000`. The FastAPI server will run on the local machine on port `8001` to avoid conflicts. The demo will be accessed via a web browser on the local machine.
*   **Lessons Learned:**
    *   The initial FastAPI server setup had two conflicting routes for the root path (`/`), causing the browser to render HTML as plain text. This was resolved by consolidating into a single `HTMLResponse` route.
    *   A potential port conflict between the local Uvicorn server and the remote vLLM server (both defaulting to `8000`) was identified. The local server port was explicitly changed to `8001` to prevent this issue.

#### **6. Out of Scope**

*   **Fine-Tuning:** The "cold loop" of fine-tuning the model on failures will be discussed in the presentation but will **not** be implemented in this demo.
*   **User Management:** No login or user accounts.
*   **Data Persistence:** The application is stateless; results are not saved between runs.
*   **Production-Ready Code:** Error handling will be sufficient for the demo but not hardened for production use.

#### **7. Success Metrics**

*   **Primary:** The demo successfully runs both modes live and clearly demonstrates a **>30% improvement** in latency and token usage, and a reduction in LLM calls from **≥2 to 1**.
*   **Secondary:** The presenter can narrate the entire demo workflow without any technical glitches or unexpected behavior.
*   **Tertiary:** The audience asks questions that indicate they have understood the core concept and its potential impact.

---

quick facts: vllm is remote, dont install anything here. just connect to it. UV will manage everything. DO NOT manually modify the toml. just ask me to do it.
