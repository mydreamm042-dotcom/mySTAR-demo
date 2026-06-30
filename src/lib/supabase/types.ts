export type RoomStatus = 'active' | 'ended'
export type ReactionType = 'heart' | 'warning' | 'star' | 'hot'

export interface Room {
  id: string
  code: string
  name: string
  host_session: string
  status: RoomStatus
  created_at: string
  ended_at?: string | null
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
  sender_participant_id: string | null
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

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: Room
        Insert: Omit<Room, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Room>
      }
      participants: {
        Row: Participant
        Insert: Omit<Participant, 'id' | 'joined_at'> & { id?: string; joined_at?: string }
        Update: Partial<Participant>
      }
      reactions: {
        Row: Reaction & { sender_session: string }
        Insert: Omit<Reaction, 'id' | 'created_at'> & { sender_session: string; id?: string; created_at?: string }
        Update: Partial<Reaction>
      }
      end_votes: {
        Row: EndVote
        Insert: Omit<EndVote, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<EndVote>
      }
      notification_rounds: {
        Row: NotificationRound
        Insert: Omit<NotificationRound, 'id' | 'triggered_at'> & { id?: string; triggered_at?: string }
        Update: Partial<NotificationRound>
      }
    }
  }
}
