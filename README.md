# Barakah Development Centre Web App

A modern web application for the Barakah Development Centre ecosystem, featuring community/humanitarian services, learning and development programs, enterprise dispatching, and case management.

## Tech Stack
- **Framework**: TanStack Start (SSR)
- **Library**: React
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database / Backend**: Supabase
- **Hosting**: Vercel / Cloudflare

## Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm/bun installed.

### Installation

1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd Barakah-Development-Centre-Web-App
   ```

2. Install dependencies:
   ```sh
   npm install
   # or
   bun install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
   ```

4. Start the development server:
   ```sh
   npm run dev
   # or
   bun dev
   ```

## Development and Deployment
- To build the project: `npm run build`
- To preview the build locally: `npm run preview`
