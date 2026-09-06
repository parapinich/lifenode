import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'id'

export function formatMoney(value: number, language: Language): string {
  return `${value < 0 ? '-' : ''}${language === 'id' ? 'Rp' : '$'}${Math.abs(value).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}`
}
export const useLocaleStore = create<{ language: Language; setLanguage: (language: Language) => void }>()(
  persist((set) => ({ language: 'en', setLanguage: (language) => set({ language }) }), { name: 'lifenode-language' })
)

const ID: Record<string, string> = {
  'Dark mode': 'Mode gelap', 'Light mode': 'Mode terang',
  'Insert node': 'Sisipkan node', 'Cancel': 'Batal', 'Decision': 'Keputusan',
  'Node type': 'Jenis node', 'Random Event': 'Kejadian Acak', 'Surprise me': 'Beri kejutan',
  'Choose a response': 'Pilih respons', 'Reveal event': 'Buka kejutan',
  'No unexpected event this time.': 'Tidak ada kejadian tak terduga kali ini.',
  'Event unavailable. Retry or continue without it.': 'Kejadian belum bisa dimuat. Coba lagi atau lanjut tanpa kejadian.',
  'Continue without event': 'Lanjut tanpa kejadian', 'Response recorded': 'Respons tercatat',
  'Department of possible futures': 'Departemen kemungkinan masa depan',
  'Case history': 'Riwayat hidup', 'Case History': 'Riwayat hidup',
  'Starting conditions': 'Kondisi awal', '01 / The subject': '01 / Pemeran utama',
  'Initial conditions': 'Kondisi awal', 'Age': 'Usia', 'age': 'usia',
  'Age at intake': 'Usia awal', 'Starting funds / $': 'Uang awal / Rp',
  'Background note': 'Latar belakang', 'An ordinary person. For now.': 'Orang biasa. Untuk sementara.',
  'Randomize background note': 'Acak latar belakang', 'Life plan': 'Rencana hidup',
  '02 / The plan': '02 / Rencana', 'A life, pending.': 'Hidup belum selesai.',
  'Decision catalog': 'Katalog keputusan', 'Undo': 'Urungkan', 'Redo': 'Ulangi',
  'Undo (Ctrl+Z)': 'Urungkan (Ctrl+Z)', 'Redo (Ctrl+Shift+Z)': 'Ulangi (Ctrl+Shift+Z)',
  'Tidy up node positions': 'Rapikan posisi keputusan', 'Case file': 'Catatan hidup',
  'Execute life plan': 'Jalankan rencana hidup', 'Resolve the outstanding issues': 'Perbaiki rencana terlebih dahulu',
  'Unfolding...': 'Berlangsung...', 'Run this life': 'Jalankan hidup',
  'Run chapter': 'Jalankan babak', 'Continue chapter': 'Lanjutkan babak', 'Try again': 'Coba lagi',
  'Age must be between 0 and 100. Check the starting conditions.': 'Usia harus antara 0 dan 100. Periksa kondisi awal.',
  'issues to resolve': 'hal perlu diperbaiki', 'No decisions on record': 'Belum ada keputusan',
  'Your future has no alibi.': 'Masa depanmu belum punya alibi.',
  'Open an example case': 'Buka contoh kehidupan', 'Consequences in progress': 'Konsekuensi sedang berlangsung',
  'Case interrupted': 'Babak terhenti', 'Outcome on record': 'Hasil tercatat', 'Draft / not yet lived': 'Rencana / belum dijalani',
  'decisions': 'keputusan', 'connections': 'hubungan', '03 / The consequences': '03 / Konsekuensi',
  'Close case file': 'Tutup catatan hidup', 'Resources remaining': 'Kondisi sekarang', 'Resources on arrival': 'Modal awal',
  'Deceased': 'Meninggal', 'Energy': 'Energi', 'Reputation': 'Reputasi', 'Happiness': 'Kebahagiaan',
  'Record of events': 'Catatan kejadian', 'Reality is deliberating.': 'Semesta sedang berpikir.',
  'Nothing has happened. Yet.': 'Belum terjadi apa-apa.', 'The first consequences are pending.': 'Konsekuensi pertama segera tiba.',
  'All plans look reasonable before the consequences arrive.': 'Semua rencana terdengar masuk akal sebelum konsekuensinya datang.',
  'Recording consequences...': 'Mencatat konsekuensi...', 'Filing...': 'Merangkum...', 'Close the case': 'Rangkum hidup ini',
  'Material evidence': 'Bahan cerita', 'Decisions': 'Keputusan', 'Close decision catalog': 'Tutup katalog keputusan',
  'Time & contingencies': 'Waktu & kemungkinan', 'Wait': 'Tunggu', 'If': 'Jika', 'Merge': 'Titik temu', 'Sync': 'Titik temu',
  'Career': 'Karier', 'Relationships': 'Hubungan', 'Health': 'Kesehatan', 'Chaos': 'Eksperimen',
  'Take an office job': 'Kerja kantoran', 'Quit on a whim': 'Resign spontan', 'Start a business': 'Buka usaha',
  'Start dating': 'Mulai pacaran', 'Get married': 'Menikah', 'Break up': 'Putus hubungan',
  'Work out regularly': 'Rutin olahraga', 'Pull all-nighters': 'Sering begadang', 'Get a checkup': 'Periksa kesehatan',
  'Join an MLM': 'Ikut MLM', 'Gamble on crypto': 'Spekulasi kripto', 'Adopt 10 cats': 'Adopsi 10 kucing',
  'Add': 'Tambah', 'Delete step': 'Hapus keputusan', 'Decision name': 'Nama keputusan',
  'Name this decision...': 'Tulis keputusanmu...', 'Decision category': 'Kategori keputusan',
  'Decision description': 'Catatan keputusan', 'Description (optional)...': 'Catatan tambahan...',
  'Intensity': 'Kesungguhan', 'Decision intensity': 'Kesungguhan keputusan', 'Duration': 'Durasi',
  'Years': 'Tahun', 'yrs': 'thn', 'Years to wait': 'Lama menunggu (tahun)', 'Decision duration': 'Durasi keputusan (tahun)',
  'Delete wait': 'Hapus waktu tunggu', 'Delete if': 'Hapus percabangan', 'Branch condition': 'Kondisi cabang',
  'condition for this branch...': 'syarat cabang ini...', 'No branches yet': 'Belum ada cabang',
  'This step failed': 'Keputusan ini tidak berhasil', 'This branch was not taken': 'Cabang ini tidak dijalani',
  'Intake': 'Awal hidup', 'Case Closed': 'Akhir babak', 'Delete connection': 'Hapus hubungan', 'unlabeled': 'tanpa syarat',
  'Pass': 'Berhasil', 'Partial': 'Sebagian', 'Failed': 'Gagal', 'Chapter': 'Babak',
  'Close': 'Tutup', 'Delete from history': 'Hapus dari riwayat', 'No closed cases yet.': 'Belum ada riwayat hidup.',
  'Life verdict': 'Ringkasan hidup', 'Funds': 'Uang', 'EXHIBIT': 'BUKTI', 'Save PNG': 'Simpan PNG', 'Share': 'Bagikan',
  'Your decision': 'Keputusanmu', 'What happens next?': 'Apa yang kamu lakukan selanjutnya?',
  'Write your own decision...': 'Tulis keputusan bebas...', 'After this': 'Setelah ini', 'Meanwhile': 'Sementara itu',
  'New chapter': 'Babak baru', 'New life': 'Hidup baru', 'Chapter complete': 'Babak selesai',
  'Life continues': 'Hidup berlanjut', 'Choose your next move': 'Tentukan langkah berikutnya',
  'Your past is on record.': 'Masa lalumu sudah tercatat.', 'Language': 'Bahasa',
  'Restart this life? The current progress will be cleared.': 'Mulai ulang hidup ini? Progres saat ini akan dihapus.',
  'Open another life? The current progress will be cleared.': 'Buka kehidupan lain? Progres saat ini akan dihapus.',
  'Past decisions cannot be changed.': 'Keputusan yang sudah dijalani tidak bisa diubah.',
  'Something went wrong. Your progress is saved; try again.': 'Terjadi kesalahan. Progres tetap tersimpan; coba lagi.',
}

export function translate(language: Language, text: string): string { return language === 'id' ? ID[text] ?? text : text }
const TRANSLATORS = { en: (text: string) => text, id: (text: string) => translate('id', text) }
export function useT() { return TRANSLATORS[useLocaleStore((s) => s.language)] }
