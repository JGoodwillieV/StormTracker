-- Entry Confirmations Table
-- Stores parent confirmations for meet entries
-- Allows parents to confirm, request changes, or scratch events

CREATE TABLE IF NOT EXISTS entry_confirmations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meet_id UUID NOT NULL,
  swimmer_id BIGINT NOT NULL,
  parent_id BIGINT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  
  -- Status of confirmation
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'change_requested', 'declined')),
  
  -- Parent feedback
  parent_notes TEXT,
  
  -- Array of meet_entry IDs that parent wants to scratch
  scratch_requests UUID[],
  
  -- Timestamps
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for upsert functionality
  CONSTRAINT unique_confirmation_per_swimmer_meet UNIQUE (meet_id, swimmer_id, parent_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_entry_confirmations_meet ON entry_confirmations(meet_id);
CREATE INDEX IF NOT EXISTS idx_entry_confirmations_swimmer ON entry_confirmations(swimmer_id);
CREATE INDEX IF NOT EXISTS idx_entry_confirmations_parent ON entry_confirmations(parent_id);
CREATE INDEX IF NOT EXISTS idx_entry_confirmations_status ON entry_confirmations(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE entry_confirmations ENABLE ROW LEVEL SECURITY;

-- Parents can view their own confirmations
CREATE POLICY "Parents can view their own confirmations"
  ON entry_confirmations FOR SELECT
  USING (
    parent_id IN (
      SELECT id FROM parents WHERE user_id = auth.uid()
    )
  );

-- Parents can insert/update their own confirmations
CREATE POLICY "Parents can manage their own confirmations"
  ON entry_confirmations FOR ALL
  USING (
    parent_id IN (
      SELECT id FROM parents WHERE user_id = auth.uid()
    )
  );

-- Coaches can view all confirmations
CREATE POLICY "Coaches can view all confirmations"
  ON entry_confirmations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('coach', 'admin')
    )
  );

-- Coaches can update confirmation status (e.g., processing scratch requests)
CREATE POLICY "Coaches can update confirmations"
  ON entry_confirmations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('coach', 'admin')
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp on changes
CREATE OR REPLACE FUNCTION update_entry_confirmations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_confirmations_updated_at
  BEFORE UPDATE ON entry_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION update_entry_confirmations_updated_at();

