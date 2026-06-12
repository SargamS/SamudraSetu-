# 🌊 SamudraSetu

### AI-Powered Maritime Logistics & Sea-Bridge Tracking Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-99.5%25-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-AI--Powered-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://samudra-setu-eta.vercel.app)

**A real-time maritime logistics platform bridging the gap between sea routes and smart operations.**

[🌐 Live Demo](https://samudra-setu-eta.vercel.app) · [Report Bug](https://github.com/SargamS/SamudraSetu-/issues) · [Request Feature](https://github.com/SargamS/SamudraSetu-/issues)

</div>

---

## 🧭 Overview

**SamudraSetu** (Sanskrit: *समुद्रसेतु* — "Bridge Over the Sea") is a full-stack maritime logistics and vessel tracking platform that combines real-time geolocation, interactive mapping, and AI-driven intelligence to streamline sea-bridge operations.

The platform enables operators and logistics teams to monitor vessels, manage routes, and receive AI-generated operational insights — all from a single, intuitive web interface. Built on a modern TypeScript/React stack with Firebase as the real-time backbone and Google Gemini powering the intelligence layer, SamudraSetu is designed for both scale and speed.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🗺️ **Live Vessel Tracking** | Real-time geolocation with Leaflet maps and react-leaflet for interactive maritime route visualization |
| 🤖 **Gemini AI Assistant** | Google Gemini-powered chat interface for operational queries, route recommendations, and logistics intelligence |
| 🔥 **Real-Time Database** | Firebase Firestore for live data sync across all connected clients with custom security rules |
| 📍 **Geolocation Integration** | Browser geolocation API for positioning; permissions managed via the app manifest |
| 🎞️ **Smooth Animations** | Framer Motion-powered transitions for a polished, app-like feel |
| 📱 **Responsive Design** | Tailwind CSS v4 with full mobile and desktop support |
| 🔒 **Secure Data Layer** | Custom Firestore security rules (`firestore.rules`) with role-based access patterns |


<p align="center">
  <img src="assets/readme.png" width="700"/>
</p>
<div align="center">


## 🛠️ Tech Stack

**Frontend**
- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org/) — type-safe component architecture
- [Vite 6](https://vitejs.dev) — next-generation frontend build tooling
- [Tailwind CSS v4](https://tailwindcss.com) — utility-first responsive styling
- [Framer Motion](https://www.framer.com/motion/) — declarative animation system
- [Lucide React](https://lucide.dev) — icon system

**Mapping & Geolocation**
- [Leaflet](https://leafletjs.com) + [react-leaflet](https://react-leaflet.js.org/) — interactive maritime maps
- Browser Geolocation API — real-time position tracking

**AI & Intelligence**
- [Google Gemini AI](https://deepmind.google/technologies/gemini/) (`@google/genai`) — conversational AI for logistics operations

**Backend & Data**
- [Firebase](https://firebase.google.com) — Firestore real-time database + Authentication
- Custom Firestore Security Rules — field-level data protection

**Deployment**
- [Vercel](https://vercel.com) — edge-deployed, globally distributed

---

## 🚀 Getting Started

### Prerequisites

```bash
Node.js >= 18
Firebase project with Firestore enabled
Google Gemini API key
```

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/SargamS/SamudraSetu-.git
cd SamudraSetu-

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# → Add VITE_FIREBASE_*, VITE_GEMINI_API_KEY

# 4. Start the development server
npm run dev
# → App runs at http://localhost:3000
```

### Build for Production

```bash
npm run build      # compile TypeScript + bundle
npm run preview    # preview the production build locally
```

---

## 📁 Project Structure

```
SamudraSetu-/
├── src/                        # Application source
│   ├── components/             # Reusable UI components
│   ├── pages/                  # Route-level page components
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # Firebase & Gemini API clients
│   └── types/                  # TypeScript type definitions
├── public/                     # Static assets
├── assets/                     # Images and media
├── firestore.rules             # Firestore security rules
├── firebase-blueprint.json     # Firebase project configuration
├── metadata.json               # App manifest with geolocation permissions
├── vite.config.ts              # Vite build configuration
├── tsconfig.json               # TypeScript compiler config
└── vercel.json                 # Vercel deployment config (SPA routing)
```

---

## 🔬 AI & ML Concepts Applied

- **Large Language Model Integration** — Gemini AI is integrated as a logistics assistant capable of answering domain-specific questions about maritime operations, route optimization, and cargo management
- **Prompt Context Engineering** — Application state (route data, vessel positions) is injected into Gemini prompts to produce contextually grounded, actionable responses
- **Real-Time Data Streams** — Firestore listeners create a reactive data pipeline analogous to streaming ML inference — downstream UI components update instantly as backend data changes
- **Geospatial Reasoning** — Leaflet-based map views enable spatial pattern recognition for route planning, mirroring concepts in geospatial ML (clustering, anomaly detection on trajectories)

---

## 🌍 Domain Context

India handles over **95% of its trade by volume** through maritime routes. SamudraSetu addresses the operational complexity of sea-bridge logistics — coordinating vessel positions, cargo status, and route efficiency in real time. The platform name references the legendary bridge of Indian mythology, symbolizing the connection between two distant shores.

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/NewFeature`)
3. Commit your changes (`git commit -m 'Add NewFeature'`)
4. Push to the branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License.

---

<div align="center">

**Built to modernize India's maritime logistics ecosystem** 🇮🇳

*If this project resonates with you, drop a ⭐ on the repo!*

</div>
