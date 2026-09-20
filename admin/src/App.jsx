import { useCallback, useEffect, useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const attendanceLabels = {
  Attending: 'Confirmados',
  NotAttending: 'Não irão',
  Pending: 'Pendentes',
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function statusLabel(value) {
  return attendanceLabels[value] || value
}

function formatDate(value) {
  return value ? dateTime.format(new Date(value)) : '—'
}

function downloadCsv(filename, rows) {
  const headers = Object.keys(rows[0] || {})
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const content = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(escape).join(';'))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function exportExcel(rsvps, gifts) {
  const guests = rsvps.map((rsvp) => ({
    Convidado: rsvp.guestName,
    Email: rsvp.email || '',
    Status: statusLabel(rsvp.attendance),
    Pessoas: rsvp.guestsCount,
    Mensagem: rsvp.message || '',
    Atualizado: formatDate(rsvp.updatedAt),
  }))
  const giftRows = gifts.map((gift) => ({
    Presente: gift.name,
    Descrição: gift.description || '',
    Status: gift.isComplete ? 'Meta completa' : gift.isReserved ? 'Reservado' : 'Disponível',
    'Meta (R$)': gift.goalAmount,
    'Arrecadado (R$)': gift.contributedAmount,
    'Reservado por': gift.reservedBy || '',
    Contribuições: gift.contributions.length,
  }))
  const contributions = gifts.flatMap((gift) => gift.contributions.map((contribution) => ({
    Presente: gift.name,
    Contribuidor: contribution.contributorName,
    'Valor (R$)': contribution.amount,
    Mensagem: contribution.message || '',
    Data: formatDate(contribution.createdAt),
  })))
  downloadCsv('casamento-convidados.csv', guests)
  downloadCsv('casamento-presentes.csv', giftRows)
  downloadCsv('casamento-contribuicoes.csv', contributions)
}

function App() {
  const [rsvps, setRsvps] = useState([])
  const [gifts, setGifts] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [attendanceFilter, setAttendanceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rsvpsResponse, giftsResponse] = await Promise.all([
        fetch(`${API_URL}/api/rsvps`),
        fetch(`${API_URL}/api/gifts`),
      ])
      if (!rsvpsResponse.ok || !giftsResponse.ok) throw new Error('Não foi possível carregar os dados da API.')
      setRsvps(await rsvpsResponse.json())
      setGifts(await giftsResponse.json())
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const [rsvpsResponse, giftsResponse] = await Promise.all([
          fetch(`${API_URL}/api/rsvps`),
          fetch(`${API_URL}/api/gifts`),
        ])
        if (!rsvpsResponse.ok || !giftsResponse.ok) throw new Error('Não foi possível carregar os dados da API.')
        const [nextRsvps, nextGifts] = await Promise.all([rsvpsResponse.json(), giftsResponse.json()])
        if (!cancelled) {
          setRsvps(nextRsvps)
          setGifts(nextGifts)
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const attending = rsvps.filter(({ attendance }) => attendance === 'Attending')
  const pending = rsvps.filter(({ attendance }) => attendance === 'Pending')
  const confirmedGuests = attending.reduce((total, rsvp) => total + rsvp.guestsCount, 0)
  const reservedGifts = gifts.filter(({ isReserved }) => isReserved)
  const completedGifts = gifts.filter(({ isComplete }) => isComplete)
  const contributed = gifts.reduce((total, gift) => total + gift.contributedAmount, 0)

  const filteredRsvps = useMemo(() => rsvps.filter((rsvp) => {
    const matchesStatus = attendanceFilter === 'all' || rsvp.attendance === attendanceFilter
    const query = search.trim().toLocaleLowerCase()
    return matchesStatus && (!query || rsvp.guestName.toLocaleLowerCase().includes(query) || rsvp.email?.toLocaleLowerCase().includes(query))
  }), [attendanceFilter, rsvps, search])

  return (
    <main className="shell">
      <header className="topbar no-print">
        <div>
          <p className="eyebrow">Isabelle & Julio · 14.11.2026</p>
          <h1>Painel do casamento</h1>
        </div>
        <div className="actions">
          <button className="button secondary" onClick={loadData} disabled={loading}>Atualizar</button>
          <button className="button primary" onClick={() => exportExcel(rsvps, gifts)}>Exportar Excel (CSV)</button>
        </div>
      </header>

      {error && <div className="alert">{error} <button onClick={loadData}>Tentar novamente</button></div>}

      <section className="summary-grid">
        <SummaryCard label="Confirmados" value={attending.length} detail={`${confirmedGuests} pessoas`} tone="green" />
        <SummaryCard label="Aguardando resposta" value={pending.length} detail="confirmações pendentes" tone="yellow" />
        <SummaryCard label="Presentes reservados" value={reservedGifts.length} detail={`${completedGifts.length} metas completas`} tone="blue" />
        <SummaryCard label="Total arrecadado" value={money.format(contributed)} detail={`${gifts.length} presentes cadastrados`} tone="pink" />
      </section>

      <nav className="tabs no-print">
        <Tab active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Visão geral</Tab>
        <Tab active={activeTab === 'rsvps'} onClick={() => setActiveTab('rsvps')}>Convidados ({rsvps.length})</Tab>
        <Tab active={activeTab === 'gifts'} onClick={() => setActiveTab('gifts')}>Lista de presentes ({gifts.length})</Tab>
      </nav>

      {loading && <div className="loading">Carregando dados...</div>}
      {!loading && activeTab === 'overview' && <Overview rsvps={rsvps} gifts={gifts} onNavigate={setActiveTab} />}
      {!loading && activeTab === 'rsvps' && (
        <RsvpsTable
          rsvps={filteredRsvps}
          filter={attendanceFilter}
          search={search}
          onFilter={setAttendanceFilter}
          onSearch={setSearch}
        />
      )}
      {!loading && activeTab === 'gifts' && <GiftsList gifts={gifts} />}
    </main>
  )
}

function SummaryCard({ label, value, detail, tone }) {
  return <article className={`summary-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function Tab({ active, children, onClick }) {
  return <button className={`tab ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>
}

function Overview({ rsvps, gifts, onNavigate }) {
  const recentRsvps = rsvps.slice(0, 5)
  const reserved = gifts.filter(({ isReserved }) => isReserved).slice(0, 5)
  return (
    <section className="overview-grid">
      <Panel title="Últimas confirmações" action={<button className="link-button" onClick={() => onNavigate('rsvps')}>Ver todos</button>}>
        {recentRsvps.length ? recentRsvps.map((rsvp) => <RsvpRow key={rsvp.id} rsvp={rsvp} />) : <Empty text="Nenhuma confirmação registrada." />}
      </Panel>
      <Panel title="Presentes reservados" action={<button className="link-button" onClick={() => onNavigate('gifts')}>Ver lista</button>}>
        {reserved.length ? reserved.map((gift) => <div className="mini-row" key={gift.id}><span>{gift.name}<small>{gift.reservedBy}</small></span><b>{gift.isComplete ? 'Completo' : 'Reservado'}</b></div>) : <Empty text="Nenhum presente reservado." />}
      </Panel>
    </section>
  )
}

function RsvpsTable({ rsvps, filter, search, onFilter, onSearch }) {
  return (
    <Panel title="Confirmações de presença" action={<div className="filters no-print"><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar convidado..." /><select value={filter} onChange={(event) => onFilter(event.target.value)}><option value="all">Todos</option><option value="Attending">Confirmados</option><option value="Pending">Pendentes</option><option value="NotAttending">Não irão</option></select></div>}>
      <div className="table-wrap"><table><thead><tr><th>Convidado</th><th>Contato</th><th>Status</th><th>Pessoas</th><th>Atualizado</th><th>Mensagem</th></tr></thead><tbody>{rsvps.map((rsvp) => <tr key={rsvp.id}><td><strong>{rsvp.guestName}</strong></td><td>{rsvp.email || '—'}</td><td><Status value={rsvp.attendance} /></td><td>{rsvp.guestsCount}</td><td>{formatDate(rsvp.updatedAt)}</td><td className="message">{rsvp.message || '—'}</td></tr>)}</tbody></table></div>
      {!rsvps.length && <Empty text="Nenhum convidado encontrado." />}
    </Panel>
  )
}

function GiftsList({ gifts }) {
  return <section className="gift-grid">{gifts.map((gift) => <GiftCard key={gift.id} gift={gift} />)}{!gifts.length && <Empty text="Nenhum presente cadastrado." />}</section>
}

function GiftCard({ gift }) {
  const progress = gift.goalAmount ? Math.min(100, (gift.contributedAmount / gift.goalAmount) * 100) : 0
  return <article className="gift-card"><div className="gift-heading"><div><span className="gift-id">Presente #{gift.id}</span><h3>{gift.name}</h3></div><span className={`gift-status ${gift.isComplete ? 'complete' : gift.isReserved ? 'reserved' : 'available'}`}>{gift.isComplete ? 'Meta completa' : gift.isReserved ? 'Reservado' : 'Disponível'}</span></div>{gift.description && <p>{gift.description}</p>}<div className="progress-label"><span>{money.format(gift.contributedAmount)} arrecadado</span><span>{gift.goalAmount ? `meta ${money.format(gift.goalAmount)}` : 'sem meta'}</span></div>{gift.goalAmount > 0 && <div className="progress"><i style={{ width: `${progress}%` }} /></div>}<div className="gift-details">{gift.isReserved && <span><b>Reservado por</b>{gift.reservedBy}</span>}<span><b>Contribuições</b>{gift.contributions.length}</span></div>{gift.contributions.length > 0 && <details><summary>Ver contribuições</summary><div className="contributions">{gift.contributions.map((contribution) => <div className="contribution" key={contribution.id}><span>{contribution.contributorName}<small>{formatDate(contribution.createdAt)}</small></span><strong>{money.format(contribution.amount)}</strong></div>)}</div></details>}</article>
}

function RsvpRow({ rsvp }) {
  return <div className="mini-row"><span>{rsvp.guestName}<small>{rsvp.guestsCount} pessoa(s)</small></span><Status value={rsvp.attendance} /></div>
}

function Status({ value }) {
  return <span className={`status ${value.toLowerCase()}`}><i />{statusLabel(value)}</span>
}

function Panel({ title, action, children }) {
  return <article className="panel"><div className="panel-heading"><h2>{title}</h2>{action}</div>{children}</article>
}

function Empty({ text }) {
  return <p className="empty">{text}</p>
}

export default App
