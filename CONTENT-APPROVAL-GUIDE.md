# 🔐 Content Approval System - Complete Guide

## Overview

You now have a complete **Content Approval System** that ensures only reviewed and approved content is visible to students. All uploaded content goes through a review process before becoming available in courses.

---

## ✨ Features Implemented

### 1. **Approval Workflow**
   - ✅ All uploaded content starts with status: `pending`
   - ✅ Admins review content in Content Review page
   - ✅ Admins can approve, reject, or delete content
   - ✅ Only approved content is visible to students
   - ✅ Rejected content includes reason for rejection

### 2. **Enhanced Upload System**
   - ✅ Support for **5 content types**: Video, Audio, PPT, PDF, Document
   - ✅ Audio files support (MP3, WAV, M4A, etc.)
   - ✅ Document files support (Word, TXT)
   - ✅ Tracks uploader, file size, and MIME type
   - ✅ Automatic metadata capture

### 3. **Content Review Interface**
   - ✅ View pending, approved, and rejected content
   - ✅ Bulk approve/reject/delete operations
   - ✅ Preview and download content before approval
   - ✅ Add rejection reasons
   - ✅ Track who uploaded and who approved

### 4. **Preview & Download**
   - ✅ Preview videos, PDFs, PPTs, audio files
   - ✅ Download any content type
   - ✅ Secure signed URLs with expiration

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

1. **Open Supabase SQL Editor**
2. **Copy and paste** the content from `supabase-content-approval.sql`
3. **Click "Run"**

This will:
- Add approval columns to `module_content` and `course_ebooks` tables
- Support audio and document file types
- Create indexes for efficient querying
- Update RLS policies to filter by approval status
- Create helper functions for statistics

### Step 2: Approve Existing Content (Optional)

If you have existing content that should be automatically approved, uncomment and run these lines in the SQL:

```sql
update public.module_content 
set approval_status = 'approved', 
    approved_at = now() 
where approval_status = 'pending';

update public.course_ebooks 
set approval_status = 'approved', 
    approved_at = now() 
where approval_status = 'pending';
```

### Step 3: Restart Development Server

The dev server is already running, just refresh your browser to see the changes.

---

## 📱 How to Use

### For Admins - Uploading Content

1. **Go to Content Manager** or a specific course
2. **Click "Upload"** button
3. **Choose content type**:
   - 🎬 **Video** - MP4, MOV, AVI (max 1GB)
   - 🎵 **Audio** - MP3, WAV, M4A (max 100MB)
   - 📊 **PPT** - PowerPoint presentations (max 100MB)
   - 📄 **PDF** - PDF documents (max 50MB)
   - 📝 **Document** - Word docs, TXT files (max 50MB)
4. **Select module** and optional sub-topic
5. **Upload file** - Status will be `pending`
6. **Go to Content Review** to approve it

### For Admins - Reviewing Content

1. **Click "Content Review"** in the sidebar
2. **View pending content** (default tab)
3. **Preview** content by clicking the 👁️ icon
4. **Download** content by clicking the ⬇️ icon
5. **Select content** using checkboxes
6. **Choose action**:
   - ✅ **Approve** - Makes content visible to students
   - ✗ **Reject** - Marks content as rejected (provide reason)
   - 🗑️ **Delete** - Permanently removes content

### For Admins - Managing Approved/Rejected Content

1. **Click "Approved" tab** - View all approved content
2. **Click "Rejected" tab** - View rejected content with reasons
3. **Can delete** content from any tab
4. **Cannot un-approve** - delete and re-upload if needed

### For Students - Viewing Content

Students will **ONLY** see:
- ✅ Content with status = `approved`
- ✅ Content in unlocked modules
- ✅ Content in courses they're enrolled in

**Pending or rejected content is completely hidden from students.**

---

## 🎯 Content Type Support

### Video Files
- **Extensions**: .mp4, .mov, .avi, .webm
- **Max Size**: 1GB
- **Preview**: ✅ Yes (in-browser player)
- **Download**: ✅ Yes

### Audio Files (NEW)
- **Extensions**: .mp3, .wav, .m4a, .ogg
- **Max Size**: 100MB
- **Preview**: ✅ Yes (audio player)
- **Download**: ✅ Yes
- **Use Cases**: Lectures, podcasts, audio notes

### PowerPoint Presentations
- **Extensions**: .ppt, .pptx
- **Max Size**: 100MB
- **Preview**: ✅ Yes (using Google Docs viewer)
- **Download**: ✅ Yes

### PDF Documents
- **Extensions**: .pdf
- **Max Size**: 50MB
- **Preview**: ✅ Yes (PDF viewer)
- **Download**: ✅ Yes

### Document Files (NEW)
- **Extensions**: .doc, .docx, .txt
- **Max Size**: 50MB
- **Preview**: ✅ Yes (using Google Docs viewer)
- **Download**: ✅ Yes
- **Use Cases**: Study notes, handouts, text materials

---

## 🔒 Security & Permissions

### Database Policies (RLS)

**Students:**
- Can only SELECT content where `approval_status = 'approved'`
- Must be enrolled in the course
- Module must be unlocked
- Cannot see pending or rejected content

**Admins:**
- Full access to all content regardless of status
- Can INSERT, UPDATE, DELETE all content
- Can change approval status

### File Storage

- All files stored in Supabase Storage bucket: `medfellow-content`
- Folders organized by type: `videos/`, `audios/`, `ppts/`, `pdfs/`, `documents/`
- Signed URLs with 1-hour expiration for security
- Downloads use 1-minute expiration URLs

---

## 📊 Approval Status Flow

```
UPLOAD (Admin)
    ↓
[PENDING] ← Content waits here for review
    ↓
Admin Reviews in Content Review Page
    ↓
    ├─→ [APPROVED] → Visible to students ✅
    ├─→ [REJECTED] → Not visible (with reason) ✗
    └─→ [DELETED] → Permanently removed 🗑️
```

---

## 🎨 UI Features

### Content Review Page
- **Filter Tabs**: Pending, Approved, Rejected
- **Bulk Selection**: Select all or individual items
- **Bulk Actions**: Approve/Reject/Delete multiple items
- **Preview Modal**: View content before approving
- **Download**: Test download before approving
- **File Info**: Shows size, type, uploader, date
- **Rejection Reason Modal**: Provide detailed feedback

### Upload Page
- **5 Content Types**: Easy selection with icons
- **File Validation**: Automatic size and type checking
- **Progress Bar**: Real-time upload progress
- **Success Message**: Confirmation after upload
- **Pending Notice**: Informs that content needs approval

### Content Manager
- **Statistics Dashboard**: Total courses, modules, content
- **Category Filtering**: Filter by medical specialty
- **Search**: Find courses quickly
- **Quick Upload**: Direct link to upload page

---

## 📈 Statistics & Monitoring

### Track Content Status

Run in Supabase SQL Editor:

```sql
-- Count by status
SELECT approval_status, count(*) 
FROM public.module_content 
GROUP BY approval_status;

-- Pending content with details
SELECT 
  mc.title, 
  mc.type, 
  mc.created_at,
  c.title as course_title,
  m.title as module_title,
  p.full_name as uploaded_by
FROM public.module_content mc
JOIN public.modules m ON m.id = mc.module_id
JOIN public.courses c ON c.id = m.course_id
LEFT JOIN public.profiles p ON p.id = mc.uploaded_by
WHERE mc.approval_status = 'pending'
ORDER BY mc.created_at DESC;
```

---

## 🔧 Troubleshooting

### Issue: Content not showing after approval
**Solution:** Refresh the student's browser or check module is unlocked

### Issue: Upload fails with "File too large"
**Solution:** Check file size limits:
- Videos: 1GB max
- Audio/PPT: 100MB max
- PDF/Documents: 50MB max

### Issue: Can't preview audio files
**Solution:** Make sure browser supports audio playback (all modern browsers do)

### Issue: Preview shows "File not found"
**Solution:** File may have been deleted from storage. Check Supabase Storage bucket.

### Issue: Student sees pending content
**Solution:** This shouldn't happen - check RLS policies in Supabase

---

## 🎯 Best Practices

### Content Upload
1. **Name files clearly** - Use descriptive titles
2. **Organize by modules** - Use sub-topics for better structure
3. **Check file size** - Compress videos if needed
4. **Preview before uploading** - Ensure quality

### Content Review
1. **Review promptly** - Don't keep content pending long
2. **Preview everything** - Check quality and relevance
3. **Provide clear rejection reasons** - Help uploaders improve
4. **Bulk approve similar content** - Save time with bulk actions

### Content Organization
1. **Use sub-topics** - Organize content within modules
2. **Consistent naming** - Follow naming conventions
3. **File management** - Delete outdated content
4. **Regular audits** - Check approved content periodically

---

## 📁 Files Created/Modified

### New Files:
1. **`supabase-content-approval.sql`** - Database schema for approval system
2. **`app/api/content-approval/route.ts`** - API for approval operations
3. **`app/admin/content-review/page.tsx`** - Content review UI
4. **`CONTENT-APPROVAL-GUIDE.md`** - This guide (you're reading it!)

### Modified Files:
5. **`app/admin/courses/[id]/upload/page.tsx`** - Added audio/document support, approval metadata
6. **`components/Sidebar.tsx`** - Added "Content Review" link
7. **`components/PreviewModal.tsx`** - Already supports all content types

---

## ✅ Verification Checklist

After setup, verify:

- [ ] SQL migration ran successfully
- [ ] Can access `/admin/content-review` page
- [ ] "Content Review" link appears in admin sidebar
- [ ] Can upload audio files (.mp3, .wav, etc.)
- [ ] Can upload document files (.doc, .docx, .txt)
- [ ] Upload creates content with status `pending`
- [ ] Pending content appears in Content Review page
- [ ] Can preview content before approving
- [ ] Can approve content (changes status to `approved`)
- [ ] Can reject content with reason
- [ ] Approved content visible in courses
- [ ] Students cannot see pending/rejected content
- [ ] Can delete content from any status

---

## 🎉 Summary

You now have a professional content approval workflow:

1. **Upload** - Admins upload content (5 types supported)
2. **Review** - Content waits in pending status
3. **Approve/Reject** - Admins review and decide
4. **Publish** - Only approved content reaches students
5. **Preview & Download** - Test content before approval
6. **Track** - See who uploaded, when, and who approved

This ensures **quality control** and **professional content management** for your LMS! 🚀

---

**Questions?** Everything is self-explanatory and ready to use. Just run the SQL migration and start uploading! 📚
