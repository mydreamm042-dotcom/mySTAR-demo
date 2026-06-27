export type RoomStatus = 'active' | 'ended'
export type ReactionType = 'heart' | 'warning' | 'star'

export interface Room {
  id: string
  code: string
  name: string
  host_session: string
  status: RoomStatus
  created_at: string
}

export interface Participant {
  id: string
  room_id: string
  nickname: string
  session_token: string
  joined_at: string
}

export interface Reaction {
  id: string
  room_id: string
  receiver_id: string
  type: ReactionType
  value: number | null
  round: number
  created_at: string
}

export interface EndVote {
  id: string
  room_id: string
  voter_session: string
  voted_for_id: string
  created_at: string
}

export interface NotificationRound {
  id: string
  room_id: string
  round_number: number
  triggered_at: string
}

export interface SafeParticipant {
  id: string
  room_id: string
  joined_at: string
}

export interface RoomSummary {
  room: Room
  participants: Participant[]
  heartTopThree: { participant: Participant; count: number }[]
  moodTimeline: { round: number; average: number; triggered_at: string }[]
  seeAgainVotes: { participant: Participant; count: number }[]
}
