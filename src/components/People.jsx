import { useEffect, useRef, useState } from 'react'
import { listPhotos } from '../photoStore'
import { listPeople, savePerson, deletePerson } from '../peopleStore'

const FACE_SUPPORTED = typeof window !== 'undefined' && 'FaceDetector' in window
const SCAN_LIMIT = 40 // cap photos scanned so a big library doesn't stall

// Explore → People. Detects faces across the photo library (where the browser
// supports the Shape Detection API) and lets the user name each one; faces given
// the same name are grouped under one person. Without face detection, a person
// can still be created from a chosen photo. Names persist on the device.
export default function People({ onBack }) {
  const [people, setPeople] = useState([])
  const [faces, setFaces] = useState(null) // null = not scanned yet
  const [scanning, setScanning] = useState(false)
  const [naming, setNaming] = useState(null) // { thumb } being named
  const [picker, setPicker] = useState(false) // manual "add person" photo picker

  async function refresh() {
    setPeople(await listPeople().catch(() => []))
  }
  useEffect(() => {
    refresh()
  }, [])

  async function scan() {
    if (!FACE_SUPPORTED) return
    setScanning(true)
    try {
      const photos = (await listPhotos().catch(() => [])).slice(0, SCAN_LIMIT)
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 8 })
      const found = []
      for (const p of photos) {
        try {
          const bitmap = await loadBitmap(p.url)
          const detected = await detector.detect(bitmap)
          for (const f of detected) {
            const thumb = cropFace(bitmap, f.boundingBox)
            if (thumb) found.push({ id: p.id + ':' + found.length, thumb })
          }
        } catch {
          /* skip a photo that won't decode/detect */
        }
      }
      setFaces(found)
    } finally {
      setScanning(false)
    }
  }

  async function assignName(name) {
    const n = name.trim()
    if (!n) return
    await savePerson({ name: n, thumb: naming.thumb })
    // Remove the just-named face from the unnamed strip.
    setFaces((prev) => (prev || []).filter((f) => f.thumb !== naming.thumb))
    setNaming(null)
    refresh()
  }

  return (
    <div className="people">
      <header className="people-head">
        <h1>People</h1>
        <p>Tag the people in your photos, then find everyone in one tap.</p>
      </header>

      {/* Named people */}
      {people.length > 0 && (
        <div className="people-row">
          {people.map((p) => (
            <button key={p.id} className="person" onClick={() => promptRename(p, refresh)}>
              <span className="person-ring">
                {p.thumb ? <img src={p.thumb} alt="" /> : <span className="person-blank">{initial(p.name)}</span>}
              </span>
              <span className="person-name">{p.name}</span>
              <span
                className="person-del"
                role="button"
                onClick={async (e) => {
                  e.stopPropagation()
                  if (window.confirm(`Remove ${p.name}?`)) {
                    await deletePerson(p.id)
                    refresh()
                  }
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Face scanning */}
      {FACE_SUPPORTED ? (
        <div className="people-scan">
          {faces === null ? (
            <button className="people-scan-btn" onClick={scan} disabled={scanning}>
              {scanning ? 'Scanning your photos…' : '🔍 Find faces in my photos'}
            </button>
          ) : faces.length === 0 ? (
            <div className="people-empty">
              <p>No new faces found in your recent photos.</p>
              <button className="people-link" onClick={scan} disabled={scanning}>
                Scan again
              </button>
            </div>
          ) : (
            <>
              <h2 className="people-subtitle">Faces in your photos</h2>
              <p className="people-hint">Tap a face to give it a name.</p>
              <div className="faces-grid">
                {faces.map((f) => (
                  <button key={f.id} className="face" onClick={() => setNaming(f)}>
                    <img src={f.thumb} alt="Detected face" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="people-empty">
          <p>Automatic face detection isn’t available in this browser, but you can still add people from a photo.</p>
        </div>
      )}

      <button className="people-add" onClick={() => setPicker(true)}>
        ＋ Add a person from a photo
      </button>

      {/* Name a detected face */}
      {naming && (
        <NameSheet
          thumb={naming.thumb}
          people={people}
          onPick={(name) => assignName(name)}
          onClose={() => setNaming(null)}
        />
      )}

      {/* Manual: pick a library photo as a person's avatar */}
      {picker && (
        <PhotoPicker
          onPick={(thumb) => {
            setPicker(false)
            setNaming({ thumb })
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  )
}

async function promptRename(person, refresh) {
  const name = window.prompt('Name', person.name)
  if (name && name.trim()) {
    await savePerson({ id: person.id, name: name.trim(), thumb: person.thumb })
    refresh()
  }
}

// A sheet to name a face: type a new name or tap an existing person.
function NameSheet({ thumb, people, onPick, onClose }) {
  const [name, setName] = useState('')
  return (
    <div className="tb-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pd-sheet-card">
        <span className="pd-sheet-grip" />
        <div className="name-face">
          <img src={thumb} alt="" />
          <strong>Who is this?</strong>
        </div>
        <div className="name-row">
          <input
            autoFocus
            type="text"
            value={name}
            placeholder="Type a name"
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onPick(name)}
          />
          <button disabled={!name.trim()} onClick={() => onPick(name)}>
            Save
          </button>
        </div>
        {people.length > 0 && (
          <>
            <p className="name-existing-label">or add to someone</p>
            <div className="name-existing">
              {people.map((p) => (
                <button key={p.id} onClick={() => onPick(p.name)}>
                  {p.thumb && <img src={p.thumb} alt="" />}
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PhotoPicker({ onPick, onClose }) {
  const [photos, setPhotos] = useState([])
  useEffect(() => {
    listPhotos()
      .then(setPhotos)
      .catch(() => setPhotos([]))
  }, [])
  return (
    <div className="tb-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker">
        <div className="picker-head">
          <strong>Pick a photo</strong>
          <button onClick={onClose}>Cancel</button>
        </div>
        {photos.length === 0 ? (
          <p className="picker-empty">Add photos first, then come back to tag people.</p>
        ) : (
          <div className="picker-grid">
            {photos.map((p) => (
              <button key={p.id} onClick={() => onPick(centerSquare(p.url))}>
                <img src={p.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

function loadBitmap(url) {
  return fetch(url)
    .then((r) => r.blob())
    .then((b) => createImageBitmap(b))
}

// Crop a square around a detected face (with padding) to a small round-ready thumb.
function cropFace(bitmap, box) {
  try {
    const pad = box.width * 0.35
    const size = Math.max(box.width, box.height) + pad * 2
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const sx = Math.max(0, cx - size / 2)
    const sy = Math.max(0, cy - size / 2)
    const s = Math.min(size, bitmap.width - sx, bitmap.height - sy)
    const out = 160
    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    canvas.getContext('2d').drawImage(bitmap, sx, sy, s, s, 0, 0, out, out)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return ''
  }
}

// Center-square crop of a data URL (used when a person is added from a photo).
function centerSquare(url) {
  // Returned synchronously-ish via a data URL through an offscreen draw isn't
  // possible without await, so just hand back the original — the round mask in
  // CSS already shows a centered square of it.
  return url
}
