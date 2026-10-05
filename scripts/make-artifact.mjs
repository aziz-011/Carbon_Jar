// Transforme dist-artifact/index.html en contenu de page Artifact :
// le squelette <!doctype>/<html>/<head>/<body> est ajouté par la plateforme à la publication.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0].replace(/ crossorigin/g, ''));
const page = [
  '<title>Carbon Jar</title>',
  '<meta name="description" content="Comptabilité carbone et rapports ESG : documents, scopes, émissions, énergie, coûts et plan de réduction">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=Public+Sans:wght@400;600;700;800&display=swap">',
  ...styles,
  '<div id="root"></div>',
  ...scripts,
].join('\n');
writeFileSync('dist-artifact/carbon-jar.html', page);
console.log(`dist-artifact/carbon-jar.html : ${(page.length / 1024).toFixed(0)} Ko, ${styles.length} style(s), ${scripts.length} script(s)`);
