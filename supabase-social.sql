-- ============================================================================
-- PHASE 3: COMMUNICATION & SOCIAL LEARNING - DATABASE SCHEMA
-- ============================================================================
-- Creates tables for discussion forums, Q&A, study groups, announcements,
-- notifications, and gamification features.
-- Run this after supabase-assessments.sql
-- ============================================================================

-- ============================================================================
-- 1. DISCUSSION FORUMS
-- ============================================================================

-- Discussion threads (topics)
CREATE TABLE IF NOT EXISTS discussion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  sub_topic_id UUID REFERENCES sub_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pinned BOOLEAN DEFAULT false,
  locked BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Discussion posts (replies)
CREATE TABLE IF NOT EXISTS discussion_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_post_id UUID REFERENCES discussion_posts(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Post likes tracking
CREATE TABLE IF NOT EXISTS discussion_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Indexes for forums
CREATE INDEX IF NOT EXISTS idx_discussion_threads_course ON discussion_threads(course_id);
CREATE INDEX IF NOT EXISTS idx_discussion_threads_module ON discussion_threads(module_id);
CREATE INDEX IF NOT EXISTS idx_discussion_threads_created ON discussion_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_thread ON discussion_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_parent ON discussion_posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_discussion_post_likes_post ON discussion_post_likes(post_id);

-- ============================================================================
-- 2. Q&A SYSTEM
-- ============================================================================

-- Questions
CREATE TABLE IF NOT EXISTS qa_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  sub_topic_id UUID REFERENCES sub_topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  views_count INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Answers to questions
CREATE TABLE IF NOT EXISTS qa_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_instructor_answer BOOLEAN DEFAULT false,
  accepted_answer BOOLEAN DEFAULT false,
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Q&A votes tracking
CREATE TABLE IF NOT EXISTS qa_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  votable_type TEXT NOT NULL CHECK (votable_type IN ('question', 'answer')),
  votable_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(votable_type, votable_id, user_id)
);

-- Indexes for Q&A
CREATE INDEX IF NOT EXISTS idx_qa_questions_course ON qa_questions(course_id);
CREATE INDEX IF NOT EXISTS idx_qa_questions_module ON qa_questions(module_id);
CREATE INDEX IF NOT EXISTS idx_qa_questions_status ON qa_questions(status);
CREATE INDEX IF NOT EXISTS idx_qa_answers_question ON qa_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_qa_votes_votable ON qa_votes(votable_type, votable_id);

-- ============================================================================
-- 3. STUDY GROUPS
-- ============================================================================

-- Study groups
CREATE TABLE IF NOT EXISTS study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  max_members INTEGER DEFAULT 10,
  private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Study group members
CREATE TABLE IF NOT EXISTS study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Study group messages (chat)
CREATE TABLE IF NOT EXISTS study_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  attachment_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for study groups
CREATE INDEX IF NOT EXISTS idx_study_groups_course ON study_groups(course_id);
CREATE INDEX IF NOT EXISTS idx_study_group_members_group ON study_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_study_group_members_user ON study_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_study_group_messages_group ON study_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_study_group_messages_created ON study_group_messages(created_at DESC);

-- ============================================================================
-- 4. ANNOUNCEMENTS & NOTIFICATIONS
-- ============================================================================

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for announcements & notifications
CREATE INDEX IF NOT EXISTS idx_announcements_course ON announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- 5. GAMIFICATION (XP & LEADERBOARDS)
-- ============================================================================

-- User XP tracking
CREATE TABLE IF NOT EXISTS user_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  xp_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- XP history/transactions
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  xp_earned INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Badges/achievements
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  xp_reward INTEGER DEFAULT 0,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User badges
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Indexes for gamification
CREATE INDEX IF NOT EXISTS idx_user_xp_user ON user_xp(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_total ON user_xp(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Discussion Threads: students see threads for enrolled courses, admins see all
ALTER TABLE discussion_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view threads in enrolled courses" ON discussion_threads
  FOR SELECT USING (
    get_my_role() = 'student' AND
    course_id IN (
      SELECT course_id FROM enrollments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all threads" ON discussion_threads
  FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "Students can create threads in enrolled courses" ON discussion_threads
  FOR INSERT WITH CHECK (
    get_my_role() = 'student' AND
    user_id = auth.uid() AND
    course_id IN (
      SELECT course_id FROM enrollments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own threads" ON discussion_threads
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can update all threads" ON discussion_threads
  FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "Admins can delete threads" ON discussion_threads
  FOR DELETE USING (get_my_role() = 'admin');

-- Discussion Posts: inherit thread permissions
ALTER TABLE discussion_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view posts in accessible threads" ON discussion_posts
  FOR SELECT USING (
    thread_id IN (SELECT id FROM discussion_threads)
  );

CREATE POLICY "Users can create posts in accessible threads" ON discussion_posts
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    thread_id IN (SELECT id FROM discussion_threads)
  );

CREATE POLICY "Users can update own posts" ON discussion_posts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own posts" ON discussion_posts
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can delete any post" ON discussion_posts
  FOR DELETE USING (get_my_role() = 'admin');

-- Discussion Post Likes
ALTER TABLE discussion_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view likes" ON discussion_post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like posts" ON discussion_post_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unlike posts" ON discussion_post_likes
  FOR DELETE USING (user_id = auth.uid());

-- Q&A Questions: same as threads
ALTER TABLE qa_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view questions in enrolled courses" ON qa_questions
  FOR SELECT USING (
    course_id IN (
      SELECT course_id FROM enrollments WHERE user_id = auth.uid()
    ) OR get_my_role() = 'admin'
  );

CREATE POLICY "Students can create questions" ON qa_questions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    course_id IN (
      SELECT course_id FROM enrollments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own questions" ON qa_questions
  FOR UPDATE USING (user_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "Admins can delete questions" ON qa_questions
  FOR DELETE USING (get_my_role() = 'admin');

-- Q&A Answers
ALTER TABLE qa_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view answers" ON qa_answers
  FOR SELECT USING (
    question_id IN (SELECT id FROM qa_questions)
  );

CREATE POLICY "Users can create answers" ON qa_answers
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    question_id IN (SELECT id FROM qa_questions)
  );

CREATE POLICY "Users can update own answers" ON qa_answers
  FOR UPDATE USING (user_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "Users can delete own answers" ON qa_answers
  FOR DELETE USING (user_id = auth.uid() OR get_my_role() = 'admin');

-- Q&A Votes
ALTER TABLE qa_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view votes" ON qa_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can vote" ON qa_votes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can change their votes" ON qa_votes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can remove their votes" ON qa_votes
  FOR DELETE USING (user_id = auth.uid());

-- Study Groups
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public groups and groups they're in" ON study_groups
  FOR SELECT USING (
    private = false OR
    id IN (SELECT group_id FROM study_group_members WHERE user_id = auth.uid()) OR
    get_my_role() = 'admin'
  );

CREATE POLICY "Students can create groups" ON study_groups
  FOR INSERT WITH CHECK (
    owner_id = auth.uid() AND
    get_my_role() = 'student'
  );

CREATE POLICY "Group owners can update their groups" ON study_groups
  FOR UPDATE USING (owner_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "Group owners can delete their groups" ON study_groups
  FOR DELETE USING (owner_id = auth.uid() OR get_my_role() = 'admin');

-- Study Group Members
ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of accessible groups" ON study_group_members
  FOR SELECT USING (
    group_id IN (SELECT id FROM study_groups)
  );

CREATE POLICY "Users can join groups" ON study_group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups" ON study_group_members
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Group owners can manage members" ON study_group_members
  FOR DELETE USING (
    group_id IN (SELECT id FROM study_groups WHERE owner_id = auth.uid())
  );

-- Study Group Messages
ALTER TABLE study_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view messages" ON study_group_messages
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM study_group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Group members can send messages" ON study_group_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    group_id IN (SELECT group_id FROM study_group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own messages" ON study_group_messages
  FOR DELETE USING (user_id = auth.uid());

-- Announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view announcements for enrolled courses" ON announcements
  FOR SELECT USING (
    course_id IS NULL OR
    course_id IN (SELECT course_id FROM enrollments WHERE user_id = auth.uid()) OR
    get_my_role() = 'admin'
  );

CREATE POLICY "Admins can create announcements" ON announcements
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can update announcements" ON announcements
  FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "Admins can delete announcements" ON announcements
  FOR DELETE USING (get_my_role() = 'admin');

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- User XP
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all XP data" ON user_xp
  FOR SELECT USING (true);

CREATE POLICY "System can manage XP" ON user_xp
  FOR ALL USING (true);

-- XP Transactions
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own XP transactions" ON xp_transactions
  FOR SELECT USING (user_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "System can create XP transactions" ON xp_transactions
  FOR INSERT WITH CHECK (true);

-- Badges
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view badges" ON badges
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges" ON badges
  FOR ALL USING (get_my_role() = 'admin');

-- User Badges
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all user badges" ON user_badges
  FOR SELECT USING (true);

CREATE POLICY "System can award badges" ON user_badges
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to award XP to a user
CREATE OR REPLACE FUNCTION award_xp(
  user_id_param UUID,
  action_type_param TEXT,
  xp_amount INTEGER,
  description_param TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Insert XP transaction
  INSERT INTO xp_transactions (user_id, action_type, xp_earned, description)
  VALUES (user_id_param, action_type_param, xp_amount, description_param);
  
  -- Update or insert user XP
  INSERT INTO user_xp (user_id, xp_points, total_xp)
  VALUES (user_id_param, xp_amount, xp_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    xp_points = user_xp.xp_points + xp_amount,
    total_xp = user_xp.total_xp + xp_amount,
    level = FLOOR((user_xp.total_xp + xp_amount) / 1000) + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  user_id_param UUID,
  type_param TEXT,
  title_param TEXT,
  content_param TEXT,
  link_param TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, content, link)
  VALUES (user_id_param, type_param, title_param, content_param, link_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update thread post count
CREATE OR REPLACE FUNCTION update_thread_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussion_threads
    SET posts_count = posts_count + 1, updated_at = now()
    WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussion_threads
    SET posts_count = GREATEST(posts_count - 1, 0)
    WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_post_count
AFTER INSERT OR DELETE ON discussion_posts
FOR EACH ROW EXECUTE FUNCTION update_thread_post_count();

-- Function to update post likes count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussion_posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussion_posts
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_likes_count
AFTER INSERT OR DELETE ON discussion_post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Function to update Q&A votes
CREATE OR REPLACE FUNCTION update_qa_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.votable_type = 'question' THEN
      UPDATE qa_questions
      SET votes = votes + NEW.vote_type
      WHERE id = NEW.votable_id;
    ELSIF NEW.votable_type = 'answer' THEN
      UPDATE qa_answers
      SET votes = votes + NEW.vote_type
      WHERE id = NEW.votable_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.votable_type = 'question' THEN
      UPDATE qa_questions
      SET votes = votes - OLD.vote_type + NEW.vote_type
      WHERE id = NEW.votable_id;
    ELSIF NEW.votable_type = 'answer' THEN
      UPDATE qa_answers
      SET votes = votes - OLD.vote_type + NEW.vote_type
      WHERE id = NEW.votable_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.votable_type = 'question' THEN
      UPDATE qa_questions
      SET votes = votes - OLD.vote_type
      WHERE id = OLD.votable_id;
    ELSIF OLD.votable_type = 'answer' THEN
      UPDATE qa_answers
      SET votes = votes - OLD.vote_type
      WHERE id = OLD.votable_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_qa_votes
AFTER INSERT OR UPDATE OR DELETE ON qa_votes
FOR EACH ROW EXECUTE FUNCTION update_qa_votes();

-- ============================================================================
-- 8. SEED DATA (SAMPLE BADGES)
-- ============================================================================

INSERT INTO badges (name, description, icon, xp_reward, requirement_type, requirement_value)
VALUES
  ('First Steps', 'Complete your first video', '🎬', 50, 'videos_watched', 1),
  ('Knowledge Seeker', 'Watch 10 videos', '📚', 100, 'videos_watched', 10),
  ('Marathon Learner', 'Watch 50 videos', '🏃', 500, 'videos_watched', 50),
  ('Quiz Master', 'Pass 5 quizzes', '✅', 200, 'quizzes_passed', 5),
  ('Perfect Score', 'Get 100% on any assessment', '💯', 300, 'perfect_assessments', 1),
  ('Social Butterfly', 'Post 10 times in forums', '💬', 150, 'forum_posts', 10),
  ('Helper', 'Get 25 likes on your posts', '❤️', 250, 'post_likes', 25),
  ('Course Champion', 'Complete a full course', '🏆', 1000, 'courses_completed', 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Enable Realtime for discussion_posts, study_group_messages, notifications tables in Supabase dashboard
-- 2. Build discussion forum UI
-- 3. Build Q&A system UI
-- 4. Build study groups UI
-- 5. Implement notification system
-- 6. Add leaderboard displays
-- ============================================================================
