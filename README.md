# TriLinesAt

**TriLinesAt** is a social 3-line diary application built on the [AT Protocol](https://atproto.com/) (Bluesky).
Based on the "Three Good Things" method, it encourages users to record three positive events before bed to foster a positive mindset.

## Features

-   **3-Line Diary**: A simple interface to record three good things of the day.
-   **Image Attachments**: Attach up to 4 images to your diary entry.
-   **Social**:
    -   **Following Feed**: See diary entries from users you follow.
    -   **Global Feed**: Discover entries from all TriLinesAt users.
    -   **Likes**: Interact with entries using the "Star" action (synced with PDS).
-   **Data Sovereignty**: All diary entries are stored in the user's own **Personal Data Server (PDS)** in the `blue.trilinesat.diary` collection.
-   **OAuth Authentication**: Secure login using Bluesky OAuth (no App Passwords required).
-   **Gamification**:
    -   **Streaks**: Track consecutive posting days.
    -   **Rankings**: View top users by total posts and current streaks.
    -   **Celebrations**: Fun confetti effects upon posting and achieving milestones.
-   **PWA**: Installable as a Progressive Web App for a native-like experience.

## Tech Stack

-   **Framework**: [SvelteKit](https://kit.svelte.dev/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Glassmorphism design)
-   **Protocol**: [AT Protocol](https://atproto.com/)
    -   [`@atproto/oauth-client-browser`](https://www.npmjs.com/package/@atproto/oauth-client-browser) for authentication.
    -   [`@atproto/api`](https://www.npmjs.com/package/@atproto/api) for PDS interactions.
-   **Deployment**: Cloudflare Pages (`adapter-cloudflare`)

## Development

### Prerequisites

-   Node.js (v18+)
-   npm

### Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/suibari/bsky_TriLinesAt.git
    cd bsky_TriLinesAt
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open `http://localhost:5173` in your browser.

    > **Note**: OAuth requires a publicly accessible URL or a specific localhost configuration registered with the OAuth client. For local development, ensure your `client-metadata.json` matches your environment.

## License

MIT License

Copyright (c) 2025 Suibari
