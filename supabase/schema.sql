-- mySTAR 술자리 피드백 앱 스키마

-- 방 테이블
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(6) UNIQUE NOT NULL,
  name text NOT NULL,
  host_session text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 참여자 테이블
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  session_token text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now()
);

-- 리액션 테이블 (하트, 자제 시그널, 별점)
CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_session text NOT NULL,
  receiver_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('heart', 'warning', 'star')),
  value int,
  round int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 방 종료 투표
CREATE TABLE IF NOT EXISTS end_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  voter_session text NOT NULL,
  voted_for_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, voter_session, voted_for_id)
);

-- 알림 라운드 테이블
CREATE TABLE IF NOT EXISTS notification_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE end_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true);
CREATE POLICY "participants_select" ON participants FOR SELECT USING (true);
CREATE POLICY "participants_insert" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "participants_delete" ON participants FOR DELETE USING (true);
CREATE POLICY "reactions_select" ON reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "end_votes_select" ON end_votes FOR SELECT USING (true);
CREATE POLICY "end_votes_insert" ON end_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "notification_rounds_select" ON notification_rounds FOR SELECT USING (true);
CREATE POLICY "notification_rounds_insert" ON notification_rounds FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_reactions_room_id ON reactions(room_id);
CREATE INDEX IF NOT EXISTS idx_reactions_receiver_id ON reactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_reactions_round ON reactions(room_id, round);
CREATE INDEX IF NOT EXISTS idx_end_votes_room_id ON end_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_notification_rounds_room_id ON notification_rounds(room_id);

CREATE OR REPLACE FUNCTION delete_old_rooms()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rooms
  WHERE status = 'ended'
    AND created_at < now() - INTERVAL '24 hours';
END;
$$;
