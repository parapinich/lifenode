# Testing Issue: Error Tidak Boleh Generic

Status: diterapkan sebagian pada branch `error-observability`. Pesan per-stage, status upstream, dan cooldown rate limit sudah jalan. Belum dikerjakan: `requestId`, log server terstruktur, dan field `retryable` eksplisit pada response.

## Masalah

Saat proses testing gagal, UI hanya menampilkan:

> Terjadi kesalahan. Progres tetap tersimpan; coba lagi.

Pesan ini tidak memberi tahu apakah masalah berasal dari koneksi AI, schema response, graph, random event, penilaian risiko, atau narasi. Log server juga hanya menunjukkan status HTTP seperti `POST /api/simulate 502` tanpa konteks tahap prosesnya.

## Tujuan

Tampilkan error yang cukup spesifik agar developer dapat langsung mengetahui lokasi dan jenis masalah selama testing, tanpa membocorkan API key atau data rahasia.

## Pesan Error yang Wajib Dibedakan

- `Graph validation failed`: graph tidak valid, node tidak terhubung, branch buntu, atau durasi tidak valid.
- `Risk assessment failed`: AI gagal menilai risiko atau response risiko tidak sesuai schema.
- `Simulation narration failed`: penilaian risiko berhasil, tetapi narasi segmen gagal atau response narasi tidak sesuai schema.
- `Random event generation failed`: request ke `/api/event` gagal atau response event tidak valid.
- `Random event response failed`: pilihan event tidak dapat diterapkan ke state.
- `Branch decision failed`: AI gagal memilih edge yang tersedia atau response branch tidak valid.
- `Summary generation failed`: pembuatan ringkasan akhir gagal.
- `Network error`: server/API tidak dapat dihubungi.

Pesan harus tersedia dalam bahasa Inggris dan Indonesia. Bahasa error mengikuti bahasa aktif saat request dibuat.

## Perubahan API dan Log

- Tambahkan `stage` atau `code` stabil pada response error, bukan hanya teks bebas.
- Gunakan kode yang sama di client, route handler, dan log server.
- Log server mencatat stage, route, status upstream, durasi request, dan ringkasan error validasi.
- Jangan log API key, authorization header, prompt lengkap, isi ledger sensitif, atau seluruh state pengguna.
- Sertakan `requestId` pendek pada log dan pesan UI agar satu kegagalan mudah dicari.
- Bedakan error yang bisa dicoba ulang (`network`, rate limit, upstream 5xx) dari error yang membutuhkan perbaikan graph atau schema.
- Pertahankan progres yang sudah tersimpan dan jangan mengubah seed atau hasil risiko hanya karena request diulang.

## Perilaku UI Saat Testing

- Panel hasil menampilkan nama stage, kode error, request ID, dan detail aman yang singkat.
- Tombol retry hanya muncul untuk error yang memang retryable.
- Error validasi graph menampilkan node atau field yang bermasalah.
- Error schema menampilkan field yang hilang atau format yang salah, bukan response mentah yang panjang.
- Error upstream menampilkan status seperti `Groq 429` atau `Groq 502` jika aman, tanpa kredensial.
- Console development boleh menampilkan stack trace dan detail Zod; production tetap memakai detail yang disanitasi.
- Setelah error, node yang sedang loading kembali ke status sebelumnya dan tombol lanjut tetap konsisten.

## Acceptance Test

- Matikan koneksi AI saat `/api/event`, `/api/simulate` risk assessment, `/api/simulate` narration, `/api/branch`, dan `/api/summary`; setiap tahap menghasilkan pesan berbeda.
- Kirim JSON AI yang tidak sesuai schema untuk setiap route; UI menunjukkan field yang invalid.
- Kirim graph tidak valid; error menyebut node atau koneksi penyebabnya.
- Uji status 400, 429, 502, timeout, dan response non-JSON.
- Pastikan retry request yang gagal tidak mengulang pilihan event atau undian risiko.
- Pastikan EN/ID menerjemahkan pesan stage dan detail utama.
- Pastikan API key, authorization header, prompt lengkap, dan state sensitif tidak muncul di UI maupun log.
- Jalankan unit test, typecheck, lint, build, serta uji browser desktop dan mobile.

## Batasan

- Fokus pertama adalah observability untuk testing; jangan menambah sistem logging eksternal atau dashboard baru.
- Gunakan helper error yang sudah ada dan response JSON standar sebelum memperkenalkan abstraksi baru.
- Pesan user-facing tetap singkat; detail teknis lengkap cukup tersedia di console development dan log server yang disanitasi.
