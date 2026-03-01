Browser in Browser (BiB)
Hackathon project — let users describe a custom dashboard for any website, and get a live, auto-scraped
page back.
What This Is
BiB is a web app that lets anyone create a personalized, read-only dashboard for any website — without writing
any code. A user describes what they want to see ("show me all my GitHub repos and open pull requests"), and
BiB uses an AI browser agent to scrape that data from the real site and render it in a clean, custom layout.
The result is a single, purpose-built page that surfaces exactly what the user cares about, with direct links back
to the real site for any action they want to take.
Core Goals (MVP)
Natural language input — user describes what data they want to see
AI scraping — a Browser Use agent logs into the real site and extracts the requested data
Custom dashboard output — a generated page displays that data cleanly, with links out to the real site
Auth handled by the user — when the target site requires login, the user is directed to a Browser Use
browser window to authenticate manually; the agent then takes over from the authenticated session
What We Are NOT Building (For Now)
To keep scope tight for the hackathon, the following are explicitly out of scope:
Two-way interactions / writing back to the real site (no form fills, button clicks, etc.)
Multiple simultaneous target sites
Passthrough embedded browser views
Persistent saved layouts across sessions
Self-healing selector mappings
Full production auth flows (re-auth on expiry, etc.)
The MVP is read-only: scrape data, display it nicely, link out.
Demo Scenario
Target site: GitHub
User prompt: "Show me all my repositories and my open pull requests"
What BiB does:
1. Spawns a Browser Use agent pointing at GitHub
2. If the user isn't authenticated, opens the browser window for them to log in manually
3. Agent navigates GitHub and scrapes: list of repos (name, description, last updated, URL) and open PRs
(title, repo, status, URL)
4. BiB renders a clean dashboard page with two sections — Repositories and Pull Requests — each item
linking back to GitHub
That's the full loop.
How It Works
The backend has two distinct steps before the dashboard is rendered.
User describes what they want
│
▼
───────────────────────────────
STEP 1: PROFILER
───────────────────────────────
A Browser Use agent visits the
target site and figures out:
- What pages/endpoints to visit
- What navigation steps are needed
- The shape of the data to return
(field names, types, structure)
│
▼
Profiler outputs a "scrape plan":
a structured description of how
to get the data and what it looks like
│
▼
───────────────────────────────
STEP 2: SCRAPER
───────────────────────────────
A second Browser Use agent follows
the scrape plan, navigates the site,
and extracts the actual data —
returning it as structured JSON
matching the schema from Step 1
│
├─── Site requires auth?
│ │
│ ▼
│ User directed to browser window to log in manually
│ Agent waits / picks up authenticated session
│
▼
Structured data returned to BiB
│
▼
LLM generates a dashboard layout
(or a template is filled with the data)
│
▼
User sees their custom page
with links back to the real site
Architecture
Frontend (Web App)
Simple web UI where the user enters a target site URL and describes what they want
Displays the generated dashboard once scraping is complete
No Electron — just a local web server the user opens in their regular browser
Backend (Python)
Receives the user's request
Manages the Browser Use agent lifecycle
Exposes the scraped data to the frontend
Optionally calls an LLM to generate the dashboard layout from the scraped data
Browser Use Agent
Runs locally
Uses a persistent browser session so the user only needs to authenticate once
Navigates the target site, finds the requested data, and returns it as structured JSON
Browser Use Integration
This project is built on Browser Use, a Python library for LLM-driven browser automation.
Step 1: Profiler Agent
The profiler visits the target site and produces a scrape plan — the navigation steps needed and the shape of the
data to be returned. It does not extract real user data; it just figures out how to get it.
python
from browser_use import Agent, Browser, ChatBrowserUse
from pydantic import BaseModel
class FieldSchema(BaseModel):
name: str
type: str description: str
# e.g. "string", "url", "date"
class DatasetSchema(BaseModel):
dataset_name: str
navigation_steps: list[str] fields: list[FieldSchema]
# plain English steps the scraper should follow
class ScrapePlan(BaseModel):
datasets: list[DatasetSchema]
async def run_profiler(site_url: str, user_request: str) -> ScrapePlan:
browser = Browser(headless=False, storage_state="./session.json")
profiler_task = f"""
The user wants: "{user_request}"
Visit {site_url} and figure out:
1. What pages need to be visited to find this data
2. What navigation steps are required to reach each page
3. The exact fields available for each piece of data (names, types)
Do NOT collect the actual data. Just return a plan and schema.
"""
agent = Agent(
task=profiler_task,
browser=browser,
llm=ChatBrowserUse(),
output_model_schema=ScrapePlan,
)
history = await agent.run()
return history.structured_output
Step 2: Scraper Agent
The scraper receives the plan from the profiler and executes it, returning real data matching the agreed schema.
python
async def run_scraper(site_url: str, scrape_plan: ScrapePlan) -> dict:
browser = Browser(headless=False, storage_state="./session.json")
scraper_task = f"""
Follow this scrape plan exactly and return the data as JSON.
Plan:
{scrape_plan.model_dump_json(indent=2)}
For each dataset, follow the navigation steps and extract all fields listed.
Return a JSON object where each key is the dataset_name and the value is
a list of records matching that dataset's fields.
"""
agent = Agent(
task=scraper_task,
browser=browser,
llm=ChatBrowserUse(),
)
history = await agent.run()
return history.final_result()
Example End-to-End (GitHub)
python
plan = await run_profiler(
site_url="https://github.com",
user_request="Show me all my repositories and open pull requests",
)
# plan now describes: which pages to visit, what fields exist for repos and PRs
data = await run_scraper(
site_url="https://github.com",
scrape_plan=plan,
)
# data is structured JSON ready to render into the dashboard
Auth Handling
The user logs in manually in the Browser Use browser window the first time. After that, the session is saved to
session.json and reused on subsequent runs.
python
browser = Browser(
headless=False, # Keep visible so user can log in
storage_state="./session.json", # Load saved cookies; save new ones on close
)
If no saved session exists, the browser opens at the target site's login page and waits. Once the user logs in, the
agent automatically continues from the authenticated state.
Environment Setup
bash
# Install dependencies
pip install browser-use
uvx browser-use install # installs Chromium
# .env
BROWSER_USE_API_KEY=
... # from cloud.browser-use.com (includes $10 free credit)
# Optional — if using a different LLM for dashboard generation
ANTHROPIC_API_KEY=
...
OPENAI_API_KEY=
...
ChatBrowserUse is the recommended LLM for the agent — it's optimized specifically for browser automation
tasks and is the fastest option. A separate, cheaper LLM can be used for the dashboard layout generation step if
needed.
Repo Structure (Suggested)
bib/
├── backend/
│ ├── main.py │ ├── agent.py # Web server (FastAPI or similar), request handling
# Browser Use agent setup, task execution, session management
│ ├── models.py # Pydantic models for scraped data (Repository, PullRequest, etc.)
│ └── session.json # Persisted auth state (gitignored)
├── frontend/
│ ├── index.html # Input form (target site + description)
│ └── dashboard.html # Generated dashboard output
├── .env
├── .env.example
└── README.md
Development Notes for Agents
There are always two agent calls per request: profiler then scraper. The profiler determines the
navigation plan and data schema; the scraper executes that plan and returns real data. Keep them as
separate agent invocations with separate prompts — don't try to combine them into one.
The profiler's output drives the scraper's input. The scraper should not make decisions about what to
collect or how to navigate — it follows the plan. If the scraper is going off-script, the profiler prompt
needs to be more specific.
The agent is the source of truth for data. Don't try to hardcode selectors or scrape with BeautifulSoup
— let Browser Use handle all navigation and extraction.
The browser must run headless=False so the user can authenticate manually if needed. Don't change
this.
session.json should be gitignored. It contains auth cookies.
The output of the agent should always be structured JSON (via consumes this directly — do not return freeform text from the agent.
output
_
_
schema ). The frontend
Agent task prompts are the main lever for quality. If the agent is missing data or hallucinating,
improve the task prompt first before touching anything else. See the Browser Use prompting guide for
tips.
Flash mode is available ( flash
_
mode=True Useful once the prompts are working well.
The dashboard layout can be a static HTML template filled with the scraped JSON, or LLM-generated
React/HTML from the data. Either approach works — keep it simple.
model
on the Agent) to skip internal reasoning steps and run faster.
References
Browser Use Docs
Browser Use — Agent Parameters
Browser Use — Output Format
Browser Use — Authentication
Browser Use — Prompting Guide
Browser Use — Supported Models
