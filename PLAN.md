# PLAN.md — Roadmap Lifeflow

Urutan pengerjaan. Kerjain satu milestone sampai kelar dan bisa dites sebelum lanjut. Jangan lompat ke M3 karena kelihatan lebih seru.

Baca `CLAUDE.md` dulu buat spesifikasi lengkapnya.

---

## M0 — Fondasi

Tujuan: schema dan mesin graf jadi, sebelum ada UI apa pun.

- [x] Scaffold Next.js App Router + TypeScript + Tailwind
- [x] `lib/schema.ts` lengkap: `Lane`, `NodeKind`, `LifeNode`, `Edge`, `LifeState`, plus Zod schema buat request dan response LLM
- [x] `lib/graph.ts`: topological sort, deteksi siklus, hitung `umurMulai` dan `umurSelesai` per node, hitung `gapTahun` di tiap Merge, pecah graf jadi segmen
- [x] `lib/graph.ts`: fungsi validasi yang balikin daftar `{ nodeId, pesan }`
- [x] `lib/engine.ts`: `hitungKepadatan(segmen)`, `applyDelta(state, stateBaru)`, `appendLedger(state, kejadian)`
- [x] Unit test buat semua di atas, pakai graf contoh yang ditulis manual sebagai fixture

Selesai kalau: kamu bisa nulis graf sebagai objek JSON di file test, panggil satu fungsi, dan dapat daftar segmen dengan umur yang benar. Tanpa buka browser sama sekali.

**Ini milestone paling penting.** Mesin graf yang salah bakal ngerusak semua yang di atasnya, dan bug-nya susah kelihatan dari UI.

---

## M1 — Canvas

Tujuan: pemain bisa nyusun graf. Belum ada simulasi.

- [x] Setup React Flow, canvas bebas, pan dan zoom
- [x] Empat custom node: Start, Aksi, Merge, End. Warna Aksi ngikut lane.
- [x] Node Aksi bisa diedit inline: label, lane, durasi, slider intensity
- [x] Tarik kabel antar node. Satu node boleh punya banyak kabel keluar.
- [x] `NodePalette.tsx`: drag node baru ke canvas, ada preset per lane
- [x] Tampilkan umur di tiap node, dihitung live dari `lib/graph.ts`
- [x] Validasi live: node bermasalah dikasih border merah plus tooltip pesan errornya
- [x] Tombol Execute disabled selama graf belum valid
- [x] Simpan graf ke local storage, auto-load pas buka lagi

Selesai kalau: kamu bisa bikin graf bercabang tiga, lihat umurnya keupdate pas ngubah durasi, dan tahu persis node mana yang nggantung.

---

## M2 — Simulasi palsu

Tujuan: seluruh alur execute jalan tanpa nyentuh API sama sekali.

- [x] `POST /api/simulate` yang balikin response dummy sesuai schema, dengan delay buatan 800ms
- [x] Server hitung ulang segmen dari graf mentah, nggak percaya perhitungan client
- [x] Tombol Execute, jalan segmen per segmen
- [x] `SegmentResult.tsx`: narasi segmen, hasil per node, narasi gap
- [x] Visual state node: idle, loading, sukses, separuh, gagal. Yang gagal border merah.
- [x] Panel state yang keupdate tiap segmen
- [x] Hard limit 6 call, dihitung di server

Selesai kalau: satu run penuh jalan mulus dan animasinya enak dilihat. Kalau di tahap ini kerasa membosankan, masalahnya di UX, bukan di LLM. Beresin sekarang.

---

## M3 — LLM beneran

Tujuan: ganti dummy dengan model. Nggak ada perubahan UI.

- [x] `lib/prompts.ts`: system prompt lengkap dengan tujuh aturan tone dari `CLAUDE.md` bagian 8
- [x] Builder prompt per segmen, sisipin state, cabang, `gapTahun`, dan kepadatan
- [x] Input pemain dibungkus delimiter dan ditandai sebagai data, bukan instruksi
- [x] Parse plus validasi Zod, retry sekali kalau gagal
- [x] Error boundary per segmen, satu segmen gagal nggak ngerusak run
- [x] Test manual: tiga run dengan graf yang sama persis, cek hasilnya beda tapi tetap konsisten sama state — 3x jalan, narasi beda-beda, status/kepadatan konsisten. Catatan: varians `uang` antar-run agak lebar (3.5jt/4.5jt/45jt), kandidat buat di-tighten pas iterasi prompt
- [x] Test manual: graf dengan cabang timpang berat, cek `narasiGap` beneran nyakitin — gapTahun 6 tahun kerasa sakit di ketiga run, dan segmen kosong (merge→end) sesudahnya tetap nyambung ke ledger segmen sebelumnya

Selesai kalau: run yang sama tiga kali kasih cerita beda, tapi nggak pernah ada yang kontradiktif dengan state. Kalau di segmen 4 uangnya tiba-tiba naik tanpa alasan, kontrak state-nya bocor. Balik ke `CLAUDE.md` bagian 6.

**Ini milestone paling makan waktu.** Sebagian besar kerjaan di sini nulis ulang prompt, bukan nulis kode. Siapin sepuluh sampai lima belas iterasi sebelum tone-nya pas.

---

## M4 — Ringkasan

Tujuan: bagian yang bikin orang mau share.

- [x] `POST /api/summary`, satu call terakhir — dites langsung ke Gemini, output sesuai schema
- [x] `LifeCard.tsx`: judul hidup, epitaf, stat akhir, tiga momen penentu, label per lane
- [x] Export kartu jadi PNG (`html-to-image`)
- [x] Tombol share (Web Share API kalau didukung browser, fallback copy teks ke clipboard) — **"copy link" nggak dibikin**: nggak ada persistensi/backend buat hasil run (sesuai §12 "simpan ke database" out of scope), jadi nggak ada link beneran buat di-copy. Kalau butuh nanti, itu berarti nambah storage server dulu.

Selesai kalau: kamu ngirim satu kartu hasil ke teman dan mereka nanya cara mainnya.

**Di luar checklist M4 aslinya, sekalian dikerjain di sesi yang sama (atas permintaan user):**
- Visual redesign penuh: token warna/tipografi "case file" (Fraunces + Geist Sans/Mono, palet manila/ink/stamp), semua node/panel di-restyle, motif stempel status (`Stamp.tsx`) sebagai signature element. Ini bukan bagian M5, dikerjain lebih awal karena diminta bareng M4.
- Seluruh UI + narasi LLM diubah ke Bahasa Inggris. Field/enum internal di `lib/schema.ts` (`narasiSegmen`, `sukses`/`separuh`/`gagal`, dst) sengaja **tetap Bahasa Indonesia** — itu cuma nama variabel internal, nggak pernah keliatan pemain.

---

## M5 — Polish

- [ ] Rate limit per IP
- [ ] Template graf buat pemain baru, canvas kosong itu bikin bingung
- [ ] Auto-layout button, rapihin posisi node otomatis
- [ ] Riwayat run, simpan hasil lama di local storage
- [ ] Undo/redo canvas
- [ ] Layout tablet. Mobile terakhir, kalau perlu.

---

## Urutan risiko

Bagian yang paling gampang gagal, dari yang paling berisiko:

1. **Mesin graf.** Hitungan umur di percabangan dan Merge itu tempat bug-nya ngumpet. Makanya M0 dites tanpa UI. Kalau segmen kebentuk salah, LLM dapat konteks salah, dan kamu bakal nyalahin prompt padahal masalahnya di topological sort.
2. **Tone LLM.** Absurd yang nggak nyambung itu ngebosenin dalam dua segmen. Aturan ledger dan eskalasi adalah rem utamanya. Kalau hasilnya kerasa random, benerin aturan itu sebelum nambah fitur.
3. **Konsistensi state.** Kalau LLM mulai ngarang angka, cek apakah state benar-benar dikirim utuh tiap segmen.
4. **Canvas UX.** Pemain harus ngerti konsep Merge tanpa dijelasin panjang. Validasi live plus pesan error yang spesifik itu bukan polish, itu inti pengajarannya.
5. **Biaya.** Enam call per run. Pantau dari M3, jangan nunggu tagihan.

---

## Keputusan yang belum diambil

Tanya sebelum ngerjain, jangan diputusin sendiri:

- Nama final game
- Apakah Merge boleh nge-loop balik ke node sebelumnya. Sekarang dilarang, tapi "ngulang kuliah" itu ide yang menarik.
- Apakah `chaos` dibatasi maksimal satu node per segmen
- Setting: bebas atau ada konteks tempat yang tetap
- Apakah pemain boleh nambah node pas run lagi jalan
