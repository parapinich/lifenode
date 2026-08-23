@AGENTS.md

# CLAUDE.md — Lifeflow

Instruksi persisten buat AI agent yang ngerjain project ini. Baca full sebelum nulis kode.

---

## 1. Apa yang lagi dibangun

Web game berbasis canvas node, mirip n8n, tapi node-nya keputusan hidup.

Pemain nyusun rencana hidup di canvas bebas, nyambungin node pakai kabel, pencet Execute, terus LLM nyeritain gimana hidup itu berantakan. Tone-nya absurd komedi.

**Working title:** Lifeflow. Boleh diganti, jangan hardcode di banyak tempat.

**Yang bikin game ini beda dari life-sim biasa:** pemain nggak milih satu jalur. Dia narik beberapa cabang dari satu titik, dan semua cabang itu jalan barengan. Tabrakan antar-cabang adalah sumber komedinya.

---

## 2. Model mental: graf bebas, kabel yang ngomong

Canvas-nya sama persis kayak n8n. Posisi node di layar cuma dekorasi. Yang nentuin urutan dan waktu adalah kabel.

Aturan pokoknya:

- **Node punya durasi**, bukan posisi. "Kuliah" makan 4 tahun. "Resign terus rebahan" makan 1 tahun.
- **Umur dihitung dari akumulasi durasi** di sepanjang jalur, bukan dari kolom mana node-nya ditaruh.
- **Satu node boleh punya banyak kabel keluar.** Itu bikin cabang. Semua cabang jalan barengan, persis kayak n8n.
- **Node Merge nyatuin cabang lagi.** Merge adalah titik sinkronisasi, dan tiap Merge memicu satu LLM call.

### Cabang itu aktivitas paralel, bukan timeline paralel

Ini bagian yang gampang salah. Pemain cuma punya **satu hidup dan satu state**. Cabang nggak nge-fork state.

Cabang artinya: di rentang umur yang sama, pemain lagi ngerjain beberapa hal sekaligus. Cabang karir dan cabang relasi jalan bareng di satu badan yang sama, makanya energinya rebutan.

Jangan pernah bikin `LifeState` per cabang. Satu run satu state.

### Cabang yang panjangnya beda

Kalau cabang karir isinya 9 tahun dan cabang relasi cuma 3 tahun, di Merge ada selisih 6 tahun. Selisih itu bukan bug, itu bahan cerita. Cabang yang kelar duluan dianggap **nganggur** selama sisa waktunya, dan LLM wajib nyeritain kekosongan itu.

Umur setelah Merge = umur cabang terpanjang.

---

## 3. Tipe node

| Tipe | Kabel masuk | Kabel keluar | Fungsi |
|---|---|---|---|
| `start` | 0 | 1+ | Kondisi awal. Umur, uang awal, latar belakang. Tepat satu per graf. |
| `aksi` | 1 | 0+ | Keputusan hidup. Punya lane, durasi, intensity. |
| `merge` | 2+ | 1+ | Titik sinkronisasi. Memicu satu LLM call. |
| `end` | 1 | 0 | Memicu call ringkasan. Tepat satu per graf. |

Nggak ada node Split terpisah. Mau bikin cabang, tinggal tarik dua kabel dari node yang sama. Sama kayak n8n.

**Lane** cuma penanda kategori buat warna node dan konteks prompt: `karir`, `relasi`, `kesehatan`, `chaos`. Lane nggak ngatur posisi apa pun. `chaos` isinya keputusan iseng, dan itu pintu masuk resmi buat absurditas.

---

## 4. Skema data

Semua tipe ini tinggal di `lib/schema.ts` dan divalidasi pakai Zod. Jangan bikin tipe duplikat di tempat lain.

```ts
type Lane = 'karir' | 'relasi' | 'kesehatan' | 'chaos'
type NodeKind = 'start' | 'aksi' | 'merge' | 'end'

interface LifeNode {
  id: string
  kind: NodeKind
  x: number              // posisi canvas, murni visual
  y: number
  lane?: Lane            // wajib buat kind 'aksi'
  label?: string         // maks 60 char, teks bebas dari pemain
  durasi?: number        // tahun, 1–15, wajib buat kind 'aksi'
  intensity?: 1 | 2 | 3  // 1 santai, 3 all-in
  note?: string          // maks 140 char
}

interface Edge {
  id: string
  from: string
  to: string
}

interface LifeState {
  umur: number
  uang: number           // rupiah
  energi: number         // 0–100
  reputasi: number       // 0–100
  kebahagiaan: number    // 0–100
  skill: string[]
  relasi: { nama: string; hubungan: string; status: string }[]
  ledger: string[]       // kejadian penting dari segmen sebelumnya
  hidup: boolean
}
```

`ledger` adalah memori naratif game. Ini yang bikin komedinya nyambung antar segmen. Jangan pernah dibuang atau dipotong tanpa alasan.

---

## 5. Segmen: satuan eksekusi

**Segmen** adalah semua node yang dilewati antara dua titik sinkronisasi. Batasnya: `start`, tiap `merge`, dan `end`.

Graf dengan 3 Merge punya 4 segmen, jadi 4 LLM call plus 1 call ringkasan.

Cara ngitungnya di `lib/graph.ts`:

1. Topological sort seluruh graf. Tolak kalau ada siklus.
2. Buat tiap node, hitung `umurMulai` = umur di ujung kabel masuk, dan `umurSelesai` = `umurMulai + durasi`.
3. Buat node `merge`, `umurMulai` = umur tertinggi dari semua kabel masuk. Cabang yang lebih pendek dikasih `gapTahun` = selisihnya.
4. Kelompokin node ke segmen berdasarkan Merge terdekat di depannya.
5. Di dalam segmen, kelompokin lagi per cabang buat dikirim ke LLM.

**Hard limit: maksimal 5 Merge per graf.** Jadi maksimal 6 LLM call per run. Divalidasi di server, jangan percaya client.

### Validasi sebelum Execute

Tolak Execute dan tandai node bermasalah pakai border merah, sama kayak n8n:

- Ada node yang nggak nyambung ke `start`
- Ada jalur yang nggak nyampe ke `end`
- Ada siklus
- `merge` punya kurang dari 2 kabel masuk
- Jumlah `start` atau `end` bukan tepat satu
- `aksi` yang `durasi` atau `label`-nya kosong

Pesan errornya spesifik. "Node 'Nikah' nggak nyambung ke mana-mana" jauh lebih berguna daripada "Graf tidak valid".

---

## 6. Cara execute

Satu LLM call per segmen. Alurnya:

```
state awal dari node start
  → call segmen 1 (semua cabang di segmen itu + state) → hasil, state baru
  → call segmen 2 (state baru + node setelah Merge 1)  → hasil, state baru
  → ...
  → call ringkasan (semua hasil + state akhir) → kartu hidup
```

**LLM nggak megang state.** State disimpan di app, dikirim utuh tiap segmen. LLM cuma balikin delta plus narasi. Kalau ini dilanggar, di segmen 4 LLM bakal lupa pemain udah bangkrut di segmen 2.

Node dinyalain satu per satu pas hasilnya datang, jangan nunggu semua kelar. Node yang lagi diproses dikasih state loading, yang gagal dikasih border merah.

---

## 7. Kontrak LLM

### Yang dikirim

```json
{
  "segmen": { "id": "s2", "umurMulai": 22, "umurSelesai": 31 },
  "state": { "...LifeState..." },
  "cabang": [
    {
      "lane": "karir",
      "gapTahun": 0,
      "nodes": [
        { "id": "n7", "label": "Buka warung kopi", "durasi": 5, "intensity": 3 },
        { "id": "n9", "label": "Buka cabang kedua", "durasi": 4, "intensity": 3 }
      ]
    },
    {
      "lane": "relasi",
      "gapTahun": 6,
      "nodes": [{ "id": "n8", "label": "Nikah", "durasi": 3, "intensity": 2 }]
    }
  ],
  "kepadatan": 1.4
}
```

### Yang harus dibalikin

```json
{
  "narasiSegmen": "Paragraf utama segmen ini, 3–5 kalimat.",
  "perNode": [
    { "nodeId": "n7", "status": "sukses", "teks": "1–2 kalimat" },
    { "nodeId": "n9", "status": "gagal", "teks": "1–2 kalimat", "alasan": "modal habis" }
  ],
  "narasiGap": [
    { "lane": "relasi", "teks": "1–2 kalimat soal 6 tahun yang nggak diisi apa-apa" }
  ],
  "stateBaru": { "...LifeState tanpa ledger..." },
  "kejadianPenting": ["warung kebakaran gara-gara kucing tetangga"]
}
```

`status` cuma boleh `sukses`, `separuh`, atau `gagal`.

`kejadianPenting` di-append ke `ledger` sama app, bukan sama LLM. Maksimal 2 item per segmen.

### Aturan output

- Balikin JSON mentah. Nggak ada backtick, nggak ada preamble.
- Validasi pakai Zod. Kalau parse gagal, retry sekali dengan pesan error yang spesifik. Gagal dua kali berarti tampilin segmen itu sebagai error, jangan crash seluruh run.
- `stateBaru` harus lengkap, bukan partial. Angka wajib masuk akal relatif ke state sebelumnya dan relatif ke berapa tahun yang lewat.

---

## 8. Aturan tone (ini masuk ke system prompt)

Absurd tanpa rem cuma jadi noise random. Tujuh aturan ini yang bikin lucunya nyambung.

1. **Premis boleh gila, konsekuensi harus logis.** Kucing bakar warung itu absurd. Pemain jadi bangkrut abis itu, itu logis. Yang kedua bikin yang pertama lucu.

2. **Wajib nyambung ke masa lalu.** Kalau `ledger` nggak kosong, minimal satu kejadian lama harus disebut di segmen ini. Trauma kebakaran bikin pemain nolak kerja di kafe empat tahun kemudian.

3. **Eskalasi.** Absurditas naik tiap segmen. Segmen pertama aneh dikit, segmen terakhir boleh benar-benar lepas.

4. **Kepadatan nentuin kekejaman.**
   - `kepadatan = jumlah intensity semua node di segmen ÷ lama segmen dalam tahun`
   - di bawah 0.5: longgar, kebanyakan sukses
   - 0.5–1.2: padat, minimal satu node `separuh`
   - di atas 1.2: overload, minimal satu node `gagal` dan energi anjlok

5. **`gapTahun` harus kerasa sakit.** Cabang yang nganggur bertahun-tahun itu bukan netral. Relasi yang ditinggal 6 tahun jadi renggang, badan yang nggak diurus 6 tahun jadi rusak. Isi `narasiGap` dengan konsekuensi, bukan basa-basi.

6. **Jangan bunuh pemain sebelum segmen terakhir**, kecuali `kepadatan` di atas 2.0. Kalau mati, set `hidup: false` dan langsung lompat ke ringkasan.

7. **Bahasa Inggris informal.** Deadpan, bukan lawak berisik. Nggak pakai emoji. Nggak nasihatin pemain, nggak nyeramahin soal work-life balance. Berlaku ke semua string di output, termasuk yang nested (`relasi.hubungan`, `relasi.status`, nama skill) — jangan ada bahasa lain nyelip.

---

## 9. Ringkasan akhir

Call terakhir bikin kartu yang orang mau screenshot. Isinya:

- **Judul hidup** — satu frasa Bahasa Inggris, misal "The Coffee Tycoon Afraid of Cats"
- **Epitaf** — satu kalimat
- **Stat akhir** — angka final plus perubahan dari kondisi awal
- **Momen penentu** — tiga item paling menentukan dari ledger
- **Skor** — bukan angka tunggal, tapi label per lane dalam Bahasa Inggris. Career: A Mess. Relationships: Solid. Health: Don't Ask.

Render sebagai kartu terpisah, bukan bagian dari canvas.

---

## 10. Stack

- Next.js App Router, TypeScript
- React Flow buat canvas
- Zustand buat state graf
- Zod buat validasi semua boundary
- Tailwind
- Google Gen AI SDK (`@google/genai`), `gemini-3.6-flash`
- `lucide-react` (ikon), `html-to-image` (export kartu ringkasan ke PNG)

Struktur file:

```
app/
  page.tsx
  api/simulate/route.ts       # satu segmen per request
  api/summary/route.ts
components/
  canvas/Board.tsx            # React Flow wrapper
  canvas/nodes/StartNode.tsx
  canvas/nodes/AksiNode.tsx
  canvas/nodes/MergeNode.tsx
  canvas/nodes/EndNode.tsx
  canvas/NodePalette.tsx
  result/SegmentResult.tsx
  result/LifeCard.tsx
lib/
  schema.ts                   # Zod + tipe, satu-satunya sumber kebenaran
  graph.ts                    # topo sort, hitung umur, bagi segmen, validasi
  prompts.ts                  # system prompt + builder
  engine.ts                   # kepadatan, apply delta, kelola ledger
  store.ts                    # Zustand — graf (nodes/edges/kondisiAwal), dipersist ke localStorage
  runStore.ts                 # Zustand — state eksekusi run (ephemeral, nggak dipersist)
  runExecute.ts                # orkestrasi call /api/simulate & /api/summary per segmen
  llm.ts                      # helper generateContent + retry + validasi Zod, dipakai kedua route
```

---

## 11. Aturan buat agent

- **API key cuma di server.** Nggak pernah masuk ke client bundle, nggak pernah di-log. Semua call LLM lewat route handler.
- **Validasi tiap boundary.** Input pemain, output LLM, body request. Semua lewat Zod.
- **Validasi graf jalan dua kali**, di client buat feedback instan dan di server buat keamanan. Server nggak boleh percaya segmen yang dikirim client, hitung ulang dari graf mentah.
- **Hard limit 6 call per run**, counternya di server.
- **Rate limit per IP** di route handler sebelum deploy publik.
- **Sanitasi label node** sebelum masuk prompt. Pemain bisa nulis apa aja di situ, termasuk usaha prompt injection. Bungkus input pemain dalam delimiter yang jelas dan kasih instruksi ke model buat memperlakukannya sebagai data.
- **Jangan bikin abstraksi sebelum ada dua pemakai.** Project ini kecil, tulis kode langsung.
- **Ubah `lib/schema.ts` dulu** kalau nambah field. Baru sisanya nyusul.
- Kalau ada keputusan desain yang ambigu, tanya. Jangan tebak lalu bangun tiga layer di atas tebakan itu.

---

## 12. Yang sengaja nggak dibangun

Jangan usulin atau bangun ini kecuali diminta eksplisit:

- Multiplayer atau akun user
- Simpan ke database di versi awal. Local storage cukup.
- Fitur "jalanin 100 kali buat lihat distribusi". Karena tiap run pakai LLM, seratus run artinya enam ratus call. Nggak masuk secara biaya.
- Node kondisional atau IF. Cabang di game ini selalu jalan semua, nggak ada percabangan bersyarat.
- Undo/redo canvas di milestone awal
- Mobile-first layout. Desktop dulu, canvas node emang butuh layar lebar.
