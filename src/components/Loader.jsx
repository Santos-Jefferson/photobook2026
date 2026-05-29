const LINES = [
  'Reading your photos…',
  'Finding the story…',
  'Choosing the words…',
  'Painting each scene…',
  'Binding the book…',
]

import { useEffect, useState } from 'react'

export default function Loader() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % LINES.length), 1600)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="loader">
      <div className="loader-orb" aria-hidden />
      <p className="loader-text">{LINES[i]}</p>
      <p className="loader-sub">This can take a moment — good stories are worth it.</p>
    </div>
  )
}
