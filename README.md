# Insta List

A local Instagram influencer audit app. It deduplicates influencer handles, shows follower and post counts when supplied, filters supplied post data by period, extracts hashtags/collaborators/links, checks whether links still respond, and saves previous searches in `data/history.json`.

## Prerequisites

- **Runtime:** Python 3.10+ OR Node.js 18+
- **AI Research (Optional):** To use the AI fallback, you need Ollama installed and running locally with a model like `llama3` or `mistral`.
- **Graph API (Optional):** A Meta Developer App with Instagram Business Discovery permissions.

## Run

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Then open:

```text
http://localhost:5173
```

`start.ps1` uses Python first, then Node.js if Python is not available. The app has no third-party dependencies. Install Python from python.org or install Node.js 18+ if the start script says it cannot find a usable runtime.

## Graph API Setup

Open **Graph API settings** in the left panel and save:

```text
API version: v25.0
Your IG user ID: the Instagram Business/Creator account ID connected to your app
Access token: a valid Graph API token with Instagram permissions
```

Use the Instagram account ID shown in Meta Business Settings under **Accounts > Instagram accounts**. Paste the token from Graph API Explorer into **Access token**, then click **Save Graph API**.

Click **Test API** before running the full list. The default test target is `bluebottle`; a working setup will show a green Business Discovery result with follower and post counts. If the test fails, check that:

- the token was generated for the correct Meta app
- the token has `instagram_basic` and `pages_show_list`
- the Facebook Page is connected to the Instagram professional account
- the IG user ID is the Instagram account ID, not the Facebook Page ID

The token is stored locally in `data/graph_config.json`, which is ignored by git.

The app uses Instagram Graph API Business Discovery:

```text
/{your-ig-user-id}?fields=business_discovery.username({target}){username,name,biography,website,followers_count,follows_count,media_count,media.limit(100){...}}
```

This works for public Business/Creator accounts that the Graph API allows your app to discover. Personal/private accounts may fail or return limited data.

## Data Input

Paste handles one per line, Instagram profile URLs, or lines with counts:

```text
Cristiano Ronaldo
@creator, 125k followers, 842 posts
https://instagram.com/another_creator, 58,200 followers, 311 posts
```

Use **Load list** to fill the influencer box with the saved education influencer batch. The app deduplicates the batch before analyzing it.

The app has a small built-in resolver for common names, so `Cristiano Ronaldo` resolves to `@cristiano`. A live universal name search requires connecting an Instagram/compliant data API.

When you run an audit, the server first researches each influencer with Graph API if configured. If Graph API is not configured, it falls back to a limited public profile-page check.

The Posts view groups imported/provider posts by week and shows the post date, info, hashtags, collaborators, and link status.

For post details, hashtags, collaborators, and link checks, import JSON like this:

```json
[
  {
    "handle": "creator",
    "followers": 125000,
    "postCount": 842,
    "posts": [
      {
        "url": "https://instagram.com/p/example",
        "date": "2026-04-18",
        "caption": "New launch #beauty with @brand",
        "collaborators": ["brand"],
        "info": "Details at https://example.com"
      }
    ]
  }
]
```

Instagram does not expose reliable public scraping for follower counts and post history. For real live Instagram data, connect this app to the official Instagram Graph API or a compliant data export/provider.
