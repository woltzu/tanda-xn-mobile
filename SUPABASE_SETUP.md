# TandaXn Supabase Setup Guide

This guide walks you through setting up Supabase to enable **cross-device circle sharing** in TandaXn.

## What Was Changed

### 1. Database Schema (`lib/database.sql`)
- **profiles** - Extended user profiles with XnScore, trust tier
- **circles** - Main circles/tanda groups with all fields
- **circle_members** - Junction table for memberships
- **contributions** - Track contributions to circles
- **payouts** - Track payouts to members
- **invited_members** - Pending invitations
- Row Level Security (RLS) policies for secure access
- Real-time subscriptions enabled
- Auto-sync triggers for member counts

### 2. CirclesContext (`context/CirclesContext.tsx`)
- Changed from AsyncStorage (local) to Supabase (cloud)
- Real-time subscriptions for instant updates across devices
- Async `findCircleByInviteCode` for database search
- `leaveCircle` function added
- Error state tracking

### 3. Screen Updates
- `JoinCircleByCodeScreen.tsx` - Now uses async database search
- `QRScannerScreen.tsx` - Now uses async database search

---

## Setup Instructions

### Step 1: Open Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your TandaXn project: `fjqdkyjkwqeoafwvnjgv`
3. Click **SQL Editor** in the left sidebar

### Step 2: Run the Database Schema

1. Click **New Query**
2. Copy the entire contents of `lib/database.sql`
3. Paste into the SQL editor
4. Click **Run** (or press Ctrl+Enter)

You should see "Success" messages for all CREATE statements.

### Step 3: Verify Tables Were Created

1. Click **Table Editor** in the left sidebar
2. You should see these new tables:
   - `profiles`
   - `circles`
   - `circle_members`
   - `contributions`
   - `payouts`
   - `invited_members`

### Step 4: Enable Realtime (if not already)

1. Go to **Database** > **Replication**
2. Under "Realtime" section, ensure these tables are enabled:
   - `circles`
   - `circle_members`

### Step 5: Test the App

1. **Phone A**: Create a new circle
   - Go to Circles tab
   - Tap "Create Circle"
   - Follow the steps
   - Note the invite code shown at the end

2. **Phone B**: Join the circle
   - Go to Circles tab
   - Tap "Join Circle" or "Find Circle"
   - Enter the invite code from Phone A
   - You should see the circle and be able to join!

---

## How It Works Now

### Before (Local Storage)
```
Phone A creates circle → Stored in Phone A's memory only
Phone B searches → Searches Phone B's memory (empty)
Result: "Circle not found"
```

### After (Supabase Cloud)
```
Phone A creates circle → Stored in Supabase database
Phone B searches → Searches Supabase database
Result: Circle found! User can join.
```

### Real-time Updates
When someone:
- Creates a circle → All users see it instantly
- Joins a circle → Member count updates everywhere
- Leaves a circle → Updates propagate automatically

---

## Troubleshooting

### "relation does not exist" Error
The database schema hasn't been run. Follow Step 2 above.

### "permission denied" Error
RLS policies may not be applied. Re-run the SQL script.

### Circle not found after creation
1. Check Supabase Table Editor > circles table
2. Verify the circle was inserted
3. Check the `invite_code` column value

### Real-time not working
1. Go to Database > Replication
2. Enable replication for `circles` and `circle_members` tables
3. Restart the app

---

## API Keys (Already Configured)

Your app already has these in `lib/supabase.ts`:
```typescript
SUPABASE_URL: "https://fjqdkyjkwqeoafwvnjgv.supabase.co"
SUPABASE_ANON_KEY: "sb_publishable_fDpAZ7hA8z1nF3vWFr2l_Q_UbBHHzKk"
```

No changes needed to these.

---

## Database Schema Overview

```
┌─────────────┐      ┌──────────────────┐      ┌────────────┐
│   profiles  │      │     circles      │      │  payouts   │
│─────────────│      │──────────────────│      │────────────│
│ id (FK)     │      │ id               │◄────►│ circle_id  │
│ email       │      │ name             │      │ recipient  │
│ full_name   │      │ type             │      │ amount     │
│ xn_score    │      │ amount           │      │ status     │
│ trust_tier  │      │ invite_code      │      └────────────┘
└─────────────┘      │ created_by (FK)  │
       │             │ status           │
       │             └────────┬─────────┘
       │                      │
       └───────────┬──────────┘
                   │
           ┌───────▼────────┐
           │ circle_members │
           │────────────────│
           │ circle_id (FK) │
           │ user_id (FK)   │
           │ position       │
           │ role           │
           └───────┬────────┘
                   │
           ┌───────▼────────┐
           │ contributions  │
           │────────────────│
           │ circle_id (FK) │
           │ member_id (FK) │
           │ amount         │
           │ status         │
           └────────────────┘
```

---

## Next Steps

After basic setup works:

1. **Wallet Integration** - Sync wallet/transactions to Supabase
2. **XnScore Sync** - Calculate and store XnScore in database
3. **Push Notifications** - Notify users of contributions/payouts
4. **Payment Processing** - Integrate Stripe/Wave/M-Pesa

---

## Support

If you encounter issues:
1. Check the Supabase logs: Dashboard > Logs
2. Check the app console for errors
3. Verify RLS policies are correct

The implementation follows Supabase best practices with:
- Row Level Security for data protection
- Real-time subscriptions for instant updates
- Proper foreign key relationships
- Automatic triggers for data consistency
