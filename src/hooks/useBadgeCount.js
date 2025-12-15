// src/hooks/useBadgeCount.js
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useBadgeCount() {
  const [badgeCount, setBadgeCount] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if Badge API is supported
    const supported = 'setAppBadge' in navigator && 'clearAppBadge' in navigator;
    setIsSupported(supported);

    // Load initial badge count
    loadBadgeCount();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel('badge-count-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_badge_counts',
          filter: `user_id=eq.${supabase.auth.getUser().then(r => r.data.user?.id)}`
        },
        (payload) => {
          console.log('[Badge] Count updated:', payload);
          if (payload.new) {
            updateBadge(payload.new.unread_count || 0);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadBadgeCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_badge_counts')
        .select('unread_count')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        updateBadge(data.unread_count || 0);
      }
    } catch (err) {
      console.error('[Badge] Failed to load count:', err);
    }
  };

  const updateBadge = async (count) => {
    setBadgeCount(count);

    if (!isSupported) {
      console.log('[Badge] Badge API not supported');
      return;
    }

    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
        console.log('[Badge] Set to:', count);
      } else {
        await navigator.clearAppBadge();
        console.log('[Badge] Cleared');
      }
    } catch (err) {
      console.error('[Badge] Failed to update:', err);
    }
  };

  const clearBadge = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Call database function to clear badge
      const { error } = await supabase.rpc('clear_badge_count', {
        p_user_id: user.id
      });

      if (error) {
        console.error('[Badge] Failed to clear in database:', error);
        return;
      }

      // Update local state and native badge
      updateBadge(0);
    } catch (err) {
      console.error('[Badge] Failed to clear:', err);
    }
  };

  const incrementBadge = async (amount = 1) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Increment in database
      const { error } = await supabase.rpc('increment_badge_counts', {
        user_ids: [user.id]
      });

      if (error) {
        console.error('[Badge] Failed to increment:', error);
        return;
      }

      // Update will come through realtime subscription
    } catch (err) {
      console.error('[Badge] Failed to increment:', err);
    }
  };

  return {
    badgeCount,
    isSupported,
    clearBadge,
    incrementBadge,
    setBadge: updateBadge
  };
}

