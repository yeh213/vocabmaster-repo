// 解析上傳的單字檔（CSV / JSON），轉成可預覽、可送到 /api/words/import 的項目。
//
// 每個項目：
//   { key, line, word, part_of_speech, definition, example, payload, error }
//   - key:     小寫單字，用來比對重複
//   - line:    來源列號（CSV 同一個字跨多列時為 "2, 3"）
//   - payload: 要送給 API 的單字物件；有 error 時為 null

export const CSV_TEMPLATE =
  '﻿word,part_of_speech,definition,example,example_zh\r\n' +
  'commercial,adj.,商業的,The commercial district is busy.,商業區很繁忙。\r\n' +
  'commercial,n.,商業廣告,I saw a commercial on TV.,我在電視上看到一則廣告。\r\n' +
  'abandon,v.,放棄;拋棄,He abandoned the plan.,他放棄了那個計畫。\r\n'

const HEADER_ALIASES = {
  word: ['word', '單字', '英文', 'english'],
  part_of_speech: ['part_of_speech', 'partofspeech', 'pos', '詞性'],
  definition: ['definition', 'meaning', '中文', '釋義', '中文釋義', '意思'],
  example: ['example', 'example_en', '例句', '英文例句'],
  example_zh: ['example_zh', '例句翻譯', '例句中文', '中文例句', '翻譯'],
}

const CJK = /[㐀-鿿]/

// ---------- 編碼 ----------

// UTF-8（含 BOM）優先；不是合法 UTF-8 時視為 Excel 舊式 CSV 的 Big5
export function decodeText(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('big5').decode(bytes)
  }
}

// ---------- CSV ----------

// RFC 4180：支援引號內的逗號、換行與 "" 跳脫
export function parseCSV(text) {
  text = text.replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row)
      row = []; field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/\s+/g, '_')
}

function mapHeaders(headerRow) {
  const cols = {}
  headerRow.forEach((h, idx) => {
    const n = normalizeHeader(h)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (cols[field] === undefined && aliases.includes(n)) cols[field] = idx
    }
  })
  return cols
}

function splitDefs(s) {
  return s.split(/[;；]/).map(x => x.trim()).filter(Boolean)
}

function unique(arr) {
  return [...new Set(arr)]
}

// 由 senses 產生列表/測驗用的扁平欄位
function flatten(senses) {
  const ex = senses.flatMap(s => s.examples)[0]
  return {
    definition: unique(senses.flatMap(s => s.definitions)).join(';'),
    part_of_speech: unique(senses.map(s => s.partOfSpeech).filter(Boolean)).join(';'),
    example: ex ? (ex.zh ? `${ex.en}\n${ex.zh}` : ex.en) : '',
  }
}

export function csvToItems(text) {
  const rows = parseCSV(text).filter(r => r.some(c => c.trim() !== ''))
  if (rows.length === 0) return { items: [], fatal: '檔案是空的' }

  const cols = mapHeaders(rows[0])
  if (cols.word === undefined || cols.definition === undefined) {
    return {
      items: [],
      fatal: '第一列必須是標題列，且至少要有 word 和 definition 欄位（可下載範本參考）',
    }
  }

  const cell = (r, f) => (cols[f] === undefined ? '' : (r[cols[f]] ?? '').trim())
  const errors = []
  const groups = new Map() // key -> { word, lines, senses }

  rows.slice(1).forEach((r, i) => {
    const line = i + 2 // 標題是第 1 列
    const word = cell(r, 'word')
    const definition = cell(r, 'definition')
    const pos = cell(r, 'part_of_speech')
    const example = cell(r, 'example')
    const exampleZh = cell(r, 'example_zh')

    let error = null
    if (!word) error = '缺少英文單字'
    else if (CJK.test(word)) error = '英文單字欄有中文，可能欄位錯位'
    else if (!definition) error = '缺少中文釋義'
    else if (exampleZh && !example) error = '有例句翻譯但沒有英文例句'

    if (error) {
      errors.push({
        key: `__error_${line}`, line: String(line), word, part_of_speech: pos,
        definition, example, payload: null, error,
      })
      return
    }

    const key = word.toLowerCase()
    if (!groups.has(key)) groups.set(key, { word, lines: [], senses: [] })
    const g = groups.get(key)
    g.lines.push(line)
    g.senses.push({
      partOfSpeech: pos,
      definitions: splitDefs(definition),
      examples: example ? [exampleZh ? { en: example, zh: exampleZh } : { en: example }] : [],
    })
  })

  const items = [...groups.entries()].map(([key, g]) => {
    const flat = flatten(g.senses)
    return {
      key, line: g.lines.join(', '), word: g.word, ...flat,
      payload: { word: g.word, ...flat, senses: g.senses },
      error: null,
    }
  })

  return { items: [...items, ...errors].sort((a, b) => parseInt(a.line) - parseInt(b.line)), fatal: null }
}

// ---------- JSON ----------

// 接受 vocab-data.json 格式（{ words: [...] }）或單純的陣列
export function jsonToItems(text) {
  let data
  try {
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch (e) {
    return { items: [], fatal: 'JSON 格式錯誤：' + e.message }
  }
  const arr = Array.isArray(data) ? data : data?.words
  if (!Array.isArray(arr)) return { items: [], fatal: 'JSON 裡找不到 words 陣列' }
  if (arr.length === 0) return { items: [], fatal: '檔案裡沒有單字' }

  const seen = new Set()
  const items = arr.map((w, i) => {
    const line = String(i + 1)
    const word = typeof w?.word === 'string' ? w.word.trim() : ''
    const senses = Array.isArray(w?.senses) ? w.senses : []
    const fromSenses = senses.length ? flatten(senses.map(s => ({
      partOfSpeech: s.partOfSpeech ?? '',
      definitions: s.definitions ?? [],
      examples: s.examples ?? [],
    }))) : { definition: '', part_of_speech: '', example: '' }
    const definition = w?.definition || fromSenses.definition
    const part_of_speech = w?.part_of_speech || w?.partOfSpeech || fromSenses.part_of_speech
    const example = w?.example || fromSenses.example
    const key = word.toLowerCase()

    let error = null
    if (!word) error = '缺少英文單字'
    else if (CJK.test(word)) error = '英文單字欄有中文'
    else if (!definition) error = '缺少中文釋義'
    else if (seen.has(key)) error = '檔案內重複，只匯入第一筆'
    if (!error) seen.add(key)

    return {
      key: error ? `__error_${line}` : key,
      line, word, part_of_speech, definition, example,
      payload: error ? null : {
        ...w, word, definition, part_of_speech, partOfSpeech: part_of_speech, example, senses,
      },
      error,
    }
  })
  return { items, fatal: null }
}

// ---------- 入口 ----------

export function parseImportFile(fileName, buffer) {
  const text = decodeText(buffer)
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.json')) return { kind: 'json', ...jsonToItems(text) }
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return { kind: 'csv', ...csvToItems(text) }
  return { kind: null, items: [], fatal: '只支援 .csv 或 .json 檔' }
}
