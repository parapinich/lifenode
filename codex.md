# Backlog Lifenode

Status: diimplementasikan pada branch `feat-life-flow`. Risiko kematian tetap ditunda.

## Keputusan Implementasi

- Tema default light, dengan toggle light/dark dan preferensi tersimpan di browser.
- Auto-layout menggunakan kolom dependensi dengan cabang yang dipusatkan. Durasi panjang tidak memperlebar canvas. Alur panjang difokuskan pada awal/posisi permainan dengan zoom yang terbaca; fit-view tetap tersedia untuk overview.
- Sisip node mendukung Keputusan, Wait, If, dan Random Event. If menyiapkan dua keputusan dan kondisi awal yang bisa diedit. Penyisipan merapikan posisi dan dapat di-undo sekaligus sebelum simulasi.
- Merge dihapus dari palette serta pembuatan node baru. Jenis legacy masih dikenali agar graf dan progres lama tetap bisa dijalankan tanpa migrasi destruktif.
- Koneksi paralel langsung ke node berikutnya didukung. Koneksi keluar dari If dengan label kondisi yang sama termasuk satu pilihan dan dijalankan paralel.
- Empat contoh bilingual berisi 10-11 node dengan variasi percabangan, aktivitas paralel, Wait, serta Random Event.
- Random Event memiliki peluang 75% dan cooldown dua tahun usia karakter. Undian dan hasil yang sudah diterima disimpan; retry tidak mengundi ulang atau mengganti event yang sudah ditampilkan.
- Respons event memengaruhi uang, energi, reputasi, kebahagiaan, skill, dan relasi secara langsung, lalu tercatat dalam riwayat. Respons hanya diterapkan sekali dan flow yang sudah direncanakan dilanjutkan. Penambahan cabang dinamis tidak diperlukan untuk versi ini.
- Event tidak memajukan usia atau mengubah status hidup. Kegagalan API menyediakan retry dengan undian yang sama atau pilihan lanjut tanpa event.

## Verifikasi Selesai

- 41 tes unit/integrasi lulus, termasuk semua contoh EN/ID dan pilihan If, penyisipan/undo, multi-input, graf legacy, event API, retry, cooldown, dan konsekuensi satu kali.
- Uji browser untuk tema/reload, sisip/batal/undo, event gagal/retry/reload/respons, ekspor, riwayat, kontrol canvas, dan desktop/mobile lulus.
- TypeScript, lint, dan build produksi lulus. Narasi dalam pengujian memakai mock; kualitas hasil model live belum dievaluasi.

Kebutuhan awal di bawah dipertahankan sebagai referensi.

## 1. Dark Mode

- Tambahkan pilihan light/dark dan simpan preferensi pengguna.
- Sesuaikan canvas, node, garis, panel, input, dan dialog agar kontras nyaman di kedua tema.
- Pertahankan tampilan dan fungsi EN/ID.

## 2. Auto-layout Lebih Nyaman

- Tombol rapikan sudah membuat alur teratur, tetapi posisi dan framing belum nyaman dilihat.
- Evaluasi posisi Start/End, keseimbangan cabang paralel, jarak antarnode, dan zoom setelah dirapikan.
- Hindari ruang kosong berlebihan, node bertumpuk, serta garis atau label yang saling menutupi.
- Utamakan keterbacaan: jangan mengecilkan seluruh alur sampai tulisan sulit dibaca.
- Jangan mengubah posisi manual tersimpan kecuali pengguna meminta auto-layout.

## 3. Tambah Node dari Garis

- Klik garis menampilkan pilihan tambah node dan hapus koneksi, bukan hanya hapus.
- Penambahan menyisipkan node pada koneksi terpilih: `A -> B` menjadi `A -> node baru -> B`.
- Pertahankan kondisi cabang If pada koneksi yang keluar dari If.
- Hormati perlindungan riwayat dan larangan mengedit ketika simulasi berjalan.
- Penyisipan beserta perubahan koneksinya menjadi satu operasi undo selama undo masih tersedia.
- Tentukan jenis node yang dapat disisipkan saat perencanaan implementasi; pastikan aturan koneksi tiap jenis tetap valid.

## 4. Hapus Titik Temu (`Merge`)

- Hapus node `Merge/Titik temu` dari palette dan alur pembuatan node baru.
- Jadikan node dengan beberapa koneksi masuk sebagai sinkronisasi otomatis.
- Node lanjutan mulai pada umur tertinggi dari seluruh predecessor, dan hanya dijalankan sekali setelah semua cabang selesai.
- Koneksi langsung ke `End` tetap valid; `End` sendiri menjadi sinkronisasi terakhir.
- Migrasikan atau sederhanakan contoh lama yang memakai `Merge` tanpa merusak graf tersimpan.
- Perbarui validasi, auto-layout, label EN/ID, dan tes agar tidak lagi menganggap `Merge` wajib.
- Jika graf lama memuat `Merge`, pertahankan kemampuan membuka dan menjalankannya atau sediakan migrasi yang aman.

## 5. Contoh Kehidupan Lebih Advanced

- Ganti contoh saat ini yang hanya berisi tiga keputusan paralel dengan contoh yang memiliki lebih banyak node.
- Tunjukkan penggunaan urutan, aktivitas paralel, Wait, dan If melalui skenario yang masuk akal, bukan sekadar menambah jumlah node.
- Tidak semua contoh harus memakai semua jenis node; variasikan struktur dan ceritanya.
- Pertahankan EN/ID dan pergantian contoh tanpa pengulangan langsung.
- Seluruh contoh harus lolos validasi graf dan dapat dijalankan sampai selesai sesuai cabang yang dipilih.
- Tentukan jumlah node dan skenario saat perencanaan implementasi, dengan tetap memperhatikan batas eksekusi yang ada.

## 6. Random Event / Surprise Me

- Tambahkan node `Random Event` sebagai kotak kejutan yang tidak perlu diisi deskripsi oleh pengguna.
- Saat simulasi mencapai node ini, engine menentukan apakah event terjadi dan AI membuat event berdasarkan usia, kondisi, keputusan, serta catatan hidup karakter.
- Event ditampilkan sebagai momen interaktif; pengguna memilih respons sebelum alur dilanjutkan.
- AI menyediakan beberapa respons yang masuk akal, lalu konsekuensi respons memengaruhi waktu, uang, energi, relasi, reputasi, atau cabang berikutnya.
- Event harus tetap mengejutkan tetapi punya hubungan yang dapat dijelaskan dengan konteks karakter; jangan menghasilkan kejadian acak yang tidak relevan.
- Gunakan peluang dan cooldown agar event tidak muncul terus-menerus.
- Simpan seed/hasil event agar retry tidak mengubah kejadian yang sama secara diam-diam.
- Random Event boleh membuat cabang atau node lanjutan secara otomatis, tetapi tetap harus mematuhi validasi graf dan perlindungan riwayat.
- Sediakan status loading, error, dan fallback yang jelas bila pembuatan event gagal.

## Verifikasi Saat Implementasi

- Uji pergantian tema dan persistensinya setelah reload.
- Periksa screenshot desktop/mobile untuk kontras, keterbacaan, framing, dan tidak adanya tumpang tindih.
- Uji penyisipan node pada garis biasa dan cabang If, pembatalan, penghapusan koneksi, undo, serta perlindungan riwayat.
- Uji semua contoh dalam EN/ID, termasuk urutan waktu, cabang, sinkronisasi multi-input, dan kelanjutan babak.
- Uji Random Event: event kontekstual, pilihan respons, cooldown, seed saat retry, perubahan state, serta kegagalan API.
- Jalankan tes, pemeriksaan tipe, lint, dan uji browser yang relevan.

## Batas Pekerjaan

- Risiko kematian tetap ditunda dan tidak termasuk backlog ini.
- Implementasi dijalankan atas permintaan pengguna setelah backlog ini disepakati.
- Ikuti AGENTS.md dan pola kode yang sudah ada saat pengerjaan dimulai.
