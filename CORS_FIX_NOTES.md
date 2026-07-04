# CORS Fix Notes (Netlify -> Render)

## What was happening
Netlify frontend at:
- https://dmsproject-rishab.netlify.app

was blocked on login/register with:
- CORS preflight failed: missing `Access-Control-Allow-Origin`

## Frontend fix
`frontend/src/context/AuthContext.jsx`
- Added dedicated axios instance with explicit Render backend baseURL.
- Ensures requests are sent to `https://dms-project-tzvd.onrender.com` instead of accidentally going to Netlify as relative `/api/...`.

## Backend fix
`backend/src/server.js`
- Updated CORS allowed origins to include the Netlify origin from your logs.
- Added explicit `app.options('*', ...)` preflight handler.
- Allowed headers include `Authorization`.

## Deployment
After pushing these changes:
- redeploy backend on Render
- redeploy frontend on Netlify

Then verify:
- POST `/api/auth/login`
- POST `/api/auth/register`
via browser Network tab (preflight OPTIONS should succeed).

