import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user;
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return created.user;
}

// lowerIsBetter: true per i tempi (millisecondi), false per i punti.
export async function submitScore(game, player, score, lowerIsBetter = false) {
  const user = await ensureSession();
  const { data: existing, error: readError } = await supabase
    .from('scores').select('id, score').eq('game', game).eq('user_id', user.id).maybeSingle();
  if (readError) throw readError;
  if (!existing) {
    const { error } = await supabase.from('scores').insert({ game, player, score });
    if (error) throw error;
    return true;
  }
  const better = lowerIsBetter ? score < existing.score : score > existing.score;
  if (!better) return false;
  const { error } = await supabase.from('scores')
    .update({ score, player, created_at: new Date().toISOString() }).eq('id', existing.id);
  if (error) throw error;
  return true;
}

export async function topScores(game, lowerIsBetter = false, limit = 10) {
  const { data, error } = await supabase.from('scores')
    .select('player, score').eq('game', game)
    .order('score', { ascending: lowerIsBetter }).limit(limit);
  if (error) throw error;
  return data;
}
