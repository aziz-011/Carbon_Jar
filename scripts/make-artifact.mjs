// Transforme dist-artifact/index.html en contenu de page Artifact :
// le squelette <!doctype>/<html>/<head>/<body> est ajouté par la plateforme à la publication.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0].replace(/ crossorigin/g, ''));
const page = [
  '<title>Carbon Jar</title>',
  '<meta name="description" content="Portail client et espace cabinet pour le bilan carbone et le rapport ESG">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">',
  ...styles,
  '<div id="root"></div>',
  ...scripts,
].join('\n');
writeFileSync('dist-artifact/carbon-jar.html', page);
console.log(`dist-artifact/carbon-jar.html : ${(page.length / 1024).toFixed(0)} Ko, ${styles.length} style(s), ${scripts.length} script(s)`);
