# Student Portal Features Guide

## ✨ Overview

The student portal has been completely redesigned with advanced features for tracking learning progress, viewing statistics, and managing course activities.

---

## 🎯 Key Features

### 1. **Dashboard** (`/student`)
The central hub for students showing:

- **Quick Stats Cards**
  - Total Enrolled Courses
  - Modules Completed
  - Videos Watched
  - Courses In Progress

- **Course Progress View**
  - Visual progress bars for each course
  - Completion percentage
  - Module and video statistics
  - "Continue Learning" badges for in-progress courses
  - "Completed" badges for finished courses

- **Recent Activity Feed**
  - Last 10 activities tracked
  - Video views, resource downloads, module starts/completions
  - Timestamps (e.g., "2h ago", "Just now")
  - Activity icons for quick visual identification

### 2. **Automatic Progress Tracking**
- **Video Progress**
  - Tracks watch time every 10 seconds
  - Auto-marks as complete at 90% watched
  - Persists across sessions
  - Shows completion status

- **Module Completion**
  - API endpoint for marking modules complete
  - Tracks completion timestamp
  - Updates dashboard statistics

- **Activity Logging**
  - Logs every video view
  - Tracks resource downloads
  - Records module starts
  - Captures completion events

### 3. **Enhanced Course Viewer**
- **All Modules Visible**
  - Students now see ALL modules (locked and unlocked)
  - Locked modules displayed in gray
  - Clear visual indicators (🔒 for locked, ▼ for expandable)

- **Dropdown Sub-Topics**
  - Click module to expand/collapse sub-topics
  - Smooth animation for dropdown
  - Nested indentation for hierarchy
  - Lock status for each sub-topic

- **Improved Navigation**
  - Dashboard link in sidebar
  - "My Courses" for course list
  - Breadcrumb navigation in course viewer

---

## 📊 Database Schema

### New Tables Created

#### `video_progress`
```sql
- user_id (uuid)
- content_id (uuid)
- watch_time_seconds (int)
- total_duration_seconds (int)
- completed (boolean)
- last_watched_at (timestamptz)
```

#### `module_completion`
```sql
- user_id (uuid)
- module_id (uuid)
- completed (boolean)
- completed_at (timestamptz)
```

#### `subtopic_completion`
```sql
- user_id (uuid)
- sub_topic_id (uuid)
- completed (boolean)
- completed_at (timestamptz)
```

#### `activity_log`
```sql
- user_id (uuid)
- course_id (uuid, nullable)
- module_id (uuid, nullable)
- sub_topic_id (uuid, nullable)
- content_id (uuid, nullable)
- activity_type (text)
- created_at (timestamptz)
```

#### `course_progress` (view)
Calculated view showing aggregated course progress:
- Total modules vs completed
- Total videos vs watched
- Total sub-topics vs completed

---

## 🔌 API Endpoints

### `/api/video-progress`
**POST** - Update video watch progress
```json
{
  "content_id": "uuid",
  "watch_time_seconds": 120,
  "total_duration_seconds": 300,
  "completed": false
}
```

**GET** - Retrieve video progress
- Query param: `content_id` (optional)
- Returns: Progress data for user

### `/api/completion`
**POST** - Mark module/subtopic as complete
```json
{
  "module_id": "uuid",  // OR sub_topic_id
  "completed": true
}
```

**GET** - Check completion status
- Query params: `module_id` or `sub_topic_id`

### `/api/activity`
**POST** - Log student activity
```json
{
  "activity_type": "viewed_video",
  "content_id": "uuid",
  "module_id": "uuid",
  "sub_topic_id": "uuid"
}
```

**GET** - Retrieve recent activity
- Query param: `limit` (default: 20)

---

## 🚀 Setup Instructions

### 1. Run Database Migration
```bash
# In Supabase SQL Editor, run:
supabase-student-portal.sql
```

This creates all necessary tables, views, RLS policies, and indexes.

### 2. Dashboard is Default Landing Page
When students login, they now land on `/student` (Dashboard) instead of directly on courses.

### 3. Navigation Updated
Sidebar now shows:
- **Dashboard** - Statistics and overview
- **My Courses** - Course list

---

## 📈 How It Works

### Video Tracking Flow
1. Student clicks module with video
2. Video player loads with event listeners
3. Every 10 seconds → `onTimeUpdate` → Save progress
4. At 90% watched → Auto-mark complete
5. On video end → Confirm completion
6. Dashboard updates with new stats

### Activity Flow
1. Student performs action (watch video, download PDF)
2. Event handler calls `/api/activity`
3. Activity logged in database
4. Recent activity feed updates
5. Dashboard shows latest 10 activities

### Progress Calculation
- **Course Progress** = (Completed Videos / Total Videos) × 100
- **Module Completion** = All videos in module watched
- **Dashboard Stats** = Real-time aggregation from database

---

## 🎨 UI Features

### Dashboard Stats Cards
```
┌──────────────────────┐
│   4    │  12   │  28  │
│Courses │Modules│Videos│
└──────────────────────┘
```
- Gradient backgrounds (teal, purple, pink, orange)
- Large numbers with labels
- Responsive grid layout

### Course Cards
```
┌────────────────────────┐
│ Emergency Medicine     │
│ Fellowship program...  │
│                        │
│ Progress: 45%          │
│ ████████░░░░░░░░       │
│ 5/12 modules • 8/20 vids│
│ [▶ Continue Learning]  │
└────────────────────────┘
```
- Hover effects (border color change)
- Progress bars with percentage
- Status badges
- Click to navigate to course

### Activity Feed
```
┌────────────────────────┐
│ ▶️ Watched "Intro..."  │
│    2h ago              │
├────────────────────────┤
│ 📥 Downloaded "PPT..." │
│    5h ago              │
└────────────────────────┘
```
- Icons for activity types
- Relative timestamps
- Scrollable list

---

## 🔐 Security (RLS Policies)

All new tables have Row Level Security enabled:

1. **Students** can only:
   - View their own progress
   - Update their own progress
   - Log their own activities

2. **Admins** can:
   - View all student progress (read-only)
   - See all activity logs
   - Monitor completion rates

---

## 📱 Responsive Design

All features are mobile-friendly:
- Grid layouts adapt to screen size
- Stats cards stack on mobile
- Sidebar collapses (future enhancement)
- Course cards resize fluidly

---

## 🧪 Testing Checklist

- [ ] Login as student → lands on dashboard
- [ ] Dashboard shows correct stats (0 if no courses)
- [ ] Click "My Courses" → see course list
- [ ] Open course → all modules visible
- [ ] Locked modules grayed out with 🔒
- [ ] Click module with sub-topics → dropdown opens
- [ ] Click sub-topic → content loads
- [ ] Play video → progress tracked
- [ ] Watch 90% of video → marked complete
- [ ] Download resource → activity logged
- [ ] Return to dashboard → stats updated
- [ ] Recent activity shows video view
- [ ] Progress bar reflects completion

---

## 📝 Activity Types

| Type | Description | Icon |
|------|-------------|------|
| `viewed_video` | Student watched a video | ▶️ |
| `downloaded_resource` | Downloaded PPT/PDF | 📥 |
| `started_module` | Opened a module | 📚 |
| `completed_module` | Finished all module content | ✅ |

---

## 🔮 Future Enhancements

Potential additions:
- **Certificates** - Generate on course completion
- **Leaderboard** - Compare progress with peers
- **Study Streak** - Track consecutive days of learning
- **Bookmarks** - Save favorite modules
- **Notes** - Take notes on videos
- **Discussion** - Q&A forum per module
- **Calendar** - Scheduled module unlocks
- **Email Notifications** - New content alerts

---

## 🐛 Troubleshooting

### Dashboard shows 0 for all stats
→ Ensure `supabase-student-portal.sql` was run in Supabase

### Video progress not saving
→ Check browser console for API errors
→ Verify `/api/video-progress` endpoint is accessible

### Activity feed empty
→ Perform some actions (watch video, download file)
→ Check `activity_log` table has rows

### Module dropdown not working
→ Ensure module has sub-topics
→ Check console for JavaScript errors

---

## 📚 File Structure

```
app/
├── student/
│   ├── page.tsx               # Dashboard server component
│   ├── DashboardClient.tsx    # Dashboard UI (client)
│   ├── layout.tsx             # Student layout with sidebar
│   └── courses/
│       ├── page.tsx           # Course list
│       ├── CourseCard.tsx     # Course card component
│       └── [id]/
│           ├── page.tsx       # Course viewer server
│           └── StudentCourseClient.tsx  # Course UI + tracking
├── api/
│   ├── video-progress/
│   │   └── route.ts           # Video progress API
│   ├── completion/
│   │   └── route.ts           # Module completion API
│   └── activity/
│       └── route.ts           # Activity logging API
components/
└── Sidebar.tsx                # Updated with Dashboard link
```

---

## ✅ Summary

The student portal now provides:
- **Rich Dashboard** with statistics and progress
- **Automatic Tracking** of all learning activities
- **Progress Persistence** across sessions
- **Activity History** for recent actions
- **Enhanced UX** with dropdown sub-topics and all modules visible

All features are production-ready and fully integrated with the existing LMS! 🎉
