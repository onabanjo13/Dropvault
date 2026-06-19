# DropVault — File Upload App

A modern, full-stack file upload and sharing web app. Upload, preview, share, and manage files with a clean dark UI.

## Features

- **Drag & Drop** — drop files directly onto the page or click to browse
- **Multi-file upload** — up to 10 files at once, 50MB each
- **Real-time progress bar** — per-file upload progress
- **Instant preview** — images, PDFs, videos, and audio preview in-app
- **Shareable links** — one-click copy download link for any file
- **File filtering & search** — filter by type, search by name
- **Auto-expiry** — files auto-delete after 7 days
- **Download counter** — tracks how many times each file was downloaded
- **Stats dashboard** — total files, storage used, download counts
- **Rate limiting** — 50 requests per 15 min per IP

## Tech Stack

- **Backend:** Node.js + Express + Multer
- **Frontend:** Vanilla HTML/CSS/JS (no frameworks, zero dependencies)
- **Hosting:** Render.com

---

## Deploy on Render (Free)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create dropvault --public --push
# OR: git remote add origin https://github.com/YOUR_USERNAME/dropvault.git && git push -u origin main
```

### Step 2 — Create a Render Web Service

1. Go to [render.com](https://render.com) and sign up / log in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select the **dropvault** repo
4. Use these settings:

| Setting | Value |
|---|---|
| **Environment** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

5. Click **"Create Web Service"**

> ⚠️ **Persistent storage note:** Render's free tier does not include a persistent disk. Files will be lost on each deploy/restart. For persistent storage, upgrade to the Starter plan ($7/mo) and Render will use the `render.yaml` disk config automatically — OR integrate a cloud storage service like Cloudinary or AWS S3.

### Step 3 — Go Live

Render will give you a URL like `https://dropvault.onrender.com`. That's it — you're live!

---

## Local Development

```bash
npm install
npm run dev   # uses nodemon for hot reload
# open http://localhost:3000
```

## Folder Structure

```
dropvault/
├── server.js          # Express backend
├── package.json
├── render.yaml        # Render deployment config
├── public/
│   └── index.html     # Full frontend (single file)
└── uploads/           # Uploaded files (git-ignored)
```
