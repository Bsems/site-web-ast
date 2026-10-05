import { readFile, writeFile, rename } from 'node:fs/promises';
import { FfbbApi, importCalendar } from './ffbb-client.mjs';
import { exportCalendar } from './export-calendar.mjs';
const root = new URL('../', import.meta.url);
try {
  const config = JSON.parse(await readFile(new URL('data/ffbb-config.json', root), 'utf8'));
  const api = new FfbbApi({ baseUrl: config.baseUrl });
  const data = await importCalendar(api, config);
  const temporary = new URL('data/calendar.json.tmp', root);
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
  await rename(temporary, new URL('data/calendar.json', root));
  await exportCalendar(root);
  console.log(data.teams.length + ' teams, ' + data.matches.length + ' matches imported from FFBB API.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
