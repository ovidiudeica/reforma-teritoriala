#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const countries = {
  RO: { name: 'România', iso: 'RO', levels: [4, 8, 9] },
  MD: { name: 'Republica Moldova', iso: 'MD', levels: [4, 6, 8, 9] }
};

async function overpass(query) {
  let lastError;
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'reforma-teritoriala-import/0.1'
        },
        body: new URLSearchParams({ data: query })
      });
      if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function queryFor({ iso, levels }) {
  const filter = levels.map(level =>
    `relation(area.country)["boundary"="administrative"]["admin_level"="${level}"];`
  ).join('\n');
  return `[out:json][timeout:180];
area["ISO3166-1"="${iso}"]["boundary"="administrative"]->.country;
(
${filter}
);
out tags center;`;
}

function classify(country, tags = {}) {
  const level = Number(tags.admin_level);
  const place = tags.place || '';
  const designation = (tags.designation || '').toLowerCase();

  if (country === 'RO') {
    if (level === 4) return 'county';
    if (level === 9) return 'sector';
    if (level === 8 && place === 'city') return tags.population && Number(tags.population) > 100000 ? 'municipality_or_city' : 'city';
    if (level === 8 && (place === 'town')) return 'town';
    if (level === 8 && (place === 'village' || designation.includes('comun'))) return 'commune_or_local_uat';
    if (level === 8) return 'local_uat';
  }

  if (country === 'MD') {
    if (level === 4) return 'level_2_or_special_unit';
    if (level === 6) return 'intermediate_or_municipal_unit';
    if (level === 9) return 'sector_or_subdivision';
    if (level === 8 && place === 'town') return 'town';
    if (level === 8) return 'commune_village_or_local_uat';
  }
  return 'unclassified';
}

function entity(country, element) {
  const tags = element.tags || {};
  const type = classify(country, tags);
  return {
    id: `osm-r${element.id}`,
    name: tags['name:ro'] || tags.name || null,
    official_name: tags.official_name || null,
    jurisdiction: country,
    category: 'administrative',
    type,
    status: 'current',
    parent_id: null,
    osm: {
      element_type: 'relation',
      relation_id: element.id,
      admin_level: tags.admin_level ? Number(tags.admin_level) : null,
      boundary: tags.boundary || null,
      wikidata: tags.wikidata || null,
      wikipedia: tags.wikipedia || null
    },
    center: element.center ? [element.center.lon, element.center.lat] : null,
    source: 'OpenStreetMap',
    source_url: `https://www.openstreetmap.org/relation/${element.id}`,
    imported_at: new Date().toISOString(),
    review_required: type.includes('or_') || type === 'unclassified'
  };
}

async function main() {
  await mkdir('data/current', { recursive: true });
  const all = [];
  const report = { generated_at: new Date().toISOString(), countries: {}, warnings: [] };

  for (const [code, config] of Object.entries(countries)) {
    const raw = await overpass(queryFor(config));
    const entities = raw.elements
      .filter(x => x.type === 'relation')
      .map(x => entity(code, x))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ro'));

    all.push(...entities);
    report.countries[code] = {
      name: config.name,
      count: entities.length,
      by_admin_level: Object.groupBy
        ? Object.groupBy(entities, x => String(x.osm.admin_level))
        : entities.reduce((acc, x) => ((acc[x.osm.admin_level] ||= []).push(x), acc), {}),
      review_required: entities.filter(x => x.review_required).length
    };
  }

  const catalog = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: 'OpenStreetMap via Overpass API',
    license: 'ODbL',
    entity_count: all.length,
    entities: all
  };

  await writeFile('data/current/entities.json', JSON.stringify(catalog, null, 2) + '\n');
  await writeFile('data/current/import-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote ${all.length} entities to data/current/entities.json`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
