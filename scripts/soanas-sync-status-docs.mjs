#!/usr/bin/env node
/**
 * Derives coverage counters from docs/soanas/blueprint-coverage.json and rewrites
 * the machine-owned sections of derived status docs so they cannot drift.
 *
 * Run: node scripts/soanas-sync-status-docs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const COVERAGE = path.join(ROOT, 'docs/soanas/blueprint-coverage.json')
const MD = path.join(ROOT, 'docs/soanas/BLUEPRINT-COVERAGE.md')
const STATUS = path.join(ROOT, 'docs/soanas/IMPLEMENTATION-STATUS.md')
const FEITO = path.join(ROOT, 'docs/soanas/STATUS-FEITO-VS-FALTA.md')
const ENTREGA = path.join(ROOT, 'docs/soanas/O-QUE-FOI-FEITO.md')

const coverage = JSON.parse(fs.readFileSync(COVERAGE, 'utf8'))
const rows = coverage.rows ?? []
const counts = {
  ANALYZED: 0,
  NOT_STARTED: 0,
  IN_PROGRESS: 0,
  IMPLEMENTED: 0,
  TESTED: 0,
  VALIDATED: 0,
  BLOCKED_EXTERNAL: 0,
}
for (const row of rows) {
  const status = String(row.status || 'ANALYZED').toUpperCase()
  if (status in counts) counts[status] += 1
  else counts.ANALYZED += 1
}
const total = rows.length
const coded = counts.IMPLEMENTED + counts.TESTED + counts.VALIDATED
const codedPct = total ? ((coded / total) * 100).toFixed(0) : '0'
const validatedPct = total ? ((counts.VALIDATED / total) * 100).toFixed(1) : '0.0'

let commit = coverage.commit ?? 'unknown'
let branch = 'unknown'
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
} catch {
  /* keep coverage.commit */
}
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim()
} catch {
  /* keep unknown */
}

function currentBranch() {
  return branch
}

const byModule = {}
for (const row of rows) {
  const moduleId = row.module || 'unknown'
  byModule[moduleId] ??= { ANALYZED: 0, IMPLEMENTED: 0, TESTED: 0, VALIDATED: 0, total: 0 }
  const status = String(row.status || 'ANALYZED').toUpperCase()
  if (status in byModule[moduleId]) byModule[moduleId][status] += 1
  else byModule[moduleId].ANALYZED += 1
  byModule[moduleId].total += 1
}

const moduleTable = Object.entries(byModule)
  .sort((a, b) => b[1].total - a[1].total)
  .map(([moduleId, stats]) => {
    return `| \`${moduleId}\` | ${stats.total} | ${stats.ANALYZED} | ${stats.IMPLEMENTED} | ${stats.TESTED} | ${stats.VALIDATED} |`
  })
  .join('\n')

function replaceBlock(content, startMarker, endMarker, body) {
  const start = content.indexOf(startMarker)
  const end = content.indexOf(endMarker)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Markers not found: ${startMarker} … ${endMarker}`)
  }
  return (
    content.slice(0, start + startMarker.length) +
    '\n' +
    body.trimEnd() +
    '\n' +
    content.slice(end)
  )
}

function ensureMarkers(filePath, startMarker, endMarker, seedBody) {
  let content = fs.readFileSync(filePath, 'utf8')
  if (!content.includes(startMarker)) {
    content = `${content.trimEnd()}\n\n${startMarker}\n${seedBody}\n${endMarker}\n`
    fs.writeFileSync(filePath, content)
  }
  return fs.readFileSync(filePath, 'utf8')
}

const summaryBody = `
| Métrica | Valor |
|--------|------:|
| Total de IDs | ${total} |
| ANALYZED | ${counts.ANALYZED} |
| NOT_STARTED | ${counts.NOT_STARTED} |
| IN_PROGRESS | ${counts.IN_PROGRESS} |
| IMPLEMENTED | ${counts.IMPLEMENTED} |
| TESTED | ${counts.TESTED} |
| VALIDATED | ${counts.VALIDATED} |
| BLOCKED_EXTERNAL | ${counts.BLOCKED_EXTERNAL} |

\`\`\`
Blueprint coverage (IDs): ANALYZED ${counts.ANALYZED} | IMPLEMENTED ${counts.IMPLEMENTED} | TESTED ${counts.TESTED} | VALIDATED ${counts.VALIDATED} / ${total}
Validated (DoD completa): ${validatedPct}%
Derived at commit: ${commit}
\`\`\`
`.trim()

const statusSnippet = `
\`\`\`
Blueprint coverage (IDs): ANALYZED ${counts.ANALYZED} | IMPLEMENTED ${counts.IMPLEMENTED} | TESTED ${counts.TESTED} | VALIDATED ${counts.VALIDATED} / ${total}
Validated (DoD completa): ${validatedPct}%
\`\`\`
`.trim()

const feitoBody = `
| Status | Qtd | Significado |
|----------|----:|-------------|
| \`ANALYZED\` | **${counts.ANALYZED}** | Mapeado; sem código Soanas suficiente |
| \`IMPLEMENTED\` | **${counts.IMPLEMENTED}** | Código/scaffold existe (muitos ainda parciais) |
| \`TESTED\` | **${counts.TESTED}** | Há teste unitário relevante |
| \`VALIDATED\` | **${counts.VALIDATED}** | DoD completa do prompt mestre |
| \`NOT_STARTED\` / \`IN_PROGRESS\` / \`BLOCKED_EXTERNAL\` | **${counts.NOT_STARTED + counts.IN_PROGRESS + counts.BLOCKED_EXTERNAL}** | Ainda não usados nesta fase |

**% IDs com algum código (\`IMPLEMENTED\`+\`TESTED\`+\`VALIDATED\`):** ~${codedPct}% (${coded}/${total})

### Por módulo-alvo (resumo)

| Módulo | Total | ANALYZED | IMPLEMENTED | TESTED | VALIDATED |
|--------|------:|---------:|------------:|-------:|----------:|
${moduleTable}
`.trim()

const entregaBody = `
| Métrica | Valor |
|---------|------:|
| IDs do Blueprint | ${total} |
| ANALYZED | ${counts.ANALYZED} |
| IMPLEMENTED | ${counts.IMPLEMENTED} |
| TESTED | ${counts.TESTED} |
| VALIDATED | **${counts.VALIDATED}** |
`.trim()

// BLUEPRINT-COVERAGE.md — replace Summary table section between markers if present,
// otherwise rewrite the known "## Summary" block heuristically.
{
  let md = fs.readFileSync(MD, 'utf8')
  const startMarker = '<!-- soanas:coverage-summary:start -->'
  const endMarker = '<!-- soanas:coverage-summary:end -->'
  if (!md.includes(startMarker)) {
    md = md.replace(
      /## Summary[\s\S]*?(?=### Progresso overall)/,
      `## Summary\n\n${startMarker}\n${summaryBody}\n${endMarker}\n\n`,
    )
  } else {
    md = replaceBlock(md, startMarker, endMarker, summaryBody)
  }
  md = md.replace(
    /Overall progress:[\s\S]*?(?=```)/,
    `Overall progress: ${validatedPct}% VALIDATED (gate)\nDerived from blueprint-coverage.json @ ${commit}\n`,
  )
  fs.writeFileSync(MD, md)
}

{
  const startMarker = '<!-- soanas:derived-counts:start -->'
  const endMarker = '<!-- soanas:derived-counts:end -->'
  let content = fs.readFileSync(STATUS, 'utf8')
  if (content.includes(startMarker) && content.includes(endMarker)) {
    content = replaceBlock(content, startMarker, endMarker, statusSnippet)
  } else if (content.includes('Blueprint coverage (IDs):')) {
    // Migrate legacy fenced counter block (no markers yet) without truncating the file.
    content = content.replace(
      /```\nBlueprint coverage \(IDs\):[\s\S]*?```/,
      `${startMarker}\n${statusSnippet}\n${endMarker}`,
    )
  } else {
    content = ensureMarkers(STATUS, startMarker, endMarker, statusSnippet)
    content = replaceBlock(content, startMarker, endMarker, statusSnippet)
  }
  content = content.replace(
    /\*\*Branch de trabalho:\*\* `[^`]+`|\*\*Branch:\*\* `[^`]+`/,
    `**Branch de trabalho:** \`${currentBranch()}\``,
  )
  content = content.replace(/\*\*Updated:\*\* \d{4}-\d{2}-\d{2}/, `**Updated:** ${new Date().toISOString().slice(0, 10)}`)
  fs.writeFileSync(STATUS, content)
}

{
  const startMarker = '<!-- soanas:derived-counts:start -->'
  const endMarker = '<!-- soanas:derived-counts:end -->'
  let content = fs.readFileSync(FEITO, 'utf8')
  if (!content.includes(startMarker)) {
    content = content.replace(
      /## 1\. Números da matriz \(303 IDs\)[\s\S]*?(?=---\n\n## 2\.)/,
      `## 1. Números da matriz (${total} IDs)\n\n${startMarker}\n${feitoBody}\n${endMarker}\n\n`,
    )
  } else {
    content = replaceBlock(content, startMarker, endMarker, feitoBody)
  }
  content = content.replace(
    /\|\s*%` IDs com algum código[\s\S]*?\|\s*\*\*~?\d+%?\*\*.*\|/,
    '',
  )
  content = content.replace(
    /\|\s*`%` IDs com algum código[\s\S]*?\n/,
    '',
  )
  content = content.replace(
    /\| `%` IDs com algum código \(`IMPLEMENTED`\+`TESTED`\) \| \*\*~?\d+%?\*\* \(\d+\/\d+\) — secundário \|\n/,
    `| \`%\` IDs com algum código (\`IMPLEMENTED\`+\`TESTED\`+\`VALIDATED\`) | **~${codedPct}%** (${coded}/${total}) — secundário |\n`,
  )
  content = content.replace(
    /\*\*Branch de trabalho:\*\* `[^`]+`|\*\*Branch:\*\* `[^`]+`/,
    `**Branch de trabalho:** \`${currentBranch()}\``,
  )
  content = content.replace(/\*\*Data:\*\* \d{4}-\d{2}-\d{2}/, `**Data:** ${new Date().toISOString().slice(0, 10)}`)
  // Fix stale "soanas_pos ainda não" style claims if any remain in §2.4
  content = content.replace(
    /\|\s*`\.ai\/specs\/2026-09-15-soanas-pos\.md`\s*\|\s*POS \(ainda não implementado\)\s*\|/,
    '| `.ai/specs/2026-09-15-soanas-pos.md` | POS (Retail Sale v1 em código) |',
  )
  fs.writeFileSync(FEITO, content)
}

{
  const startMarker = '<!-- soanas:derived-counts:start -->'
  const endMarker = '<!-- soanas:derived-counts:end -->'
  let content = fs.readFileSync(ENTREGA, 'utf8')
  if (!content.includes(startMarker)) {
    content = content.replace(
      /## 2\. Números[\s\S]*?(?=---\n\n## 3\.)/,
      `## 2. Números\n\n${startMarker}\n${entregaBody}\n${endMarker}\n\n**Métrica principal do produto:** checklist Vertical Slice em [\`IMPLEMENTATION-STATUS.md\`](./IMPLEMENTATION-STATUS.md) — não o percentual bruto da matriz.\n\n`,
    )
  } else {
    content = replaceBlock(content, startMarker, endMarker, entregaBody)
  }
  content = content.replace(
    /\*\*Branch de trabalho:\*\* `[^`]+`|\*\*Branch:\*\* `[^`]+`/,
    `**Branch de trabalho:** \`${currentBranch()}\``,
  )
  content = content.replace(/\*\*Data:\*\* \d{4}-\d{2}-\d{2}/, `**Data:** ${new Date().toISOString().slice(0, 10)}`)
  fs.writeFileSync(ENTREGA, content)
}

{
  const ROADMAP = path.join(ROOT, 'docs/soanas/ROADMAP.md')
  if (fs.existsSync(ROADMAP)) {
    const startMarker = '<!-- soanas:derived-counts:start -->'
    const endMarker = '<!-- soanas:derived-counts:end -->'
    let content = fs.readFileSync(ROADMAP, 'utf8')
    if (content.includes(startMarker) && content.includes(endMarker)) {
      content = replaceBlock(content, startMarker, endMarker, statusSnippet)
      fs.writeFileSync(ROADMAP, content)
    }
  }
}

console.log(
  JSON.stringify(
    {
      total,
      counts,
      coded,
      codedPct,
      validatedPct,
      commit,
      branch: currentBranch(),
      updated: [
        'BLUEPRINT-COVERAGE.md',
        'IMPLEMENTATION-STATUS.md',
        'STATUS-FEITO-VS-FALTA.md',
        'O-QUE-FOI-FEITO.md',
        'ROADMAP.md',
      ],
    },
    null,
    2,
  ),
)
