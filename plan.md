Browser in Browser (BiB) — Project Specification
What Is This?
BiB is a web tool that lets users generate a custom, minimal UI for any website. The user authenticates into a target site, describes in plain English what data and actions they want, and BiB generates a clean React interface tailored exactly to that request. The generated UI stays live — it reads real data from the site and can execute real actions on it, all driven by Browser Use agents running in the backend.

The user never interacts with the real website directly. They only interact with the generated UI.

Tech Stack
Frontend: React (Vite)
Backend: FastAPI (Python)
Browser Automation: Browser Use (Python library, runs inside the FastAPI process)
LLM: Anthropic Claude
Generated UI Styling: Tailwind CSS via CDN
High Level Architecture
The system has three layers that communicate in a strict sequence:

React Frontend — the user-facing app. Has two panels: a setup panel where the user configures their session, and a display panel that renders the generated UI inside an iframe. The frontend never talks to the real website directly. It only talks to the FastAPI backend via REST, and to the generated UI inside the iframe via postMessage.

FastAPI Backend — the orchestration layer. Receives requests from the frontend, calls Claude for LLM tasks, manages Browser Use agents, reads and writes the instruction registry, and returns results to the frontend. The Browser Use library and the Chromium browser run directly inside this process.

Browser Use / Chromium — a persistent headed Chromium browser that Browser Use manages. It is spawned once when the user starts a session and stays alive for the entire session. All Browser Use agents share this single browser instance. This is the only thing that ever touches the real website.

The Instruction Registry
The instruction registry is the most important concept in the system. It is a JSON file stored on disk that acts as a named library of verified browser tasks.

Each entry in the registry has a name (the instruction name), a plain English description, the step-by-step instructions the Browser Use agent should follow to complete the task, the expected output schema describing the shape of the JSON data the agent should return, a display hint telling the UI how to render the data, and a type indicating whether the task returns data or performs an action with no return value.

Instructions are written to this file during the verification phase and read back during the runtime phase. Because they are stored on disk, the backend can be restarted without losing them and the verification phase never needs to run again for the same set of tasks.

User Flow
Phase 1 — Authentication
The user provides the URL of the target website. The backend spawns a headed Chromium browser that is visible on screen. The user logs into the website manually in this browser window. Once logged in, the session cookies are persisted inside the browser instance and all subsequent Browser Use agents will automatically be authenticated.

Phase 2 — User Prompt
The user types a single plain English prompt describing both what data they want and how they want it displayed. For example: "Show me my open pull requests across all repos as a card list, my top 5 repositories by star count as a leaderboard, and a button to create a new issue."

Phase 3 — Task Planning
The backend sends the user's prompt to Claude. Claude's job is to decompose the prompt into a list of discrete, atomic tasks. Each task is either a data task (the agent fetches something and returns it as structured JSON) or an action task (the agent performs something on the site with no data returned). Claude also identifies a suggested layout for the overall UI. This output is structured JSON — Claude is explicitly instructed to return only the JSON with no explanation.

Phase 4 — Task Verification
For each task in the plan, the backend runs a Browser Use agent against the authenticated browser. The agent is given the task description and the expected output schema and told to execute the task and return only the JSON result. When the agent succeeds, the backend stores the task as a verified instruction in the instruction registry, including the agent's action history as reusable step-by-step instructions, the confirmed output schema, and a sample of the real data the agent returned. All verification agents run in parallel to save time. If a task fails, it is skipped and the rest continue.

Phase 5 — UI Generation
Once all tasks are verified, the backend sends Claude the full list of verified instructions along with their sample data, display hints, and the suggested layout. Claude generates a single React component called GeneratedPage. This component receives all task data through a single prop and renders it according to the display hints. Navigation links call a navigateTo function. Action buttons call an executeAction function. Claude is explicitly instructed to produce no import statements since React is loaded globally in the iframe environment. Claude returns only the component code with no explanation or markdown.

Phase 6 — Render in iframe
The generated component string is sent to the frontend. The frontend renders it inside a persistent iframe shell. The iframe shell is written to the iframe document once on first load — it loads React, ReactDOM, Babel, and Tailwind from CDN and sets up postMessage listeners. On subsequent updates it receives new component code via postMessage and re-evaluates it without reloading the shell, avoiding the CDN reload latency on every update.

Phase 7 — Runtime Data Fetching
The frontend maintains a list of all instruction names that are data tasks. It calls the backend's data endpoint for each instruction by name. The backend looks up the instruction in the registry, hands it to a Browser Use agent with the stored step-by-step instructions, the agent executes the task and returns JSON, and the backend returns that JSON to the frontend. The frontend posts the fresh data into the iframe via postMessage and the generated UI re-renders with the latest values. This can be triggered on a polling interval or on demand.

Phase 8 — Action Execution
When the user clicks an action button in the generated UI, the iframe fires a postMessage to the parent frontend with the instruction name. The frontend calls the backend's action endpoint with that instruction name. The backend looks up the instruction in the registry, runs the Browser Use agent to execute the action, and on completion re-fetches all data tasks and returns the fresh data to the frontend. The frontend updates the iframe with the new data.

Backend Endpoints
Start Auth Session
Receives the target URL. Spawns a persistent headed Chromium browser. Returns when the browser is ready for the user to authenticate manually.

Plan Tasks
Receives the target URL and the user's prompt. Calls Claude to decompose the prompt into a structured list of tasks with descriptions, output schemas, display hints, and types. Returns the task plan.

Verify Tasks
Receives the task plan. Runs Browser Use agents in parallel to verify each task against the real site. Writes all successfully verified tasks to the instruction registry JSON file. Returns the verified tasks including sample data.

Generate UI
Receives the verified tasks and layout hint. Calls Claude to generate the React component string. Returns the component code.

Get Data by Instruction Name
Receives an instruction name as a URL parameter. Looks up the instruction in the registry. Runs a Browser Use agent with the stored instructions. Returns the JSON data the agent produces.

Execute Action by Instruction Name
Receives an instruction name. Looks up the instruction in the registry. Runs a Browser Use agent to perform the action. On completion re-runs all data instructions and returns fresh data for all of them.

List Instructions
Returns all entries currently stored in the instruction registry. Used by the frontend to know which instruction names exist and what type each one is.

Frontend Components
App
The top-level component. Manages the overall session state including the current phase (auth, prompt, loading, display), the list of verified instruction names, the generated component code, and the current task data. Handles all postMessage events from the iframe. Manages the polling cycle for data tasks.

Setup Panel
A step-by-step configuration UI. First collects the target URL and triggers auth. Then collects the user's prompt and triggers the full pipeline: plan, verify, generate. Shows loading feedback for each step so the user knows what is happening.

Generated UI
Manages the iframe. Writes the iframe shell once on mount. Sends new component code into the iframe via postMessage when it changes. Sends data updates into the iframe via postMessage when fresh data arrives. Listens for outgoing postMessage events from the iframe for navigation and action triggers. Handles iframe height resizing.

iframe Shell Behavior
The iframe shell is a minimal HTML document written into the iframe once on first load. It loads React, ReactDOM, Babel, and Tailwind from CDN. It defines the navigateTo and executeAction functions, which both fire postMessage events to the parent window. It listens for incoming postMessage events from the parent: a RENDER event which evaluates the new component code with Babel and mounts it with React, and a DATA_UPDATE event which re-renders the existing component with fresh task data. After every render it fires a RESIZE postMessage to tell the parent how tall the content is so the iframe can be resized accordingly.

Instruction Registry File Structure
The registry is a flat JSON file stored on the backend. The top level is an object where each key is the instruction name and each value is an object containing the instruction name, the plain English description, the step-by-step instructions string derived from the Browser Use agent's action history, the output schema, the sample output from the verification run, the display hint, and the task type. The file is read and written by simple file IO on the backend. No database is needed.

LLM Responsibilities
Claude is called in two places only.

Task planning: Claude receives the target URL and the user's plain English prompt. It returns a structured JSON object containing a list of tasks and a layout hint. Each task has an id, description, expected output schema, display hint, and type. Claude must return only JSON with no explanation.

UI generation: Claude receives the list of verified tasks including their sample data and display hints, and the overall layout hint. It returns a single React component function called GeneratedPage that accepts tasks, navigateTo, and executeAction as props. It renders each task's data according to its display hint. It uses Tailwind for styling. It contains no import statements. It calls navigateTo for navigation and executeAction for action buttons. Claude must return only the component code with no explanation and no markdown fences.

Browser Use Agent Responsibilities
Browser Use agents are called in two places only.

Verification: Each agent receives a task description and expected output schema. It navigates the real site, finds the relevant data or performs the action, and returns only the JSON result matching the schema. The agent's action history after a successful run is stored as the reusable instructions for that task.

Runtime execution: Each agent receives the stored instructions string and the output schema for a named task. It follows those instructions, executes the task, and returns only the JSON result. Because it has the verified instructions from the discovery run it does not need to rediscover the flow.

Key Design Decisions
One persistent browser: A single Chromium instance stays alive for the whole session. This means authentication happens once and all agents are automatically authenticated. It also avoids the overhead of spawning a new browser for every request.

Instructions stored on disk: Verified instructions are written to a JSON file. This means the backend can restart without losing the verification work, and the same instructions can be reused across many runtime calls without re-running the discovery agents.

iframe isolation: The generated React component runs in a completely isolated iframe context. It cannot access or interfere with the parent app's state. All communication between the generated UI and the parent app flows through a single postMessage channel with explicit message types.

Scrape on demand, not continuously: There is no background polling loop on the backend. Data is only fetched when the frontend explicitly requests it by calling a named instruction endpoint. This keeps the backend simple and avoids hammering the real site with unnecessary requests.

Parallel verification: All task verification agents run simultaneously using async parallel execution. This keeps the setup phase fast even when the user has requested many tasks.


