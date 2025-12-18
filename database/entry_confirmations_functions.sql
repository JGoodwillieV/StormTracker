-- Database Functions for Entry Confirmations
-- Supporting functions for the parent meet entry confirmation workflow

-- ============================================
-- GET PARENT PENDING ACTIONS
-- ============================================
-- Returns a list of meets that require parent confirmation
-- for all swimmers associated with a parent

CREATE OR REPLACE FUNCTION get_parent_pending_actions(parent_user_uuid UUID)
RETURNS TABLE (
  meet_id UUID,
  swimmer_id BIGINT,
  meet_name VARCHAR(200),
  swimmer_name VARCHAR(100),
  entry_deadline TIMESTAMP WITH TIME ZONE,
  event_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    m.id AS meet_id,
    s.id AS swimmer_id,
    m.name AS meet_name,
    s.name AS swimmer_name,
    m.entry_deadline,
    COUNT(me.id) AS event_count
  FROM meets m
  INNER JOIN meet_entries me ON me.meet_id = m.id
  INNER JOIN swimmers s ON s.id = me.swimmer_id
  INNER JOIN parents p ON p.id = s.parent_id
  LEFT JOIN entry_confirmations ec ON 
    ec.meet_id = m.id 
    AND ec.swimmer_id = s.id 
    AND ec.parent_id = p.id
  WHERE 
    p.user_id = parent_user_uuid
    AND m.status = 'open'  -- Only open meets
    AND (ec.id IS NULL OR ec.status = 'pending')  -- No confirmation or pending
  GROUP BY m.id, s.id, m.name, s.name, m.entry_deadline
  ORDER BY m.entry_deadline ASC NULLS LAST, m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_parent_pending_actions(UUID) TO authenticated;


-- ============================================
-- GET MEET CONFIRMATION STATS
-- ============================================
-- Returns statistics about confirmations for a specific meet

CREATE OR REPLACE FUNCTION get_meet_confirmation_stats(meet_uuid UUID)
RETURNS TABLE (
  total_swimmers BIGINT,
  confirmed_count BIGINT,
  change_requested_count BIGINT,
  pending_count BIGINT,
  declined_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT me.swimmer_id) AS total_swimmers,
    COUNT(DISTINCT CASE WHEN ec.status = 'confirmed' THEN ec.swimmer_id END) AS confirmed_count,
    COUNT(DISTINCT CASE WHEN ec.status = 'change_requested' THEN ec.swimmer_id END) AS change_requested_count,
    COUNT(DISTINCT CASE WHEN ec.status = 'pending' OR ec.id IS NULL THEN me.swimmer_id END) AS pending_count,
    COUNT(DISTINCT CASE WHEN ec.status = 'declined' THEN ec.swimmer_id END) AS declined_count
  FROM meet_entries me
  LEFT JOIN entry_confirmations ec ON 
    ec.meet_id = me.meet_id 
    AND ec.swimmer_id = me.swimmer_id
  WHERE me.meet_id = meet_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_meet_confirmation_stats(UUID) TO authenticated;

