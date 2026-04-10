# 🔒 Sub-Topics with Lock/Unlock Feature - Complete Guide

## ✅ What's Been Added

Your LMS now has **full sub-topic support with independent lock/unlock control**!

### Hierarchy:
```
Course → Module → Sub-Topic → Content
         🔒       🔒           (videos, PDFs, PPTs)
```

### Access Control:
- **Modules** can be locked/unlocked
- **Sub-topics** can ALSO be locked/unlocked independently
- **Students can only access content when BOTH the module AND sub-topic are unlocked**

---

## 🚀 Step 1: Run the Updated SQL

Copy and run the **entire** [supabase-subtopics-update.sql](supabase-subtopics-update.sql) file in your Supabase SQL Editor.

This SQL now includes:
- ✅ `is_locked` column for sub-topics (defaults to `true` - locked)
- ✅ Updated RLS policies to check both module and sub-topic locks
- ✅ Proper security for student access

---

## 📖 Step 2: How to Use

### Admin Workflow:

1. **Go to a course** (e.g., Fellowship in Emergency Medicine)
2. **Click "Sub-topics"** button on any module
3. **Add sub-topics** (e.g., "Organisation of Emergency Medical Services")
4. Each sub-topic will be **locked by default** 🔒
5. **Click "Unlock"** button to make it accessible to students
6. **Click "Upload Content"** to add videos/PDFs/PPTs to that sub-topic

### Lock Control:

**Module Level:**
- Lock = Students can't see the module at all
- Unlock = Students can see the module

**Sub-Topic Level** (NEW!):
- Lock 🔒 = Students can see it exists but can't access content
- Unlock 🔓 = Students can access all content in this sub-topic

**Content Access:**
Students can ONLY access content when:
- ✅ Module is unlocked AND
- ✅ Sub-topic is unlocked (if content is in a sub-topic)

---

## 🎯 Example: Emergency Medicine Course

### Module: Introduction and Overview (Unlocked)
- ✅ **Sub-topic: Organisation of Emergency Medicine Dept** (Unlocked)
  - 🎥 Lecture Video 1.1
  - 📊 Slides 1.1  
  - 📑 Notes 1.1
  - **→ Students CAN access these**

- 🔒 **Sub-topic: Disaster Management** (Locked)
  - 🎥 Lecture Video 1.2
  - **→ Students CANNOT access (sub-topic locked)**

### Module: Airway Management (Locked)
- **→ Students cannot see this module at all**

---

## 🎨 UI Features

### Admin View:
- **Sub-topics page:**
  - Green border = Unlocked 🔓
  - Gray border = Locked 🔒
  - Each has **Lock/Unlock button**
  - Shows number in circle (1, 2, 3...)

### Student View:
- **Module sidebar:**
  - Modules shown at top level
  - Sub-topics shown indented with bullet points
  - Locked sub-topics show 🔒 icon
  - Unlocked sub-topics show bullet •
  - Can click to navigate between sub-topics
  - Current sub-topic highlighted in teal

---

## 📋 Files Updated

### Database:
1. **supabase-subtopics-update.sql** - Added `is_locked` column and updated policies

### Backend:
2. **app/api/sub-topics/route.ts** - API for managing sub-topics

### Admin UI:
3. **app/admin/courses/[id]/modules/[moduleId]/subtopics/page.tsx** - Lock/unlock buttons added
4. **app/admin/courses/[id]/page.tsx** - Sub-topics button added
5. **app/admin/courses/[id]/upload/page.tsx** - Sub-topic selector added

### Student UI:
6. **app/student/courses/[id]/page.tsx** - Loads sub-topics and filters by lock status
7. **app/student/courses/[id]/StudentCourseClient.tsx** - Displays sub-topics with proper navigation

---

## 🔍 Testing Checklist

### As Admin:
- [ ] Go to a course
- [ ] Click "Sub-topics" on a module
- [ ] Add a sub-topic (appears locked by default)
- [ ] Click "Unlock" button
- [ ] Verify it shows 🔓 Unlocked
- [ ] Upload content to the sub-topic
- [ ] Lock it again (click "Lock" button)

### As Student:
- [ ] Enroll in the course
- [ ] See unlocked modules in sidebar
- [ ] See unlocked sub-topics as bullets
- [ ] Locked sub-topics show 🔒
- [ ] Can click unlocked sub-topics to view content
- [ ] Cannot access locked sub-topic content

---

## 💡 Best Practices

### Progressive Release:
1. Create all sub-topics (they're locked by default)
2. Upload all content
3. Unlock modules one at a time
4. Unlock sub-topics within modules as students progress

### Example Schedule:
**Week 1:**
- Unlock Module: Introduction
  - Unlock Sub-topic: Organisation of ED
  - Keep other sub-topics locked

**Week 2:**
- Unlock Sub-topic: Disaster Management
- Keep Week 3 content locked

---

## 🎓 Your Curriculum Mapping

```
Fellowship in Emergency Medicine (Course)
├── Introduction and Overview (Module) 🔓
│   ├── Organisation of ED (Sub-topic) 🔓 ← Students can access
│   ├── Organisation of EMS (Sub-topic) 🔒 ← Students can't access
│   ├── Disaster Management (Sub-topic) 🔒
│   └── Legal Aspects (Sub-topic) 🔒
│
├── Airway Management (Module) 🔒 ← Hidden from students
│   ├── Introduction (Sub-topic)
│   ├── Airway Management (Sub-topic)
│   └── ... more sub-topics
│
└── ... more modules
```

---

## 🚨 Important Notes

1. **Default Behavior:** New sub-topics are **locked by default** for safety
2. **Double Lock:** Content requires BOTH module AND sub-topic to be unlocked
3. **Backward Compatible:** Old content without sub-topics still works fine
4. **Admin Access:** Admins can always see everything regardless of locks
5. **Database Required:** Must run the SQL update before using this feature

---

## ✅ You're Ready!

1. ✅ Run [supabase-subtopics-update.sql](supabase-subtopics-update.sql) in Supabase
2. ✅ Refresh your browser
3. ✅ Go to a course and click "Sub-topics"
4. ✅ Add your curriculum structure
5. ✅ Lock/unlock as needed!

---

**Perfect for gradual content release! 🎉**
