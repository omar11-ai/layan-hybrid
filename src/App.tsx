// LAYAN Hybrid — operator dashboard.
//
// Three panels: the live engagement, the live indicator panel, and the
// evidence pack. The status strip at the top is honest about where each
// reply came from: on-device model, cloud model, or the offline script.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ARCHETYPES,
  ARCHETYPE_IDS,
  PERSONA,
} from './engine/archetypes';
import { IOC_LABELS } from './engine/extractor';
import { Session, buildPersonaPrompt, type Message } from './engine/session';
import {
  cleanReply,
  generateHybridReply,
  initializeDeviceModel,
  probeOnDeviceAvailability,
} from './ai';
import { ensureSignedIn, loadRemoteConfig } from './firebase';
import { saveSession } from './cloud';

type EngineStatus = 'idle' | 'running' | 'ended';

interface Stats {
  engagements: number;
  minutes: number;
  iocs: number;
}

export default function App() {
  const [archetype, setArchetype] = useState<string>('poslaju');
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [iocs, setIocs] = useState<Session['iocs']>([]);
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ReturnType<Session['report']> | null>(null);
  const [deviceAvail, setDeviceAvail] = useState<string>('probing');
  const [lastSource, setLastSource] = useState<string>('—');
  const [downloadPct, setDownloadPct] = useState<number>(0);
  const [cloudNote, setCloudNote] = useState('');
  const [stats, setStats] = useState<Stats>({ engagements: 0, minutes: 0, iocs: 0 });
  const [online, setOnline] = useState(navigator.onLine);
  const chatRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<EngineStatus>('idle');
  statusRef.current = status;

  // ------------------------------------------------------------- bootstrap
  useEffect(() => {
    ensureSignedIn().catch(() => undefined);
    loadRemoteConfig().catch(() => undefined);
    probeOnDeviceAvailability().then(setDeviceAvail);
    const onDl = (e: Event) =>
      setDownloadPct((e as CustomEvent<number>).detail);
    window.addEventListener('layan:device-download', onDl);
    const onNet = () => setOnline(navigator.onLine);
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    return () => {
      window.removeEventListener('layan:device-download', onDl);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    };
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // --------------------------------------------------------------- actions
  const start = useCallback(() => {
    const id = `S${Date.now().toString().slice(-6)}`;
    const s = new Session(id, archetype);
    setSession(s);
    setMessages([]);
    setIocs([]);
    setReport(null);
    setStatus('running');
    setStats((p) => ({ ...p, engagements: p.engagements + 1 }));
    // The on-device model can only start after a user gesture.
    initializeDeviceModel();
  }, [archetype]);

  const advance = useCallback(async () => {
    if (!session || busy || status !== 'running') return;
    setBusy(true);
    try {
      const result = await session.step(async (intent, scammerLine) => {
        const prompt = buildPersonaPrompt(intent, scammerLine);
        try {
          const r = await generateHybridReply(prompt);
          const text = cleanReply(r.text);
          setLastSource(r.source === 'ON_DEVICE' ? 'on-device model' : 'cloud model');
          setCloudNote(
            r.source === 'ON_DEVICE'
              ? 'Ran locally on this device — no request left the machine.'
              : 'On-device model unavailable; Firebase AI Logic used the cloud model.',
          );
          return { text, source: r.source, minutes: r.minutes };
        } catch (err) {
          console.warn('[layan] model failed, using offline script', err);
          setLastSource('offline script');
          setCloudNote(
            'No model available (device or network). Using the deterministic offline script.',
          );
          return session.scriptedReply(intent);
        }
      });

      const snap = session.snapshot();
      setMessages(snap.transcript);
      setIocs(snap.iocs);
      // Durability: the evidence path is cloud-backed, so the session and its
      // indicator timeline survive the device dying mid-engagement.
      void saveSession(snap);
      setStats((p) => ({
        engagements: p.engagements,
        minutes: p.minutes + result.minutes,
        iocs: p.iocs + result.iocsNew.length,
      }));
      if (result.done) setStatus('ended');
    } finally {
      setBusy(false);
    }
  }, [session, busy, status]);

  const makeReport = useCallback(() => {
    if (!session) return;
    setReport(session.report());
  }, [session]);

  const autoRun = useCallback(async () => {
    // Read through a helper so the compiler does not narrow the ref across
    // the awaits - the status really can change while we are waiting.
    const currentStatus = () => statusRef.current;
    if (!session || currentStatus() !== 'running') return;
    for (let i = 0; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await advance();
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 900));
      if (currentStatus() === 'ended') break;
    }
  }, [advance, session]);

  // -------------------------------------------------------------- rendering
  const spec = ARCHETYPES[archetype];
  const sourceLabel = useMemo(() => {
    if (lastSource === 'on-device model') return 'ON-DEVICE';
    if (lastSource === 'cloud model') return 'CLOUD';
    if (lastSource === 'offline script') return 'OFFLINE SCRIPT';
    return '—';
  }, [lastSource]);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="logo">LAYAN</span>
          <span className="tag">scam jammer · hybrid inference</span>
        </div>
        <div className="statuses">
          <span className={`pill ${sourceLabel === 'ON-DEVICE' ? 'good' : 'idle'}`}>
            reply source: {sourceLabel}
          </span>
          <span className={`pill ${deviceAvail === 'available' ? 'good' : 'warn'}`}>
            on-device model: {deviceAvail}
          </span>
          <span className={`pill ${online ? 'good' : 'warn'}`}>
            network: {online ? 'online' : 'offline'}
          </span>
        </div>
      </header>

      {deviceAvail !== 'available' && downloadPct > 0 && downloadPct < 1 && (
        <div className="banner">
          Downloading the on-device model… {Math.round(downloadPct * 100)}%. Until it
          finishes, replies fall back to the cloud model.
        </div>
      )}

      <section className="stats">
        <div className="stat">
          <b>{stats.engagements}</b>
          <span>engagements</span>
        </div>
        <div className="stat hot">
          <b>{stats.minutes}</b>
          <span>scammer minutes burned</span>
        </div>
        <div className="stat gold">
          <b>{stats.iocs}</b>
          <span>evidence harvested</span>
        </div>
      </section>

      <section className="grid">
        <div className="card archetypes">
          <h3>Scam archetype</h3>
          <p className="hint">
            LAYAN recognises the script fingerprint and picks a persona that matches
            what the scammer expects to hear.
          </p>
          <div className="chips">
            {ARCHETYPE_IDS.map((id) => (
              <button
                key={id}
                className={`chip ${id === archetype ? 'on' : ''}`}
                onClick={() => setArchetype(id)}
                disabled={status === 'running'}
              >
                {ARCHETYPES[id].label}
              </button>
            ))}
          </div>
          <div className="persona">
            <h4>Persona</h4>
            <p>
              <b>{PERSONA.name}</b>, {PERSONA.age} — {PERSONA.occupation},{' '}
              {PERSONA.location}.
            </p>
            <p className="muted">
              Fingerprint <code>{spec.fingerprint}</code>
            </p>
          </div>
        </div>

        <div className="card chat-card">
          <div className="chat-head">
            <span className="dot" />
            Live engagement — {spec.label}
          </div>
          <div className="chat" ref={chatRef}>
            {messages.length === 0 && (
              <div className="sys">Pick an archetype and press Start engagement.</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.who}`}>
                <span className="who">
                  {m.who === 'scammer' ? 'SCAMMER' : m.who === 'jammer' ? 'P. RINA' : 'SYS'}
                </span>
                <span className="text">{m.text}</span>
                <span className="meta">
                  {m.tMin}m{m.source ? ` · ${m.source}` : ''}
                </span>
              </div>
            ))}
          </div>
          <div className="meter">
            Turn <b>{session?.snapshot().turn ?? 0}</b> ·{' '}
            <b>{session?.snapshot().minutes ?? 0} min</b> burned
          </div>
          <div className="controls">
            {!session || status === 'idle' ? (
              <button className="primary" onClick={start}>
                ▶ Start engagement
              </button>
            ) : (
              <>
                <button className="primary" onClick={advance} disabled={busy || status === 'ended'}>
                  {busy ? 'Thinking…' : 'Next message →'}
                </button>
                <button onClick={autoRun} disabled={busy || status === 'ended'}>
                  Auto ▶
                </button>
                <button
                  className="report"
                  onClick={makeReport}
                  disabled={iocs.length === 0}
                >
                  📄 Generate police evidence pack
                </button>
              </>
            )}
          </div>
          {cloudNote && <p className="note">{cloudNote}</p>}
        </div>

        <div className="card ioc-card">
          <h3>Indicators of compromise</h3>
          {iocs.length === 0 ? (
            <div className="empty">
              Nothing yet — the scammer hasn't shown their hand.
            </div>
          ) : (
            <ul className="iocs">
              {iocs.map((ioc, i) => (
                <li key={i}>
                  <span className="kind">{IOC_LABELS[ioc.type]}</span>
                  <span className="val">{ioc.value}</span>
                  {ioc.bank ? <span className="bank">{ioc.bank}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {report && (
        <div className="overlay" onClick={() => setReport(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Police evidence pack</h2>
            <p className="muted">
              {report.case_type} · {report.script_fingerprint} ·{' '}
              {report.engagement.turns} turns · {report.engagement.scammer_minutes_burned}{' '}
              minutes burned
            </p>
            <h4>Recommended actions</h4>
            <ol>
              {report.recommended_actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
            <h4>Indicators</h4>
            <pre>{JSON.stringify(report.indicators, null, 2)}</pre>
            <div className="modal-actions">
              <button onClick={() => setReport(null)}>Close</button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
                }}
              >
                Copy JSON
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        The scammer side is a scripted simulator of real Malaysian scam archetypes —
        fully offline, deterministic under a seed, and safe to interact with.
      </footer>
    </div>
  );
}
