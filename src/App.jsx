import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE_URL = 'http://3.141.194.0'
const publicAsset = (path) => `${import.meta.env.BASE_URL}${path}`

const photos = [
  {
    src: publicAsset('Images/isabelle-julio-retrato.jpeg'),
    alt: 'Isabelle e Julio sorrindo juntos',
    className: 'photo-main',
  },
  {
    src: publicAsset('Images/isabelle-julio-beijo.jpg'),
    alt: 'Julio beijando Isabelle',
    className: 'photo-secondary',
  },
  {
    src: publicAsset('Images/isabelle-julio-casal.jpg'),
    alt: 'Isabelle e Julio juntos',
    className: 'photo-secondary photo-landscape',
  },
]

const tracks = [
  { title: 'Those Eyes (Home Session)', artist: 'New West', time: '3:40', src: publicAsset('music/those-eyes-new-west.mp4') },
  { title: 'I Hear a Symphony (Lyrics)', artist: 'Cody Fry', time: '3:07', src: publicAsset('music/i-hear-a-symphony-cody-fry.mp4') },
]

function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [activeTrack, setActiveTrack] = useState(0)
  const [rsvpSent, setRsvpSent] = useState(false)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [rsvpError, setRsvpError] = useState('')
  const [gifts, setGifts] = useState([])
  const [selectedGift, setSelectedGift] = useState(null)
  const [giftName, setGiftName] = useState('')
  const [giftError, setGiftError] = useState('')
  const [giftLoading, setGiftLoading] = useState(true)
  const audioRef = useRef(null)
  const resumeListenerRef = useRef(null)
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/gifts`)
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar a lista de presentes.')
        return response.json()
      })
      .then(setGifts)
      .catch((error) => setGiftError(error.message))
      .finally(() => setGiftLoading(false))
  }, [])

  useEffect(() => {
    const player = audioRef.current
    if (!player) return
    player.volume = 0.35
    player.muted = false

    const resumeAfterInteraction = () => {
      player.play().then(() => {
        setSoundEnabled(true)
        setIsPlaying(true)
      }).catch(() => setIsPlaying(false))
    }

    player.play().then(() => {
      setSoundEnabled(true)
      setIsPlaying(true)
    }).catch(() => {
      document.addEventListener('click', resumeAfterInteraction, { once: true })
      resumeListenerRef.current = resumeAfterInteraction
    })

    return () => {
      document.removeEventListener('click', resumeAfterInteraction)
      resumeListenerRef.current = null
    }
  }, [])

  function togglePlaylist() {
    if (!audioRef.current) return
    if (resumeListenerRef.current) {
      document.removeEventListener('click', resumeListenerRef.current)
      resumeListenerRef.current = null
    }
    if (!soundEnabled) {
      audioRef.current.muted = false
      audioRef.current.play().then(() => {
        setSoundEnabled(true)
        setIsPlaying(true)
      }).catch(() => setIsPlaying(false))
      return
    }
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }

  function openTrack(index) {
    setActiveTrack(index)
    if (!audioRef.current) return
    if (resumeListenerRef.current) {
      document.removeEventListener('click', resumeListenerRef.current)
      resumeListenerRef.current = null
    }
    audioRef.current.muted = false
    audioRef.current.src = tracks[index].src
    audioRef.current.load()
    audioRef.current.play().then(() => {
      setSoundEnabled(true)
      setIsPlaying(true)
    }).catch(() => setIsPlaying(false))
  }

  function playNextTrack() {
    const nextIndex = (activeTrack + 1) % tracks.length
    setActiveTrack(nextIndex)
    if (!audioRef.current) return
    audioRef.current.muted = false
    audioRef.current.src = tracks[nextIndex].src
    audioRef.current.load()
    audioRef.current.play().then(() => {
      setSoundEnabled(true)
      setIsPlaying(true)
    }).catch(() => setIsPlaying(false))
  }

  async function handleRsvp(event) {
    event.preventDefault()
    setRsvpLoading(true)
    setRsvpError('')
    const formData = new FormData(event.currentTarget)
    const attendance = formData.get('attendance')
    try {
      const response = await fetch(`${API_BASE_URL}/api/rsvps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: formData.get('guestName'),
          attendance,
          guestsCount: 1,
          message: formData.get('message') || null,
        }),
      })
      if (!response.ok) throw new Error('Não foi possível registrar sua confirmação. Tente novamente.')
      setRsvpSent(true)
    } catch (error) {
      setRsvpError(error.message)
    } finally {
      setRsvpLoading(false)
    }
  }

  function openGift(gift) {
    if (gift.isReserved) return
    setSelectedGift(gift)
    setGiftName('')
    setGiftError('')
  }

  async function reserveGift(event) {
    event.preventDefault()
    if (!selectedGift || !giftName.trim()) return
    setGiftLoading(true)
    setGiftError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/gifts/${selectedGift.id}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorName: giftName.trim() }),
      })
      if (response.status === 409) throw new Error('Este presente acabou de ser escolhido por outra pessoa.')
      if (!response.ok) throw new Error('Não foi possível reservar este presente. Tente novamente.')
      const updatedGift = await response.json()
      setGifts((current) => current.map((gift) => gift.id === updatedGift.id ? updatedGift : gift))
      setSelectedGift(null)
    } catch (error) {
      setGiftError(error.message)
    } finally {
      setGiftLoading(false)
    }
  }

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#inicio" aria-label="Voltar ao início">I <span>&</span> J</a>
        <div className="nav-links">
          <a href="#nossa-historia">Nossa história</a>
          <a href="#galeria">Momentos</a>
          <a href="#detalhes">Detalhes</a>
          <a href="#rsvp" className="nav-cta">Confirmar presença <span>↗</span></a>
        </div>
        <a href="#rsvp" className="mobile-cta">RSVP</a>
      </nav>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">Uma celebração do amor</p>
          <h1>Isabelle <em>&</em><br />Julio</h1>
          <p className="hero-date">14 <span>/</span> 11 <span>/</span> 2026</p>
          <p className="hero-intro">Duas histórias, um caminho e uma vida inteira pela frente.</p>
          <a className="button button-dark" href="#rsvp">Venha celebrar com a gente <span>↗</span></a>
        </div>
        <div className="hero-portrait">
          <img src={publicAsset('Images/451ddad2-1796-44f7-aba3-ac224ab55a8f.png')} alt="Isabelle e Julio abraçados" />
          <div className="hero-stamp" aria-hidden="true"><span>com<br />amor</span><b>✳</b></div>
        </div>
        <div className="scroll-note"><span className="scroll-line" /> role para descobrir</div>
      </section>

      <section className="story section" id="nossa-historia">
        <div className="section-label">01 / nossa história</div>
        <div className="story-content">
          <div>
            <p className="eyebrow">Era uma vez, em 2023...</p>
            <h2>O acaso nos apresentou.<br /><em>O amor nos escolheu.</em></h2>
          </div>
          <div className="story-text">
            <p>Entre conversas despretensiosas e muitas risadas, descobrimos que as melhores histórias são aquelas que a gente não planeja.</p>
            <p>Três anos depois, queremos celebrar o nosso sim cercados por quem faz parte da nossa história.</p>
            <span className="signature">I + J</span>
          </div>
        </div>
      </section>

      <section className="gallery section" id="galeria">
        <div className="gallery-heading">
          <div className="section-label">02 / nossos momentos</div>
          <h2>Um pouco do que<br /><em>vivemos juntos.</em></h2>
        </div>
        <div className="photo-grid">
          {photos.map((photo) => <img key={photo.src} className={photo.className} src={photo.src} alt={photo.alt} />)}
        </div>
      </section>

      <section className="details section" id="detalhes">
        <div className="section-label">03 / o grande dia</div>
        <div className="details-grid">
          <div className="detail-block">
            <span className="detail-icon">◷</span>
            <p className="eyebrow">Quando</p>
            <h3>Sábado, 14 de novembro<br />de 2026</h3>
            <p>Às 10h</p>
          </div>
          <div className="detail-block">
            <span className="detail-icon">⌖</span>
            <p className="eyebrow">Onde</p>
            <h3>Local do nosso casamento</h3>
            <p>Confira o endereço e a rota no mapa</p>
            <a href="https://maps.app.goo.gl/cJWdE4pNnSo6heM58" target="_blank" rel="noreferrer" className="text-link">Abrir no mapa ↗</a>
          </div>
        </div>
        <div className="map-card">
          <iframe
            title="Local do casamento no Google Maps"
            src="https://www.google.com/maps?q=Espa%C3%A7o+Harmonia+Eventos%2C+-22.7262385%2C-47.7248223&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      <section className="music section">
        <audio id="backgroundMusic" ref={audioRef} className="local-player" src={tracks[0].src} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={playNextTrack} preload="auto">
          Seu navegador não suporta reprodução de áudio.
        </audio>
        <div className="music-intro">
          <div className="section-label">04 / trilha sonora</div>
          <h2>Play, para entrar<br /><em>no clima.</em></h2>
          <p>Algumas músicas que embalaram a nossa história — e agora embalam esse momento.</p>
          <button type="button" className="play-button" onClick={togglePlaylist} aria-label={soundEnabled && isPlaying ? 'Pausar playlist' : 'Ativar playlist'}>
            <span>{soundEnabled && isPlaying ? 'Ⅱ' : '▶'}</span> {soundEnabled && isPlaying ? 'Pausar playlist' : 'Ativar playlist'}
          </button>
        </div>
        <div className="playlist">
          {tracks.map((track, index) => (
            <button type="button" className={`track ${activeTrack === index ? 'active' : ''}`} key={track.src} onClick={() => openTrack(index)}>
              <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="track-info"><b>{track.title}</b><small>{track.artist}</small></span>
              <span className="track-time">{activeTrack === index && isPlaying ? '♫' : track.time}</span>
            </button>
          ))}
          <div className="sound-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <section className="gifts section">
        <div className="section-label">05 / lista de presentes</div>
        <div className="gifts-heading"><h2>O melhor presente<br /><em>é ter você aqui.</em></h2><p>Mas se quiser nos presentear, preparamos uma lista com carinho para a nossa casa nova.</p></div>
        {giftLoading && gifts.length === 0 && <p className="gift-status">Carregando nossa lista...</p>}
        {giftError && !selectedGift && <p className="gift-status gift-error">{giftError}</p>}
        {!giftLoading && gifts.length === 0 && !giftError && <p className="gift-status">A lista de presentes estará disponível em breve.</p>}
        <div className="gift-list">{gifts.map((gift) => <div className={`gift-card ${gift.isReserved ? 'reserved' : ''}`} key={gift.id}><div><h3>{gift.name}</h3><p>{gift.description || 'Um presente escolhido com carinho'}</p></div><strong>{gift.isReserved ? `Escolhido por ${gift.reservedBy}` : 'Disponível'}</strong><button type="button" disabled={gift.isReserved} onClick={() => openGift(gift)} aria-label={gift.isReserved ? `Presente já escolhido: ${gift.name}` : `Escolher ${gift.name}`}>{gift.isReserved ? '✓' : '↗'}</button></div>)}</div>
      </section>

      <section className="rsvp section" id="rsvp">
        <div className="rsvp-heading"><div className="section-label">06 / confirme sua presença</div><h2>Você faz parte<br /><em>da nossa história.</em></h2>        <p>Confirme sua presença até 09 de outubro.<br />Mal podemos esperar para celebrar com você!</p></div>
        {rsvpSent ? <div className="success-message"><span>✦</span><h3>Presença confirmada!</h3><p>Obrigado por fazer parte desse momento. Nos vemos no grande dia.</p></div> : <form className="rsvp-form" onSubmit={handleRsvp}><label>Seu nome<input required name="guestName" type="text" placeholder="Como devemos te chamar?" /></label><label>Você vai?<select required name="attendance" defaultValue=""><option value="" disabled>Selecione uma opção</option><option value="Attending">Sim, estarei presente!</option><option value="NotAttending">Infelizmente não poderei ir</option></select></label><label>Recadinho para os noivos <textarea name="message" placeholder="Deixe uma mensagem (opcional)" rows="2" /></label>{rsvpError && <p className="gift-error">{rsvpError}</p>}<button className="button button-dark" type="submit" disabled={rsvpLoading}>{rsvpLoading ? 'Salvando...' : 'Confirmar presença'} <span>↗</span></button></form>}
      </section>

      <footer><div className="footer-monogram">I <span>&</span> J</div><p>Feito com amor para o nosso grande dia.</p><small>14 · 11 · 2026</small></footer>
      {selectedGift && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedGift(null) }}><div className="gift-modal" role="dialog" aria-modal="true" aria-labelledby="gift-modal-title"><button type="button" className="modal-close" onClick={() => setSelectedGift(null)} aria-label="Fechar">×</button><p className="eyebrow">Um presente com carinho</p><h2 id="gift-modal-title">Escolher<br /><em>{selectedGift.name}</em></h2><p className="modal-copy">Digite seu nome para reservar este presente. Ele ficará indisponível para os demais convidados.</p><form onSubmit={reserveGift}><label>Seu nome<input required autoFocus value={giftName} onChange={(event) => setGiftName(event.target.value)} placeholder="Como devemos te chamar?" /></label>{giftError && <p className="gift-error">{giftError}</p>}<button type="submit" className="button button-dark" disabled={giftLoading}>{giftLoading ? 'Salvando...' : 'Confirmar escolha'} <span>↗</span></button></form></div></div>}
    </main>
  )
}

export default App
