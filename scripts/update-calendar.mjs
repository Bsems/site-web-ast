/**
 * Point d'entrée de l'actualisation FFBB : node scripts/update-calendar.mjs.
 * Python récupère et valide les données ; ce lanceur publie le JSON local puis
 * appelle exportCalendar pour le navigateur. Les erreurs donnent un code non nul.
 */
import { writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { exportCalendar } from './export-calendar.mjs';
const root = new URL('../', import.meta.url);
try {
  // Priorité : FFBB_PYTHON, environnement .venv du projet, puis python du PATH.
  const localPython = fileURLToPath(new URL(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python', root));
  const python = process.env.FFBB_PYTHON || (existsSync(localPython) ? localPython : 'python');
  /*
   * execFile transmet les chemins sans shell, y compris avec des espaces.
   * stdout doit contenir uniquement le JSON ; les diagnostics Python vont sur stderr.
   * UTF-8 est explicite sous Windows ; l'import est limité à 12 min et 20 Mio.
   */
  const { stdout } = await promisify(execFile)(python, [fileURLToPath(new URL('scripts/ffbb_import.py', root))], {
    cwd: fileURLToPath(root), env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 20 * 1024 * 1024, timeout: 12 * 60 * 1000,
  });
  const data = JSON.parse(stdout);
  if (!data.matches?.length || !data.teams?.length || data.client !== 'ffbb-api-client-v2') throw new Error('Import FFBB invalide.');
  /*
   * Ne remplacer le JSON qu'après la réussite complète du processus Python.
   * Le renommage protège ce fichier, mais les trois sorties ne forment pas une
   * transaction : si l'export suivant échoue, le JSON peut déjà être actualisé.
   */
  const temporary = new URL('data/calendar.json.tmp', root);
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
  await rename(temporary, new URL('data/calendar.json', root));
  await exportCalendar(root);
  console.log(`${data.teams.length} engagements, ${data.matches.length} rencontres, ${data.matches.filter(m => m.played).length} résultats importés via ffbb-api-client-v2.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
