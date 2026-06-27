# Deployment Guide for DMS Project

## Overview
- **Frontend**: Deployed on Netlify
- **Backend**: Deployed on Render
- **Database**: MongoDB Atlas (already set up)

---

## Step 1: Deploy Backend on Render

### 1.1 Prepare Your Repository
Make sure your code is pushed to GitHub/GitLab.

### 1.2 Deploy to Render
1. Go to [https://render.com/](https://render.com/) and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub/GitLab repository
4. Configure the service:
   - **Name**: `dms-backend` (or your preferred name)
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables in Render dashboard:
   - `NODE_ENV`: `production`
   - `MONGO_URI`: your MongoDB Atlas connection string (from backend/.env)
   - `JWT_SECRET`: generate a secure random string (or use your existing one)
   - `FRONTEND_URL`: your Netlify frontend URL (we'll get this after deploying frontend)
6. Click "Create Web Service" and wait for deployment to finish
7. Copy your backend URL (it will look like `https://dms-backend.onrender.com`)

---

## Step 2: Deploy Frontend on Netlify

### 2.1 Deploy to Netlify
1. Go to [https://app.netlify.com/](https://app.netlify.com/) and sign in
2. Click "Add new site" → "Import an existing project"
3. Connect to your GitHub/GitLab repository
4. Configure build settings:
   - **Base directory**: leave empty (or set to `frontend`)
   - **Build command**: `cd frontend && npm run build`
   - **Publish directory**: `frontend/dist`
5. Add Environment Variable in Netlify dashboard:
   - Go to Site settings → Environment variables
   - Add `VITE_API_URL` with your Render backend URL (e.g., `https://dms-backend.onrender.com`)
6. Click "Deploy site"
7. After deployment, copy your Netlify site URL

---

## Step 3: Update Environment Variables

### 3.1 Update Render Backend
1. Go back to your Render backend service dashboard
2. Add or update the `FRONTEND_URL` environment variable with your Netlify frontend URL
3. Redeploy the backend (Render will automatically redeploy when you change env vars)

---

## Important Notes
1. **CORS**: The backend is configured to allow requests only from your specified `FRONTEND_URL` and localhost for development
2. **MongoDB Atlas**: Ensure your Atlas cluster allows connections from Render's IP addresses (you can allow all IPs temporarily with 0.0.0.0/0, but restrict it later for security)
3. **Environment Variables**: Never commit sensitive information (like `MONGO_URI` and `JWT_SECRET`) to version control

---

## Local Development
For local development:
1. Create a `.env` file in `frontend/` directory (use `.env.example` as template):
   ```
   VITE_API_URL=http://localhost:5000
   ```
2. Make sure `backend/.env` has your local MongoDB or Atlas connection string
