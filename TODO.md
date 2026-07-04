# DMS CORS/Deploy Debug Checklist

- [x] Inspect frontend AuthContext axios baseURL + request paths
- [x] Fix frontend to use a dedicated axios instance with explicit Render backend baseURL
- [x] Patch backend CORS to handle OPTIONS preflight + allow correct frontend origin(s)
- [ ] Re-deploy backend + frontend (or let CI pick up changes)
- [ ] Verify /api/auth/login works from Netlify production

