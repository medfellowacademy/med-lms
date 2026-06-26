'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'

interface StudyGroup {
  id: string
  name: string
  description: string | null
  course_id: string
  owner_id: string
  max_members: number
  private: boolean
  created_at: string
  courses: {
    title: string
  }
  profiles: {
    full_name: string
  }
  member_count?: number
  is_member?: boolean
}

export default function StudyGroupsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [groups, setGroups] = useState<StudyGroup[]>([])
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'discover' | 'my-groups'>('my-groups')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupCourseId, setNewGroupCourseId] = useState('')
  const [newGroupPrivate, setNewGroupPrivate] = useState(false)
  const [newGroupMaxMembers, setNewGroupMaxMembers] = useState(10)
  const [creating, setCreating] = useState(false)
  const [courses, setCourses] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadGroups()
    loadCourses()
    getCurrentUser()
  }, [])

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
  }

  async function loadCourses() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get enrolled courses
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, courses(id, title)')
        .eq('user_id', user.id)

      setCourses(enrollments?.map(e => e.courses).filter(Boolean) || [])
    } catch (err) {
      console.error('Error loading courses:', err)
    }
  }

  async function loadGroups() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get all public groups
      const { data: publicGroups, error: publicError } = await supabase
        .from('study_groups')
        .select(`
          *,
          courses(title),
          profiles(full_name)
        `)
        .eq('private', false)
        .order('created_at', { ascending: false })

      if (publicError) throw publicError

      // Get groups user is member of
      const { data: memberships } = await supabase
        .from('study_group_members')
        .select('group_id, study_groups(*,courses(title),profiles(full_name))')
        .eq('user_id', user.id)

      const userGroups = memberships?.map(m => m.study_groups).filter(Boolean) || []

      // Get member counts
      const allGroups = [...(publicGroups || []), ...userGroups]
      const uniqueGroups = Array.from(new Map(allGroups.map(g => [g.id, g])).values())

      const groupsWithMeta = await Promise.all(uniqueGroups.map(async (g: any) => {
        const { data: members } = await supabase
          .from('study_group_members')
          .select('id')
          .eq('group_id', g.id)

        const isMember = userGroups.some((ug: any) => ug.id === g.id)

        return {
          ...g,
          member_count: members?.length || 0,
          is_member: isMember
        }
      }))

      setGroups(groupsWithMeta.filter(g => !g.is_member))
      setMyGroups(groupsWithMeta.filter(g => g.is_member))
    } catch (err) {
      console.error('Error loading groups:', err)
    } finally {
      setLoading(false)
    }
  }

  async function createGroup() {
    if (!newGroupName.trim() || !newGroupCourseId) {
      alert('Please provide group name and select a course')
      return
    }

    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: group, error: groupError } = await supabase
        .from('study_groups')
        .insert({
          name: newGroupName,
          description: newGroupDescription || null,
          course_id: newGroupCourseId,
          owner_id: user.id,
          max_members: newGroupMaxMembers,
          private: newGroupPrivate
        })
        .select()
        .single()

      if (groupError) throw groupError

      // Add creator as member
      const { error: memberError } = await supabase
        .from('study_group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'owner'
        })

      if (memberError) throw memberError

      // Award XP
      await supabase.rpc('award_xp', {
        user_id_param: user.id,
        action_type_param: 'study_group',
        xp_amount: 20,
        description_param: 'Created study group'
      })

      setShowCreateModal(false)
      setNewGroupName('')
      setNewGroupDescription('')
      setNewGroupCourseId('')
      setNewGroupPrivate(false)
      setNewGroupMaxMembers(10)
      
      router.push(`/student/study-groups/${group.id}`)
    } catch (err) {
      console.error('Error creating group:', err)
      alert('Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  async function joinGroup(groupId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('study_group_members')
        .insert({
          group_id: groupId,
          user_id: user.id,
          role: 'member'
        })

      if (error) throw error

      // Award XP
      await supabase.rpc('award_xp', {
        user_id_param: user.id,
        action_type_param: 'study_group',
        xp_amount: 5,
        description_param: 'Joined study group'
      })

      loadGroups()
    } catch (err) {
      console.error('Error joining group:', err)
      alert('Failed to join group')
    }
  }

  async function leaveGroup(groupId: string) {
    if (!confirm('Are you sure you want to leave this group?')) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id)

      if (error) throw error

      loadGroups()
    } catch (err) {
      console.error('Error leaving group:', err)
      alert('Failed to leave group')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 100, width: '100%' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Link href="/student">
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}>
              ← Dashboard
            </button>
          </Link>
          <h1 className="page-title">Study Groups</h1>
          <p className="page-subtitle">Collaborate with peers and learn together</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          + Create Group
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('my-groups')}
          className={`tab ${activeTab === 'my-groups' ? 'active' : ''}`}
        >
          My Groups ({myGroups.length})
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`tab ${activeTab === 'discover' ? 'active' : ''}`}
        >
          Discover ({groups.length})
        </button>
      </div>

      {/* Groups list */}
      {activeTab === 'my-groups' && (
        <>
          {myGroups.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">👥</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                You're not in any groups yet
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Join or create a study group to collaborate with peers
              </p>
              <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                + Create Group
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {myGroups.map((group, idx) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link href={`/student/study-groups/${group.id}`} style={{ textDecoration: 'none' }}>
                    <div className="card card-pad card-hover" style={{ cursor: 'pointer', height: '100%' }}>
                      <div style={{ marginBottom: 12 }}>
                        {group.private && <span className="chip chip-neutral" style={{ marginBottom: 8 }}>Private</span>}
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{group.name}</h3>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                          {group.courses.title}
                        </p>
                        {group.description && (
                          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                            {group.description.length > 100 ? group.description.slice(0, 100) + '...' : group.description}
                          </p>
                        )}
                      </div>
                      <div style={{
                        display: 'flex', gap: 16, paddingTop: 12,
                        borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)'
                      }}>
                        <span>{group.member_count}/{group.max_members} members</span>
                        <span>•</span>
                        <span>By {group.profiles.full_name}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'discover' && (
        <>
          {groups.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🔍</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                No groups available
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Be the first to create a study group!
              </p>
              <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                + Create Group
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {groups.map((group, idx) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className="card card-pad">
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{group.name}</h3>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                        {group.courses.title}
                      </p>
                      {group.description && (
                        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                          {group.description.length > 100 ? group.description.slice(0, 100) + '...' : group.description}
                        </p>
                      )}
                    </div>
                    <div style={{
                      display: 'flex', gap: 16, paddingTop: 12, paddingBottom: 12,
                      borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)'
                    }}>
                      <span>{group.member_count}/{group.max_members} members</span>
                      <span>•</span>
                      <span>By {group.profiles.full_name}</span>
                    </div>
                    <button
                      onClick={() => joinGroup(group.id)}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      disabled={(group.member_count || 0) >= group.max_members}
                    >
                      {(group.member_count || 0) >= group.max_members ? 'Group Full' : 'Join Group'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="card card-pad"
            style={{ maxWidth: 500, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Create Study Group</h2>
            
            <div style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ marginBottom: 8 }}>Group Name*</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Cardiology Study Group"
                className="input"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ marginBottom: 8 }}>Course*</label>
              <select
                value={newGroupCourseId}
                onChange={(e) => setNewGroupCourseId(e.target.value)}
                className="input"
              >
                <option value="">Select a course</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ marginBottom: 8 }}>Description</label>
              <textarea
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="What's this group about?"
                className="textarea"
                rows={3}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ marginBottom: 8 }}>Max Members</label>
              <input
                type="number"
                value={newGroupMaxMembers}
                onChange={(e) => setNewGroupMaxMembers(Math.max(2, Math.min(50, parseInt(e.target.value) || 10)))}
                min="2"
                max="50"
                className="input"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newGroupPrivate}
                  onChange={(e) => setNewGroupPrivate(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14 }}>Make this group private (only invited members can join)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                className="btn btn-primary"
                disabled={creating || !newGroupName.trim() || !newGroupCourseId}
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
