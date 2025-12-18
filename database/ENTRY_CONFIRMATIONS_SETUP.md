# Entry Confirmations Setup Guide

This guide explains how to set up the meet entry confirmation feature in StormTracker, which allows parents to review and confirm their swimmer's meet entries.

## Overview

The entry confirmations feature enables:
- Parents to review meet entries for their swimmers
- Parents to confirm entries, request changes, or scratch specific events
- Coaches to see confirmation status and parent feedback
- Automated tracking of pending confirmations with deadline alerts

## Setup Steps

### 1. Create the Database Table

First, create the `entry_confirmations` table in your Supabase database:

1. Log in to your Supabase project at https://supabase.com
2. Navigate to the **SQL Editor**
3. Copy the contents of `database/entry_confirmations_schema.sql`
4. Paste it into the SQL Editor and click **"Run"**

This will create:
- The `entry_confirmations` table with all necessary columns
- Indexes for efficient querying
- Row Level Security (RLS) policies for parent and coach access
- Triggers for automatic timestamp updates

### 2. Create Database Functions

Next, create the supporting database functions:

1. In the Supabase **SQL Editor**
2. Copy the contents of `database/entry_confirmations_functions.sql`
3. Paste it into the SQL Editor and click **"Run"**

This will create:
- `get_parent_pending_actions()` - Returns pending confirmation actions for a parent
- `get_meet_confirmation_stats()` - Returns statistics for a meet's confirmation status

### 3. Verify the Setup

To verify everything is working:

1. Open StormTracker in your browser
2. Log in as a **parent** user
3. Navigate to the **Parent Dashboard**
4. You should see the **Action Center** with any pending meet confirmations
5. Click on a pending action to review entries
6. Test the confirmation flow:
   - Select events to scratch
   - Add notes
   - Click "Submit Changes"

If you see the error "TypeError: Failed to fetch", it means the table wasn't created properly. Go back to Step 1.

## Database Schema

### entry_confirmations Table

```sql
- id: UUID (Primary Key)
- meet_id: UUID (References meets.id)
- swimmer_id: BIGINT (References swimmers.id)
- parent_id: BIGINT (References parents.id)
- status: VARCHAR(50) - 'pending', 'confirmed', 'change_requested', 'declined'
- parent_notes: TEXT - Optional notes from parent
- scratch_requests: UUID[] - Array of meet_entry IDs to scratch
- confirmed_at: TIMESTAMP WITH TIME ZONE
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE

UNIQUE CONSTRAINT: (meet_id, swimmer_id, parent_id)
```

### Status Values

- **pending**: Initial state, awaiting parent confirmation
- **confirmed**: Parent has confirmed all entries are correct
- **change_requested**: Parent wants to scratch events or has questions
- **declined**: Parent declines participation in the meet

## How It Works

### For Parents

1. When a coach publishes meet entries (sets meet status to 'open'), parents see pending actions in their dashboard
2. Parents can:
   - Review all entered events for their swimmer
   - Confirm entries are correct
   - Select events to scratch (shown with visual indication)
   - Add notes or questions for the coach
3. The deadline is displayed prominently with urgency indicators
4. Once submitted, the confirmation is saved and removed from pending actions

### For Coaches

1. In the **Meet Entries Manager**, coaches can:
   - See confirmation statistics (confirmed, pending, change requested)
   - View individual parent confirmations with notes
   - See which events parents want to scratch
   - Process scratch requests and update entries accordingly

### Workflow

```
1. Coach creates meet and adds entries
2. Coach publishes meet (status = 'open')
3. Parent sees action in dashboard
4. Parent reviews and confirms/requests changes
5. Coach sees confirmation status
6. Coach processes any scratch requests
7. Meet entries are finalized
```

## Parent Dashboard Features

### Action Required Section

- Shows pending confirmations that need attention
- **Urgent alerts** for deadlines within 24 hours (red highlight, animated)
- **Color coding**:
  - Red gradient: Urgent (< 24 hours)
  - White with blue accent: Normal priority
  - Green: All caught up

### Confirmation Detail View

- Event list with all entered events
- Checkbox to select events for scratching
- Visual indication of scratched events (red background, strikethrough)
- Notes input for parent feedback
- Two submission modes:
  - **"Confirm All Events"**: No changes needed (green button)
  - **"Submit Changes"**: Has scratches or notes (blue button)

### Recent Confirmations

- Shows last 10 confirmations
- Status badges (confirmed, change_requested, declined)
- Timestamp of when confirmation was submitted

## Database Functions

### get_parent_pending_actions(parent_user_uuid)

Returns pending confirmations for a parent's swimmers:

```sql
SELECT * FROM get_parent_pending_actions('user-uuid-here');
```

Returns:
- meet_id, swimmer_id, meet_name, swimmer_name
- entry_deadline
- event_count (number of events entered)

### get_meet_confirmation_stats(meet_uuid)

Returns confirmation statistics for a meet:

```sql
SELECT * FROM get_meet_confirmation_stats('meet-uuid-here');
```

Returns:
- total_swimmers
- confirmed_count
- change_requested_count
- pending_count
- declined_count

## Row Level Security (RLS)

The table has RLS policies that ensure:

1. **Parents** can only:
   - View their own confirmations
   - Insert/update their own confirmations
   
2. **Coaches/Admins** can:
   - View all confirmations
   - Update confirmation status (e.g., mark as processed)

## Troubleshooting

### "TypeError: Failed to fetch" Error

**Cause**: The `entry_confirmations` table doesn't exist in your database.

**Solution**:
1. Run `database/entry_confirmations_schema.sql` in Supabase SQL Editor
2. Verify the table was created: `SELECT * FROM entry_confirmations;`
3. Check RLS policies are enabled

### Pending Actions Not Showing

**Possible causes**:

1. **Function not created**: Run `database/entry_confirmations_functions.sql`
2. **Meet status**: Ensure meet status is 'open' (not 'draft' or 'closed')
3. **Parent linkage**: Verify swimmer's `parent_id` matches the logged-in parent's ID
4. **No entries**: Confirm meet_entries exist for the swimmer

**Check with SQL**:
```sql
-- Verify function exists
SELECT * FROM get_parent_pending_actions('your-user-uuid');

-- Check meet entries
SELECT * FROM meet_entries WHERE swimmer_id = YOUR_SWIMMER_ID;

-- Check parent linkage
SELECT * FROM swimmers WHERE parent_id = YOUR_PARENT_ID;
```

### Permission Errors

If you get permission errors when submitting confirmations:

1. **Check RLS policies**: Verify they're enabled and correct
2. **Check parent record**: Ensure the parent's `user_id` matches `auth.uid()`
3. **Check authentication**: Verify user is logged in

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'entry_confirmations';

-- Verify parent user_id
SELECT * FROM parents WHERE user_id = auth.uid();
```

### Confirmation Not Saving

**Common issues**:

1. **Unique constraint violation**: Check if confirmation already exists for this combo
2. **Foreign key error**: Verify meet_id, swimmer_id, and parent_id are valid
3. **Invalid status**: Status must be one of: 'pending', 'confirmed', 'change_requested', 'declined'

**Debug with**:
```sql
-- Check existing confirmations
SELECT * FROM entry_confirmations 
WHERE meet_id = 'meet-uuid' 
AND swimmer_id = swimmer_id_value;
```

## Required Dependencies

This feature requires these other database tables to exist:
- `meets` - Created when managing meets
- `meet_entries` - Created when entering swimmers in meets  
- `swimmers` - Core swimmer data
- `parents` - Parent accounts and linkage to swimmers
- `user_profiles` - For role checking (coach vs parent)

If any of these are missing, create them first.

## Integration Points

### Meet Publishing

When a coach publishes a meet, consider creating an announcement:

```javascript
await supabase.from('announcements').insert({
  title: `ACTION REQUIRED: ${meetName} Entries`,
  content: `Meet entries are now available for review...`,
  type: 'meet',
  is_urgent: true
});
```

### Notification System

Future enhancement: Send push notifications or emails when:
- New entries are published
- Deadline is approaching
- Coach responds to change requests

## Future Enhancements

Possible additions:
- Email notifications for pending confirmations
- Push notifications for urgent deadlines
- Bulk confirmation for parents with multiple swimmers
- History of all past confirmations
- Coach comments/responses on change requests
- Deadline reminders (48h, 24h, 6h)
- Mobile app integration

## Support

If you encounter issues:

1. Check this guide
2. Verify all SQL scripts ran successfully
3. Check Supabase project logs
4. Inspect browser console for errors
5. Verify RLS policies with the queries above

For help, contact the StormTracker development team.

