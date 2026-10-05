import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Callout, Card, Formula, PageHead } from '../components/ui';
import { GLOSSARY, KNOWLEDGE, type Block, type Section } from '../data/knowledge';

const GROUPS: Section['group'][] = ['Fondamentaux', 'Périmètres & scopes', 'Calcul & données', 'Pilotage & reporting', 'Réglementation & méthodes'];

function renderBlock(b: Block, i: number) {
  switch (b.kind) {
    case 'p':
      return <p key={i}>{b.text}</p>;
    case 'h':
      return <h3 key={i} style={{ marginTop: 16 }}>{b.text}</h3>;
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className="clean">
          {b.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <div key={i} className="table-wrap" style={{ marginBottom: 12 }}>
          <table>
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k}>{k === 0 ? <strong>{c}</strong> : c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'formula':
      return <Formula key={i} label={b.label} formula={b.formula} note={b.note} />;
    case 'callout':
      return (
        <Callout key={i} tone={b.tone} title={b.title}>
          {b.text}
        </Callout>
      );
  }
}

export function Guide() {
  const { id } = useParams();
  const section = KNOWLEDGE.find((s) => s.id === id);

  return (
    <div className="stack">
      <PageHead eyebrow="Ressources" icon="book" title="Guide du bilan carbone" intro="Les notions, règles et formules du GHG Protocol, de la CSRD et de l’ACV, extraites des documents de référence." />
      <div className="guide">
        <nav>
          <Link to="/guide" className={!section ? 'active' : ''}>Vue d’ensemble</Link>
          {GROUPS.map((g) => (
            <Fragment key={g}>
              <div className="nav-group">{g}</div>
              {KNOWLEDGE.filter((s) => s.group === g).map((s) => (
                <Link key={s.id} to={`/guide/${s.id}`} className={s.id === id ? 'active' : ''}>
                  {s.title}
                </Link>
              ))}
            </Fragment>
          ))}
        </nav>
        <article>
          {section ? (
            <Card title={section.title}>
              <p className="muted">{section.summary}</p>
              {section.blocks.map(renderBlock)}
              <div className="row" style={{ marginTop: 16 }}>
                {(() => {
                  const idx = KNOWLEDGE.indexOf(section);
                  const prev = KNOWLEDGE[idx - 1];
                  const next = KNOWLEDGE[idx + 1];
                  return (
                    <>
                      {prev && <Link to={`/guide/${prev.id}`}>← {prev.title}</Link>}
                      <span className="spacer" />
                      {next && <Link to={`/guide/${next.id}`}>{next.title} →</Link>}
                    </>
                  );
                })()}
              </div>
            </Card>
          ) : (
            <>
              <div className="grid g2">
                {KNOWLEDGE.map((s) => (
                  <Link key={s.id} to={`/guide/${s.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="small muted">{s.group}</div>
                    <h3>{s.title}</h3>
                    <p className="small muted" style={{ margin: 0 }}>{s.summary}</p>
                  </Link>
                ))}
              </div>
              <Card icon="calculator" title="Formules essentielles">
                {KNOWLEDGE.flatMap((s) => s.blocks.filter((b): b is Extract<Block, { kind: 'formula' }> => b.kind === 'formula')).map((b, i) => (
                  <Formula key={i} label={b.label} formula={b.formula} note={b.note} />
                ))}
              </Card>
              <Card icon="book" title="Glossaire">
                <table>
                  <tbody>
                    {GLOSSARY.map(([t, d]) => (
                      <tr key={t}>
                        <td className="nowrap"><strong>{t}</strong></td>
                        <td>{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
