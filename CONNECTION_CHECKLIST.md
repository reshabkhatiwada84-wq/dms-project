# Connection Checklist: Backend ↔ Frontend

## 1. Backend (Render) Setup Checklist
- [ ] Backend is deployed and running on Render
- [ ] Backend URL is accessible (visiting it shows "DMS API is running...")
- [ ] Environment Variables in Render dashboard:
  - [ ] `NODE_ENV`: `production`
  - [ ] `MONGO_URI`: MongoDB Atlas connection string
  - [ ] `JWT_SECRET`: secure random string
  - [ ] `FRONTEND_URL`: Your full Netlify frontend URL (e.g., `https://your-site-name.netlify.app`)
- [ ] Backend is listening on `0.0.0.0` (not `127.0.0.1`)

## 2. Frontend (Netlify) Setup Checklist
- [ ] Frontend is deployed and running on Netlify
- [ ] Environment Variable in Netlify dashboard:
  - [ ] `VITE_API_URL`: Your full Render backend URL (e.g., `https://your-backend-name.onrender.com`)
- [ ] Frontend redeployed after setting environment variable

## 3. Test the Connection
- [ ] Open your Netlify frontend
- [ ] Open browser's DevTools (F12) → Network tab
- [ ] Try to register or login
- [ ] Verify that requests are being sent to your Render backend URL (not localhost)
- [ ] Check for CORS errors in the Console tab

## Troubleshooting Tips
### If you see CORS errors:
1. Double-check that `FRONTEND_URL` in Render exactly matches your Netlify URL (including https:// and no trailing slash)
2. Make sure you've redeployed the backend after changing the environment variable

### If requests are going to localhost instead of Render:
1. Verify `VITE_API_URL` in Netlify is set correctly
2. Make sure you've redeployed the frontend after setting the variable
