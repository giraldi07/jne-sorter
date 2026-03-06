
import { supabase } from './supabaseClient';

/**
 * Mencari kode tujuan JNE berdasarkan searchTerm.
 * Fungsi ini melakukan pencarian di sisi server (database) sehingga jauh lebih efisien
 * daripada mengambil seluruh data ke frontend terlebih dahulu.
 * @param {string} searchTerm - Kata kunci pencarian, bisa berupa nama kota atau kode.
 */
export async function searchDestinations(searchTerm) {
  // 1. Bersihkan dan pecah search term menjadi beberapa kata kunci (keywords)
  const keywords = searchTerm.toLowerCase().split(/[\s,]+/).filter(k => k.length > 1);
  
  if (keywords.length === 0) {
    return [];
  }

  // 2. Buat query builder Supabase
  let query = supabase
    .from('jne_destination_code')
    .select('id, code, name, sortCode'); // Hanya pilih kolom yang dibutuhkan

  // 3. Tambahkan filter untuk setiap keyword.
  // Logika ini akan mencari record di mana:
  // (nama mengandung keyword1 ATAU kode mengandung keyword1)
  // DAN
  // (nama mengandung keyword2 ATAU kode mengandung keyword2)
  // ... dan seterusnya untuk semua keyword.
  // Ini mereplikasi logika "smart search" dari App.jsx dengan cara yang jauh lebih efisien.
  keywords.forEach(key => {
    // Untuk setiap keyword, kita buat grup OR antara kolom 'name' dan 'code'
    const orFilter = `name.ilike.%${key}%,code.ilike.%${key}%`;
    query = query.or(orFilter);
  });

  // 4. Jalankan query dengan batas hasil
  const { data, error } = await query.limit(15);

  if (error) {
    console.error('Error searching destinations:', error);
    throw error;
  }

  return data;
}
