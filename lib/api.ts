import { NextResponse } from 'next/server'

export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
}

export const CODIGOS = {
  NAO_AUTENTICADO: 401,
  SEM_PERMISSAO: 403,
  REGISTRO_NAO_ENCONTRADO: 404,
  CONFLITO: 409,
  DADOS_INVALIDOS: 422,
  ERRO_INTERNO: 500,
} as const

export function erro(codigo: keyof typeof CODIGOS, mensagem: string) {
  return NextResponse.json({ ok: false, erro: { codigo, mensagem } }, { status: CODIGOS[codigo] })
}
