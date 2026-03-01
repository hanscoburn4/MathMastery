import type { DifficultyLevel } from '../types/database';

/**
 * Determines which lower difficulty levels should be backfilled
 * when a mastery mark is given at a higher level.
 *
 * @param level - The level where the mastery mark was given
 * @returns Array of lower levels that should be backfilled
 */
export function getLevelsToBackfill(level: DifficultyLevel): DifficultyLevel[] {
  if (level === 'advanced') {
    return ['intermediate', 'basic'];
  } else if (level === 'intermediate') {
    return ['basic'];
  }
  return [];
}
