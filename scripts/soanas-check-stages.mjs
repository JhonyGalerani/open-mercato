#!/usr/bin/env node
/**
 * Ensures every blueprint coverage ID maps to exactly one E0–E9 stage.
 * Run: node scripts/soanas-check-stages.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const COVERAGE = path.join(ROOT, 'docs/soanas/blueprint-coverage.json')
const STAGES = path.join(ROOT, 'docs/soanas/stage-assignment.json')

const VALID = new Set(['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'])

const coverage = JSON.parse(fs.readFileSync(COVERAGE, 'utf8'))
const assignment = JSON.parse(fs.readFileSync(STAGES, 'utf8'))
const rows = coverage.rows ?? []
const errors = []

if (rows.length !== 303) {
  errors.push(`Expected 303 IDs, found ${rows.length}`)
}

const byStage = Object.fromEntries([...VALID].map((stage) => [stage, 0]))
const seen = new Set()

for (const row of rows) {
  const id = row.id
  if (seen.has(id)) errors.push(`Duplicate coverage id ${id}`)
  seen.add(id)
  const stage = assignment.idOverrides?.[id] || assignment.moduleDefaults?.[row.module]
  if (!stage) {
    errors.push(`No stage for ${id} (module=${row.module})`)
    continue
  }
  if (!VALID.has(stage)) {
    errors.push(`Invalid stage ${stage} for ${id}`)
    continue
  }
  byStage[stage] += 1
}

for (const moduleId of Object.keys(assignment.moduleDefaults || {})) {
  const stage = assignment.moduleDefaults[moduleId]
  if (!VALID.has(stage)) errors.push(`moduleDefaults.${moduleId} invalid stage ${stage}`)
}

for (const [id, stage] of Object.entries(assignment.idOverrides || {})) {
  if (!VALID.has(stage)) errors.push(`idOverrides.${id} invalid stage ${stage}`)
  if (!rows.some((row) => row.id === id)) errors.push(`idOverrides.${id} not in coverage`)
}

const assigned = Object.values(byStage).reduce((sum, n) => sum + n, 0)
if (assigned !== rows.length) {
  errors.push(`Assigned ${assigned} != coverage rows ${rows.length}`)
}

// Keep summary in JSON honest (advisory rewrite if drift)
const summary = assignment.summary || {}
for (const stage of VALID) {
  if (Number(summary[stage] || 0) !== byStage[stage]) {
    errors.push(
      `stage-assignment.json summary.${stage}=${summary[stage] ?? 'missing'} but computed ${byStage[stage]} — run yarn soanas:sync-status or fix summary`,
    )
  }
}

if (errors.length) {
  console.error('soanas:check-stages FAILED')
  for (const error of errors) console.error(` - ${error}`)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      total: rows.length,
      byStage,
      note: 'E8 may be 0 when packaging has no dedicated Blueprint IDs',
    },
    null,
    2,
  ),
)
