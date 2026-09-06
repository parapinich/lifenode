# Lifenode Improve: Sandbox dengan Risiko Kematian

Status: diterapkan pada branch `feat-sandbox-mortality`.

## Implementasi

- Satu sandbox dengan penilaian risiko kontekstual sebelum narasi. Tindakan berisiko menampilkan peringatan sebelum dilanjutkan.
- Seed dan akumulasi paparan waktu tersimpan lintas babak. Aktivitas paralel memakai risiko tertinggi pada interval yang sama, bukan menjumlahkan jumlah node.
- Peluang dasar kejadian fatal mendadak memakai hazard gameplay 0,0002 per tahun. Ini parameter permainan, bukan statistik medis.
- Hasil fatal menghentikan usia dan narasi pada waktu kejadian. Aktivitas yang belum selesai ditandai terhenti; aktivitas mendatang dilewati.
- Hasil, riwayat, status, dan jam risiko disimpan bersamaan agar reload tidak mengulang hasil yang sudah diterapkan.
- Konsekuensi nonfatal diteruskan melalui state dan ledger; belum ada model penyakit terpisah.
- Batas durasi 15 tahun dihapus untuk keputusan dan Tunggu. Minimal 0,5 tahun dengan kelipatan 0,5 tetap berlaku; angka harus finite dan dapat dihitung dengan presisi yang tersedia.
- Batas usia kondisi awal 100 dihapus agar babak lanjutan setelah durasi panjang tetap valid.
- Pengujian meliputi engine, API, retry, cabang paralel, Wait, EN/ID, browser desktop/mobile, dan tes narasi Groq untuk tindakan fatal.

## Tujuan

Pertahankan satu mode sandbox yang bebas dan mudah dieksplorasi, tetapi setiap keputusan memiliki konsekuensi yang masuk akal. Karakter dapat meninggal karena tindakan yang sangat berbahaya atau kejadian mendadak yang jarang.

## Risiko Tindakan

- Engine menilai konteks node berdasarkan tindakan, intensitas, durasi, usia, kondisi, skill, resource, dan riwayat karakter.
- Tindakan jelas fatal tidak diberi penyelamatan ajaib atau undian palsu; hasilnya langsung fatal dengan alasan yang relevan.
- Tindakan berisiko memakai undian engine yang dapat direproduksi; AI hanya menarasikan hasil yang sudah diputuskan engine.
- Risiko dihitung berdasarkan rentang waktu dan konteks aktivitas, bukan jumlah node, agar node paralel atau pemecahan aktivitas tidak menggandakan peluang secara artifisial.
- Tampilkan sinyal risiko yang jelas untuk keputusan berbahaya, tetapi jangan membocorkan hasil kejadian mendadak.

## Kematian Mendadak

- Saat node biasa berjalan, engine boleh mengundi kejadian fatal yang tidak berasal langsung dari keputusan pemain: kecelakaan, kondisi medis tersembunyi, bencana lokal, atau kejadian eksternal yang masuk akal.
- Kejadian fatal sangat jarang; kejadian nonfatal lebih sering agar kejutan terasa berarti tanpa membuat permainan frustratif.
- Simpan seed, waktu, dan hasil undian sebelum meminta narasi. Reload atau retry tidak boleh mengubah hasil yang sudah dipilih.
- Jangan memaksakan kematian hanya demi drama. Setiap kematian harus memiliki penyebab yang dapat dijelaskan dari konteks kehidupan.

## Konsekuensi Nonfatal

- Cedera, pemulihan, kehilangan uang/pekerjaan, atau hubungan yang memburuk dapat bertahan ke node berikutnya.
- Konsekuensi harus membuka keputusan lanjutan, bukan sekadar mengurangi angka lalu dilupakan.
- Gunakan state dan ledger yang sudah ada; hindari sistem kesehatan baru yang besar untuk versi awal.

## Alur Saat Mati

- Set `state.hidup = false` dan simpan node penyebab, usia/waktu, kategori, serta ringkasan kejadian.
- Hentikan simulasi pada waktu kejadian; node berikutnya dan cabang paralel yang belum selesai tidak dijalankan.
- Pertahankan hasil parsial, ledger, dan riwayat yang sudah tercatat.
- Tandai node penyebab sebagai fatal pada canvas dan panel konsekuensi.
- Nonaktifkan kelanjutan, keputusan baru, dan rerun untuk kehidupan tersebut; ringkasan tetap dapat dibuat dan pemain dapat memulai kehidupan baru.
- Retry jaringan boleh mengulang request yang gagal, tetapi tidak boleh mengundi ulang risiko yang sudah tersimpan.

## UX dan Bahasa

- Beri penjelasan singkat di awal bahwa sandbox ini bebas, tetapi keputusan berbahaya dapat mengakhiri kehidupan.
- Gunakan indikator risiko pada node berbahaya dan ringkasan kematian yang faktual, bukan layar hukuman.
- Sediakan seluruh label, peringatan, dan narasi UI dalam bahasa Inggris dan Indonesia.
- Mata uang tetap mengikuti formatter bahasa yang sudah ada.

## Kontrak dan Validasi

- Tambahkan metadata risiko pada state run dan hasil segmen: kategori, peluang, node penyebab, waktu kejadian, dan status fatal.
- Validasi delta state, peluang, seed, urutan waktu, dan konsistensi usia di engine sebelum menyimpan hasil.
- Pisahkan keputusan hidup/mati dari teks narasi agar model tidak dapat membatalkan hasil engine.
- Progres lama tanpa metadata risiko tetap kompatibel dan dianggap sandbox dengan aturan baru.

## Pengujian

- Tindakan aman tidak memiliki risiko tambahan dari tindakan, tetapi tetap dapat terkena kejadian mendadak yang jarang; tindakan fatal menghentikan flow secara deterministik.
- Undian berisiko reproducible setelah reload dan retry.
- Kematian mendadak jarang, kontekstual, dan tidak terpicu berulang pada waktu yang sama.
- Node setelah kematian, termasuk aktivitas paralel yang belum selesai, tidak dieksekusi.
- Konsekuensi nonfatal terbawa ke node berikutnya.
- State, ledger, usia kejadian, status node, ringkasan, EN/ID, unit test, typecheck, lint, build, dan uji browser desktop/mobile tetap konsisten.

## Batasan Versi Awal

- Tidak ada revive atau undo kematian dalam kehidupan yang sama.
- Tidak ada mode kedua atau pengaturan tingkat kesulitan; sandbox adalah satu-satunya mode.
- Tabel penyakit dan variasi event yang lebih luas ditambahkan setelah alur kematian dasar stabil.
