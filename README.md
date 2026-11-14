# FaceMorph Studio

Ethical, client-side video face swap studio powered by WebGPU and WebAssembly. Features strict consent tracking, real-time character tracking, and zero cloud uploads without consent.

---

## 1. Architecture & Privacy Guarantees

- **100% Client-Side Processing**: All video decoding, face detection, affine landmark alignment, Reinhard color matching, and video synthesis execute directly inside the user's browser sandbox via WebGPU or multi-threaded WASM.
- **Zero Server Face Logging**: Face pictures and video content are never transmitted to external servers or logged in telemetry.
- **Mandatory Consent Logging**: Only the uploader's own face or explicitly authorized portraits may be synthesized; every project creation cryptographically requires `consent.accepted == true`.
- **Ethics Watermarking**: Built-in visual watermark ("FaceMorph Studio • AI Synthesized") on all free exports to prevent non-consensual deepfakes.
- **Artifact Protection**: Automatically skips face swapping when a character is lost/occluded for more than 0.5s, preventing visual warping.

---

## 2. Firebase Setup & Deployment Guide

This repository contains production-ready Firebase configurations and security rules:
- `firebase.json`: Hosting, Firestore, Storage, and Functions configuration.
- `firestore.rules`: Enforces user isolation, consent validation, and immutable quota counters.
- `storage.rules`: Strict file size caps (Face: 10 MB, Video: 500 MB, Result: 1 GB) and MIME type whitelists.
- `functions/`: Cloud Functions v2 in TypeScript (`onUserCreate`, `recordExport`, `deleteUserData`).

### Step 1: Create Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Name your project (e.g., `facemorph-studio`) and enable Google Analytics if desired.
3. In Project Settings, register a **Web app** (`</>`) and copy the `firebaseConfig` object.

### Step 2: Enable Providers
1. **Authentication**: Go to **Build > Authentication > Sign-in method**. Enable **Email/Password** or **Anonymous / Google** sign-in.
2. **Cloud Firestore**: Go to **Build > Firestore Database > Create database**. Select production mode and your preferred cloud region.
3. **Cloud Storage**: Go to **Build > Storage > Get started**.

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env.local` and populate the keys:
```bash
cp .env.example .env.local
```
Fill in the `VITE_FIREBASE_*` variables from your Firebase Console.

### Step 4: Install Firebase CLI & Login
```bash
npm install -g firebase-tools
firebase login
firebase use --add <YOUR_PROJECT_ID>
```

### Step 5: Deploy Security Rules
Deploy Firestore and Storage security rules:
```bash
firebase deploy --only firestore:rules,storage:rules
```

### Step 6: Deploy Cloud Functions
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### Step 7: Build & Deploy Hosting
```bash
npm run build
firebase deploy --only hosting
```

---

## 3. Local Development & Testing

### Running the App
```bash
npm run dev
```
Open `http://localhost:3000` in Chrome/Edge (with WebGPU enabled).

### Running Unit Tests
All core algorithms (tracking, similarity transforms, color matching, quota management, and Firebase emulator rules) are unit-tested with Node test runner:
```bash
npx --yes tsx --test src/utils/tracker.test.ts
npx --yes tsx --test src/utils/similarityTransform.test.ts
npx --yes tsx --test src/utils/colorMatch.test.ts
npx --yes tsx --test src/utils/quota.test.ts
npx --yes tsx --test tests/firebase.rules.test.ts
```

---

## 4. Safety & Abuse Reporting
To report non-consensual media or misuse of FaceMorph Studio, email our safety team at:
`safety@facemorph.studio`
