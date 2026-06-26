# 🚀 Production Deployment Checklist

Use this checklist before deploying MedFellow LMS to production.

## Pre-Deployment (Local)

### Environment & Configuration
- [ ] All environment variables are set in `.env.local`
- [ ] Changed default admin password to a strong, unique password
- [ ] Removed any hardcoded credentials from code
- [ ] Verified `NODE_ENV=production` for production builds
- [ ] Removed any console.log statements (optional)
- [ ] Updated next.config.ts (no hardcoded paths)

### Database
- [ ] Supabase schema deployed (ran `supabase-schema.sql`)
- [ ] All RLS policies are active and tested
- [ ] Storage bucket `medfellow-content` exists
- [ ] Storage policies allow admin uploads
- [ ] Verified authenticated users can read storage
- [ ] Created initial admin account via setup endpoint

### Code Quality
- [ ] No TypeScript errors (`npm run build`)
- [ ] All files compile successfully
- [ ] Tested admin portal functionality
- [ ] Tested student portal functionality
- [ ] Tested file upload/download
- [ ] Tested authentication flow
- [ ] Tested role-based access control

## Deployment Platform Setup

### Vercel (Recommended)
- [ ] Connected GitHub repository to Vercel
- [ ] Set all environment variables in Vercel dashboard:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
  - `ADMIN_NAME`
  - `NODE_ENV=production`
- [ ] Configured custom domain (if applicable)
- [ ] SSL certificate is active

### Other Platforms (Netlify, Railway, etc.)
- [ ] Build command: `npm run build`
- [ ] Start command: `npm run start`
- [ ] Node version: 20+
- [ ] All environment variables configured

## Post-Deployment Verification

### Functionality Tests
- [ ] Site loads without errors
- [ ] Login page is accessible
- [ ] Setup endpoint returns 403 (disabled in production) ✅
- [ ] Can login with admin credentials
- [ ] Admin can create courses
- [ ] Admin can create modules
- [ ] Admin can upload files (test video, PPT, PDF)
- [ ] Admin can create student accounts
- [ ] Admin can enroll students
- [ ] Student can login
- [ ] Student can view enrolled courses
- [ ] Student can access unlocked modules
- [ ] Student can watch videos
- [ ] Student can download PDFs/PPTs
- [ ] Locked content is properly restricted
- [ ] Logout works correctly

### Security Checks
- [ ] Setup endpoint is disabled (`/api/setup` returns 403)
- [ ] Middleware protects authenticated routes
- [ ] Unauthenticated users redirect to login
- [ ] Students cannot access admin routes
- [ ] Admins can access all routes
- [ ] Video downloads are blocked
- [ ] Signed URLs expire after 60 seconds
- [ ] File uploads validate size and type
- [ ] Security headers are present (check browser DevTools)

### Performance
- [ ] Page load times are acceptable (<3s)
- [ ] Images are optimized (if any)
- [ ] Bundle size is reasonable
- [ ] Videos stream properly (don't require full download)
- [ ] No console errors in production

## Security Best Practices

### Immediate Actions
- [ ] Change all default passwords
- [ ] Rotate admin credentials from setup
- [ ] Create unique passwords for all users
- [ ] Enable Supabase email confirmation (if needed)
- [ ] Review Supabase Auth settings

### Ongoing Security
- [ ] Set up monitoring/logging (Sentry, LogRocket)
- [ ] Enable Supabase database backups
- [ ] Document backup/recovery procedures
- [ ] Set up alerts for failed logins
- [ ] Plan regular security audits
- [ ] Keep dependencies updated

## DNS & Domain (If Applicable)

- [ ] Custom domain configured
- [ ] DNS records pointing to deployment
- [ ] SSL/TLS certificate active
- [ ] HTTPS redirect enabled
- [ ] WWW redirect configured (if needed)

## Documentation

- [ ] README.md is up to date
- [ ] Deployment procedures documented
- [ ] Admin user guide created (optional)
- [ ] Student user guide created (optional)
- [ ] Contact information for support

## Monitoring & Analytics

- [ ] Error tracking setup (Sentry, etc.)
- [ ] Analytics configured (optional)
- [ ] Uptime monitoring enabled (optional)
- [ ] Log aggregation setup (optional)

## Final Checks

- [ ] Informed stakeholders of go-live
- [ ] Support channels ready
- [ ] Backup admin contacts available
- [ ] Emergency rollback plan ready
- [ ] Database backup confirmed

## Post-Launch (First 24 Hours)

- [ ] Monitor error logs
- [ ] Check user feedback
- [ ] Verify all functionality
- [ ] Monitor server performance
- [ ] Check storage usage
- [ ] Review Supabase metrics

## Nice to Have (Future Enhancements)

- [ ] Add rate limiting to sensitive endpoints
- [ ] Implement email notifications
- [ ] Add user activity logging
- [ ] Create admin dashboard with analytics
- [ ] Add course completion tracking
- [ ] Implement quiz/assessment features
- [ ] Add bulk user import
- [ ] Create mobile-responsive improvements
- [ ] Add dark mode support
- [ ] Implement search functionality

---

## Emergency Contacts

**Platform Issues:**
- Vercel Status: https://vercel-status.com
- Supabase Status: https://status.supabase.com

**Support:**
- Development Team: [Add contact info]
- System Administrator: [Add contact info]

---

**Last Updated:** April 10, 2026
**Version:** 1.0.0
