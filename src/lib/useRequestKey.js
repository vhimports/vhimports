import { useRef } from 'react'

// Reutiliza a identidade ao repetir a mesma ação após erro/timeout.
// Limpar somente após sucesso confirmado ou ao iniciar outra operação explícita.
export function useRequestKey() {
  const current = useRef(null)
  return {
    keyFor(payload) {
      const fingerprint = JSON.stringify(payload)
      if (current.current?.fingerprint !== fingerprint) current.current = { fingerprint, id: crypto.randomUUID() }
      return current.current.id
    },
    clear() { current.current = null },
  }
}

