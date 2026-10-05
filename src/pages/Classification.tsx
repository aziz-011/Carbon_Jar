import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Callout, Card, PageHead, ScopeBadge } from '../components/ui';
import { SCOPE_LABELS, categoriesOfScope, getCategory } from '../data/categories';
import type { Scope } from '../domain/types';
import { DECISION_TREE, classify, type DecisionOutcome } from '../lib/classifier';
import { useStore } from '../state/store';

export function Classification() {
  return (
    <div className="stack">
      <PageHead
        title="Classer les émissions en scopes"
        intro="La question clé : qui possède ou contrôle physiquement la source d’émission, et l’émission résulte-t-elle d’un achat d’énergie ? Utilisez l’assistant pas à pas ou testez un libellé."
      />
      <div className="grid g2">
        <DecisionWizard />
        <TextClassifier />
      </div>
      <div className="grid g3">
        {([1, 2, 3] as Scope[]).map((s) => (
          <Card key={s} title={<h3><ScopeBadge scope={s} /> {SCOPE_LABELS[s].title.split('—')[1]}</h3>}>
            <p className="muted small">{SCOPE_LABELS[s].description}</p>
            <ul className="clean small">
              {categoriesOfScope(s).map((c) => (
                <li key={c.id}>
                  <strong>{c.label}</strong> — {c.description}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DecisionWizard() {
  const [path, setPath] = useState<Array<{ node: string; choice: string }>>([]);
  const [outcome, setOutcome] = useState<DecisionOutcome>();
  const current = path.length === 0 ? 'start' : undefined;
  const nodeId = outcome ? undefined : current ?? nextNode(path);
  const node = nodeId ? DECISION_TREE[nodeId] : undefined;

  function nextNode(p: typeof path): string {
    const last = p[p.length - 1];
    const n = DECISION_TREE[last.node];
    return n.options.find((o) => o.label === last.choice)?.next ?? 'start';
  }

  const choose = (label: string) => {
    if (!node) return;
    const opt = node.options.find((o) => o.label === label)!;
    setPath((p) => [...p, { node: node.id, choice: label }]);
    if (opt.outcome) setOutcome(opt.outcome);
  };

  const reset = () => {
    setPath([]);
    setOutcome(undefined);
  };

  return (
    <Card title="Assistant de classification" actions={path.length > 0 && <button onClick={reset}>Recommencer</button>}>
      {path.length > 0 && (
        <ol className="small muted" style={{ paddingLeft: '1.2rem' }}>
          {path.map((p, i) => (
            <li key={i}>
              {DECISION_TREE[p.node].question} <strong>→ {p.choice}</strong>
            </li>
          ))}
        </ol>
      )}
      {node && (
        <>
          <h3>{node.question}</h3>
          {node.help && <p className="small muted">{node.help}</p>}
          {node.options.map((o) => (
            <button key={o.label} className="tree-option" onClick={() => choose(o.label)}>
              {o.label}
            </button>
          ))}
        </>
      )}
      {outcome && (
        <Callout tone="key" title={outcome.title}>
          <div className="row" style={{ margin: '4px 0 8px' }}>
            <ScopeBadge scope={outcome.scope} />
            {outcome.category && <span className="small">{getCategory(outcome.category).label}</span>}
          </div>
          {outcome.explanation}
          {typeof outcome.scope === 'number' && (
            <div style={{ marginTop: 8 }}>
              <Link to="/donnees">Saisir une donnée dans cette catégorie →</Link>
            </div>
          )}
        </Callout>
      )}
    </Card>
  );
}

const EXAMPLES = [
  'Facture gaz naturel chaudière',
  'Gazole camions de livraison',
  'Recharge climatisation R-410A',
  'Électricité EDF bureaux',
  'Recharge des véhicules électriques de la flotte',
  'Transporteur externe livraison clients',
  'Billets avion séminaire',
  'Achat acier',
  'Trajets domicile travail des salariés',
  'Granulés bois chaufferie',
];

function TextClassifier() {
  const { factors } = useStore();
  const [text, setText] = useState('');
  const result = text.trim() ? classify(text, factors) : undefined;
  return (
    <Card title="Tester un libellé">
      <p className="small muted">Le moteur reconnaît les mots-clés usuels (factures, ERP, notes de frais) et applique les règles de frontière entre scopes.</p>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : Facture fioul chaudière atelier" />
      <div className="row small" style={{ margin: '8px 0 12px' }}>
        {EXAMPLES.map((e) => (
          <button key={e} className="ghost small" onClick={() => setText(e)} style={{ border: '1px solid var(--border)' }}>
            {e}
          </button>
        ))}
      </div>
      {result && (
        <>
          {result.best ? (
            <Callout tone="key" title={result.best.factor.label}>
              <div className="row" style={{ margin: '4px 0' }}>
                <ScopeBadge scope={result.scope!} />
                <span className="small">{getCategory(result.category!).label}</span>
                <span className={`badge ${result.confidence >= 0.6 ? 'ok' : 'warn'}`}>confiance {Math.round(result.confidence * 100)} %</span>
              </div>
              <div className="small">{result.explanation}</div>
              <div className="small muted">Unité attendue : {result.best.factor.unit}</div>
            </Callout>
          ) : (
            <Callout tone="warn">{result.explanation}</Callout>
          )}
          {result.alternatives.length > 0 && (
            <>
              <div className="small muted">Autres possibilités :</div>
              <ul className="clean small">
                {result.alternatives.map((a) => (
                  <li key={a.factor.id}>
                    <ScopeBadge scope={getCategory(a.factor.category).scope} /> {a.factor.label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Card>
  );
}
