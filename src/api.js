import { supabase } from './supabaseClient';

export async function fetchDestinationCodes() {
  const { data, error } = await supabase
    .from('jne_destination_code')
    .select('*');
  if (error) throw error;
  return data;
}
