# MedFellow Academy LMS

A modern Learning Management System built specifically for medical fellowship programs. Built with Next.js 16, React 19, and Supabase.

## Features

- 🎓 **Role-Based Access Control** - Separate admin and student portals
- 📚 **Course Management** - Create and organize courses with modules
- 🎥 **Multi-Format Content** - Support for videos, presentations (PPT), and PDFs
- 🔒 **Secure Content Delivery** - Protected file storage with signed URLs
- 👥 **User Management** - Admin can create and manage student accounts
- 🎨 **Modern UI** - Clean, responsive design with medical aesthetics
- 🔐 **Authentication** - Secure authentication with Supabase Auth

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Storage + Auth)
- **Language:** TypeScript
- **Styling:** CSS-in-JS with Tailwind

## Prerequisites

- Node.js 20+ and npm/yarn/pnpm
- A Supabase account (free tier is fine)
- Git

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd medfellow-lms
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings** → **API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep this secure!)

### 4. Configure Environment Variables

The `.env.local` file is already set up with your Supabase credentials. Update the admin credentials:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Change these before deploying!
ADMIN_EMAIL=admin@medfellow.com
ADMIN_PASSWORD=YourSecurePassword123!
ADMIN_NAME=Admin User

NODE_ENV=development
```

### 5. Set Up Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase-schema.sql`
4. Paste and run it in the SQL Editor

This will create:
- Database tables (profiles, courses, modules, module_content, enrollments)
- Row Level Security (RLS) policies
- Storage bucket for content
- Auto-profile creation trigger

### 6. Create Admin Account

Run the development server:

```bash
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000)

Click "Setup Admin Account" and follow the prompts. This will:
- Create an admin user with the credentials from `.env.local`
- Display the credentials on screen
- Pre-fill the login form

**Important:** The setup endpoint is automatically disabled in production for security.

### 7. Start Using the Platform

**Admin Portal:**
- Create courses and modules
- Upload content (videos, PPTs, PDFs)
- Create student accounts
- Manage enrollments

**Student Portal:**
- View enrolled courses
- Access unlocked modules
- Watch videos and download materials

## Project Structure

```
medfellow-lms/
├── app/
│   ├── (auth)/login/          # Authentication
│   ├── admin/                 # Admin portal
│   │   ├── courses/          # Course management
│   │   └── users/            # User management
│   ├── student/              # Student portal
│   │   └── courses/          # Course viewing
│   ├── api/                  # API routes
│   │   ├── create-user/      # User creation
│   │   ├── download/         # File downloads
│   │   └── setup/            # Initial setup
│   ├── error.tsx             # Error boundary
│   ├── not-found.tsx         # 404 page
│   └── loading.tsx           # Loading state
├── components/
│   └── Sidebar.tsx           # Navigation sidebar
├── lib/
│   ├── supabase.ts           # Client-side Supabase
│   └── supabase-server.ts    # Server-side Supabase
├── middleware.ts             # Route protection
├── next.config.ts            # Next.js config
└── tsconfig.json             # TypeScript config
```

## User Roles

### Admin
- Create and manage courses
- Create modules within courses
- Upload content (videos, PPTs, PDFs)
- Create student accounts
- Enroll students in courses
- Lock/unlock modules

### Student
- View enrolled courses
- Access unlocked modules
- Watch videos (streaming)
- Download PDFs and PPTs
- Cannot access locked content

## Security Features

- ✅ Row Level Security (RLS) on all tables
- ✅ Signed URLs for file downloads (60s expiry)
- ✅ Video streaming (no direct downloads)
- ✅ Middleware-based route protection
- ✅ Role-based access control
- ✅ Setup endpoint disabled in production
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ File upload validation (size & type)

## File Upload Limits

- **Videos:** 500MB max
- **Presentations:** 100MB max
- **PDFs:** 50MB max

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ADMIN_EMAIL
   ADMIN_PASSWORD
   ADMIN_NAME
   NODE_ENV=production
   ```
5. Deploy!

### Post-Deployment

1. Visit your deployed URL
2. Navigate to `/login`
3. Create users through the admin panel (setup endpoint is disabled)
4. **Important:** Change all default passwords immediately

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (keep secret!) |
| `ADMIN_EMAIL` | Yes | Default admin email |
| `ADMIN_PASSWORD` | Yes | Default admin password |
| `ADMIN_NAME` | No | Default admin name (optional) |
| `NODE_ENV` | No | `development` or `production` |

## Common Issues

### "Admin already exists" error
The setup endpoint can only be used once. Use the admin credentials from your initial setup.

### File upload fails
- Check file size limits
- Verify storage bucket exists in Supabase
- Check RLS policies on `storage.objects`

### Video won't play
- Ensure browser supports the video format
- Check signed URL expiration
- Verify student is enrolled in the course

### Can't access admin panel
- Ensure user role is set to 'admin' in profiles table
- Check middleware isn't blocking the route
- Clear browser cache and cookies

## License

Private - All Rights Reserved

## Support

For issues and questions, please contact the development team.

---

Built with ❤️ for Medical Education
