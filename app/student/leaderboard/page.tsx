'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'

interface LeaderboardEntry {
  user_id: string
  total_xp: number
  level: number
  profiles: {
    full_name: string
    role: string
  }
}

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  xp_required: number
}

interface UserBadge {
  badge_id: string
  earned_at: string
  badges: Badge
}

export default function LeaderboardPage() {
  const supabase = createClient()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [userBadges, setUserBadges] = useState<UserBadge[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userRank, setUserRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }

      // Load leaderboard
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('user_xp')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .order('total_xp', { ascending: false })
        .limit(100)

      if (leaderboardError) throw leaderboardError
      setLeaderboard(leaderboardData || [])

      // Calculate user rank
      if (user && leaderboardData) {
        const rank = leaderboardData.findIndex(entry => entry.user_id === user.id) + 1
        setUserRank(rank || null)
      }

      // Load all badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('badges')
        .select('*')
        .order('xp_required', { ascending: true })

      if (badgesError) throw badgesError
      setBadges(badgesData || [])

      // Load user's earned badges
      if (user) {
        const { data: userBadgesData, error: userBadgesError } = await supabase
          .from('user_badges')
          .select(`
            *,
            badges(*)
          `)
          .eq('user_id', user.id)

        if (userBadgesError) throw userBadgesError
        setUserBadges(userBadgesData || [])
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err)
    } finally {
      setLoading(false)
    }
  }

  function getLevelColor(level: number) {
    if (level >= 10) return 'var(--purple)'
    if (level >= 5) return 'var(--orange)'
    return 'var(--teal)'
  }

  function hasBadge(badgeId: string) {
    return userBadges.some(ub => ub.badge_id === badgeId)
  }

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <div className="skeleton" style={{ height: 24, width: 300, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 400, width: '100%' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      <h1 className="page-title">🏆 Leaderboard</h1>
      <p className="page-subtitle">
        Compete with fellow learners and earn badges
      </p>

      {/* User stats card */}
      {currentUserId && userRank && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{
            padding: 20,
            marginBottom: 24,
            background: 'linear-gradient(135deg, var(--teal), var(--purple))',
            color: 'white'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>Your Rank</div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>
                #{userRank}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>Total XP</div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>
                {leaderboard.find(e => e.user_id === currentUserId)?.total_xp || 0}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>Level</div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>
                {leaderboard.find(e => e.user_id === currentUserId)?.level || 1}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>Badges</div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>
                {userBadges.length}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Leaderboard table */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Top Learners</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Rank</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Level</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>XP</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = entry.user_id === currentUserId
                  const rankDisplay = index + 1

                  return (
                    <motion.tr
                      key={entry.user_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isCurrentUser ? 'var(--teal-soft)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 600 }}>
                        {rankDisplay === 1 ? '🥇' : rankDisplay === 2 ? '🥈' : rankDisplay === 3 ? '🥉' : `#${rankDisplay}`}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'var(--teal-soft)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--teal)'
                          }}>
                            {entry.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>
                              {entry.profiles.full_name}
                              {isCurrentUser && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (You)</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          background: getLevelColor(entry.level),
                          color: 'white'
                        }}>
                          Lvl {entry.level}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 14, fontWeight: 600 }}>
                        {entry.total_xp.toLocaleString()}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Badges sidebar */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Badges</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {badges.map(badge => {
              const earned = hasBadge(badge.id)
              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card card-hover"
                  style={{
                    padding: 16,
                    opacity: earned ? 1 : 0.5,
                    cursor: 'default'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      fontSize: 32,
                      filter: earned ? 'none' : 'grayscale(1)'
                    }}>
                      {badge.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                        {badge.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                        {badge.description}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {badge.xp_required} XP required
                      </div>
                    </div>
                    {earned && (
                      <div style={{ fontSize: 20 }}>✓</div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
