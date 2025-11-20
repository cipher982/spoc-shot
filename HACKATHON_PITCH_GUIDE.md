# HACKATHON_PITCH_GUIDE.md

## 1. The Hook (30 Seconds)
> *Goal: Grab attention immediately. Define the problem and the solution.*

**Script:**
"Hi everyone. We've all used LLMs. You type a prompt, wait a few seconds, and text appears. It feels like magic, but it's also a black box. 

What if the model is unsure? What alternatives did it consider? Why did it choose *that* word and not another? 

Today, we're unveiling **Glass Box LLM**: A fully browser-based, interactive visualization of Large Language Model thinking. 

We're not just generating text; we're exposing the probabilistic multiverse behind every single word, and giving *you* the power to explore it."

---

## 2. The Demo Walkthrough (2 Minutes)
> *Goal: Show, don't just tell. Prove the features work.*

### A. The Setup
*   **Action:** Open the app. Point out the "Model Uncertainty Analysis" dashboard.
*   **Script:** "Here we have Llama-3 running locally in the browser via WebGPU. No servers, total privacy."

### B. Visualizing Uncertainty
*   **Action:** Type a simple prompt like: `"In a hole in the ground there lived a..."`
*   **Action:** Click **Execute**.
*   **Observation:** Watch the tokens stream in.
*   **Script:** "As the story generates, look at the colors. Green means the model is confident. But these yellow and red tokens? That's where the model is hesitating. It's uncertain."

### C. The "Multiverse" Hover
*   **Action:** Hover over a specific word (e.g., "hobbit" or whatever it generates).
*   **Observation:** The tooltip appears showing candidates.
*   **Script:** "By hovering, we peel back the curtain. We see the 'roads not taken'. We can see the probability distribution for this exact moment in time."

### D. The "Branching" Feature (The 'Wow' Moment)
*   **Action:** Find an interesting word in the middle of the story. Click a different candidate from the tooltip.
*   **Observation:** The story instantly reverts to that point and generates a NEW path.
*   **Script:** "This is the killer feature. I don't just have to accept the output. I can click an alternative, and the model *branches* the reality from that exact point. We are actively exploring the latent space of the story."

---

## 3. Technical Achievements (The "How")
> *Goal: Impress the engineers/judges with the difficulty of what you built.*

**Key Talking Points:**

1.  **Zero-Server Architecture (WebGPU):**
    *   "We are running `Hermes-3-Llama-3.1-8B` entirely client-side using WebLLM and WebGPU. This democratizes access—you don't need an H100 cluster to analyze model behavior."

2.  **Custom Engine Hacking:**
    *   "Standard APIs don't support this. We had to bypass the high-level chat interface and use the low-level `engine.completions.create()` API."
    *   "We solved a critical state management bug: interrupting a GPU kernel mid-generation to splice the context window and restart instantly. We implemented custom `interruptGenerate()` handlers to prevent the engine from hanging."

3.  **Real-Time Entropy Visualization:**
    *   "We calculate entropy and perplexity on the fly, mapping log-probabilities to a semantic color scale (Green -> Red) to intuitively visualize model confidence."

---

## 4. Future Roadmap
> *Goal: Show this has legs beyond the hackathon.*

*   **Prompt Engineering Tool:** "Use the uncertainty visualization to find weak points in your prompts."
*   **Education:** "Teach students how LLMs actually work—predicting the next token based on probability."
*   **Creative Writing:** "A co-writer that suggests alternatives instead of just overwriting your work."

---

## 5. Closing
**Script:**
"Glass Box LLM turns the black box into a playground. It transforms passive generation into active exploration. Thank you."

