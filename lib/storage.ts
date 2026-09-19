import { initialState, seedPoints, demoCooperative, type AppState, type Point } from './model.ts';
import { isCoordinate } from './geo.ts';
export const STORAGE_KEY = 'reciclamapa-v1'; // Preserve the original key and all existing records.
function validPoint(p: Point) { return p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.region === 'string' && typeof p.address === 'string' && typeof p.material === 'string' && typeof p.frequency === 'string' && Number.isFinite(p.kg) && p.kg > 0 && isCoordinate(p) && ['available','collected'].includes(p.status); }
export function migrateState(state: AppState): AppState {
  if (![1,2].includes(state.version) || !state.validation) throw new Error('Dados locais incompatíveis. Seus dados armazenados foram preservados.');
  for (const mode of ['registered','simulated'] as const) {
    const w = state[mode];
    if (!w || !Array.isArray(w.points) || !w.points.every(p => validPoint(p) && p.source === mode) || !Array.isArray(w.collections) || !w.collections.every(c => Array.isArray(c.points) && c.points.every(validPoint) && Number.isFinite(c.kg)) || (w.plan !== null && (!Array.isArray(w.plan.ids) || !Array.isArray(w.plan.originalIds)))) throw new Error('Não foi possível ler os dados locais. O armazenamento original foi preservado.');
    if (w.cooperative && (!isCoordinate(w.cooperative) || !Array.isArray(w.cooperative.acceptedMaterials) || !Number.isFinite(w.cooperative.radiusKm))) throw new Error('Configuração local de cooperativa inválida. Dados preservados.');
  }
  if (state.version === 2) return state;
  const migrated = structuredClone(state), seeds = seedPoints();
  migrated.version = 2;
  for (const mode of ['registered','simulated'] as const) {
    migrated[mode].points = migrated[mode].points.map(p => {
      const seed = mode === 'simulated' ? seeds.find(s => s.id === p.id) : undefined;
      return {...p,...(seed ? {lat:seed.lat,lng:seed.lng,city:seed.city,state:seed.state,address:seed.address} : {}),coordinateKind:mode === 'simulated' ? 'demonstrative' : p.coordinateKind,locationConfirmed:mode === 'simulated' || p.coordinateKind === 'registered'};
    });
    migrated[mode].cooperative ??= mode === 'simulated' ? demoCooperative() : null;
    const plan = migrated[mode].plan;
    if (plan) { plan.optimized = false; delete plan.comparison; }
  }
  migrated.migrationNotice = migrated.registered.points.some(p => !p.locationConfirmed);
  return migrated;
}
export const repository = {
  load(): AppState {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const previous = JSON.parse(raw) as AppState;
    const state = migrateState(previous);
    if (previous.version === 1 && !localStorage.getItem('reciclamapa-backup-before-v2')) localStorage.setItem('reciclamapa-backup-before-v2', raw);
    return state;
  },
  save(state: AppState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
};
