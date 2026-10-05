#!/usr/bin/env node
// Temporary test-user loader: reads test-users.txt (Notepad-editable) and
// upserts users into the database. Meant to be used until user management
// covers seeding itself. Run with:  npm run seed:users
//
// Idempotent: re-running updates role/name/password only when they differ
// (the .txt stays authoritative). The file is gitignored — no test
// credentials ever live in source code.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
// Single source of truth for roles (same module the app guards use).
import { ROLES } from '../src/lib/permissions.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const USERS_FILE = join(HERE, '..', 'test-users.txt')
const BCRYPT_ROUNDS = 12 // matches hashPassword() in src/lib/auth.ts

const prisma = new PrismaClient()

function parse(text) {
  const entries = []
  const errors = []
  text.split(/\r?\n/).forEach((line, index) => {
    const n = index + 1
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const parts = trimmed.split('|').map((part) => part.trim())
    if (parts.length !== 4) {
      errors.push(`linea ${n}: se esperan 4 campos (email | contrasena | rol | nombre)`)
      return
    }
    const [email, password, role, name] = parts
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`linea ${n}: email invalido "${email}"`)
    if (password.length < 8) errors.push(`linea ${n}: la contrasena debe tener al menos 8 caracteres`)
    if (!ROLES.includes(role)) errors.push(`linea ${n}: rol invalido "${role}"`)
    entries.push({ email, password, role, name, line: n })
  })
  return { entries, errors }
}

async function passwordMatches(plain, storedHash) {
  try {
    return await bcrypt.compare(plain, storedHash)
  } catch {
    return false
  }
}

async function main() {
  let text
  try {
    text = readFileSync(USERS_FILE, 'utf8')
  } catch {
    console.error(`No se encontro ${USERS_FILE}`)
    process.exit(1)
  }

  const { entries, errors } = parse(text)
  if (errors.length > 0) {
    console.error('Archivo con errores (no se aplico ningun cambio):')
    for (const error of errors) console.error(`  - ${error}`)
    process.exit(1)
  }
  if (entries.length === 0) {
    console.log('No hay usuarios en el archivo (solo comentarios o lineas vacias).')
    return
  }

  const summary = { created: 0, updated: 0, unchanged: 0 }

  for (const entry of entries) {
    const existing = await prisma.user.findUnique({ where: { email: entry.email } })

    if (!existing) {
      const passwordHash = await bcrypt.hash(entry.password, BCRYPT_ROUNDS)
      await prisma.user.create({
        data: { email: entry.email, name: entry.name, role: entry.role, passwordHash },
      })
      summary.created += 1
      console.log(`+ CREADO    ${entry.email}  [${entry.role}]`)
      continue
    }

    const passwordOk = await passwordMatches(entry.password, existing.passwordHash)
    const roleChanged = existing.role !== entry.role
    const nameChanged = existing.name !== entry.name

    if (!passwordOk || roleChanged || nameChanged) {
      const passwordHash = passwordOk ? existing.passwordHash : await bcrypt.hash(entry.password, BCRYPT_ROUNDS)
      await prisma.user.update({
        where: { email: entry.email },
        data: { role: entry.role, name: entry.name, passwordHash },
      })
      const changes = [
        !passwordOk && 'contrasena',
        roleChanged && 'rol',
        nameChanged && 'nombre',
      ].filter(Boolean)
      summary.updated += 1
      console.log(`~ ACTUALIZADO ${entry.email}  (${changes.join(', ')})`)
    } else {
      summary.unchanged += 1
      console.log(`= SIN CAMBIOS ${entry.email}`)
    }
  }

  console.log(
    `\nListo: ${summary.created} creados, ${summary.updated} actualizados, ${summary.unchanged} sin cambios.`
  )
}

main()
  .catch((error) => {
    console.error('Error:', error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
