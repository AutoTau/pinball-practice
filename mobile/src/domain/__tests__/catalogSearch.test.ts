import { normalize, searchMachines, type SearchableMachine } from '@/domain/catalogSearch';

const m = (opdbId: string, name: string, extra: Partial<SearchableMachine> = {}): SearchableMachine => ({
  opdbId,
  name,
  shortName: null,
  year: 2021,
  retired: false,
  ...extra,
});

const catalog = [
  m('GweeP-MW95j', 'Godzilla (Pro)', { shortName: 'GZ' }),
  m('GweeP-Ml9pZ-ARZoY', 'Godzilla (Premium)', { shortName: 'GZ' }),
  m('G5po2-MeP6B', 'Godzilla', { year: 1998 }),
  m('G4do5-MDlN7', 'Attack from Mars', { year: 1995 }),
  m('GrXzD-MjBPX', 'Twilight Zone', { year: 1993 }),
  m('Gold-1', 'Old Retired Game', { retired: true }),
];

const names = (query: string) => searchMachines(catalog, query).map((x) => x.name);

describe('searchMachines', () => {
  it('normalizes case, accents and punctuation', () => {
    expect(normalize("  Attack  From Mars! ")).toBe('attack from mars');
    expect(normalize('Pokémon')).toBe('pokemon');
  });

  it('finds titles despite typos, newest first', () => {
    expect(names('godzila')).toEqual(['Godzilla (Premium)', 'Godzilla (Pro)', 'Godzilla']);
  });

  it('matches short names exactly', () => {
    expect(names('gz')).toEqual(['Godzilla (Premium)', 'Godzilla (Pro)']);
  });

  it('matches a word inside the name', () => {
    expect(names('mars')).toEqual(['Attack from Mars']);
  });

  it('hides retired machines and ignores one-letter queries', () => {
    expect(names('old retired')).toEqual([]);
    expect(names('g')).toEqual([]);
  });

  it('drops unrelated titles', () => {
    expect(names('twilight zone')).toEqual(['Twilight Zone']);
  });
});
