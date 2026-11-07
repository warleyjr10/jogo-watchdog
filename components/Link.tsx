'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

const KEY = 'congresso-link-jogo'

/** Caixa com QR code e campo para o host colar o link de publicação. Por padrão usa o endereço desta própria página. */
export default function LinkQR({ caminho = '/' }: { caminho?: string }) {
  const [link, setLink] = useState('')
  const [edit, setEdit] = useState(false)
  const [img, setImg] = useState('')

  useEffect(() => {
    const url = new URL(window.location.href)
    const q = url.searchParams.get('link')
    let salvo: string | null = null
    try {
      salvo = localStorage.getItem(KEY)
    } catch {
      /* sem armazenamento */
    }
    setLink(q || salvo || window.location.origin + caminho)
  }, [caminho])

  useEffect(() => {
    if (!link) return
    try {
      localStorage.setItem(KEY, link)
    } catch {
      /* sem armazenamento */
    }
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#434342', light: '#FFFFFF' } })
      .then(setImg)
      .catch(() => setImg(''))
  }, [link])

  const curto = link.replace(/^https?:\/\//, '')
  return (
    <div className="qrbox">
      {img ? <img src={img} alt="QR code do link" /> : <div className="qrph" />}
      <div className="qrtxt">
        <span>Entre pelo celular</span>
        {edit ? (
          <input
            autoFocus
            value={link}
            onChange={(e) => setLink(e.target.value.trim())}
            onBlur={() => setEdit(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEdit(false)}
            placeholder="Cole o link aqui"
          />
        ) : (
          <button onClick={() => setEdit(true)} title="Clique para trocar o link">
            {curto || 'Cole o link'}
          </button>
        )}
      </div>
    </div>
  )
}
