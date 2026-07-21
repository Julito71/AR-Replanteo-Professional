import type { Project } from '@ar-replanteo/cad-engine';
import { describe, expect, it } from 'vitest';
import { entityProperties, layersWithCounts, searchEntities, searchLayers } from '../services/project';

const project: Project = {
  id: 'p',
  name: 'Project',
  units: 'millimeters',
  layers: [{ id: 'Walls', name: 'Walls', visible: true }, { id: 'Labels', name: 'Labels', visible: true }],
  entities: [
    { id: 'line-1', kind: 'line', layerId: 'Walls', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, color: 1 },
    { id: 'text-1', kind: 'text', layerId: 'Labels', position: { x: 2, y: 3 }, value: 'Door A' },
  ],
  blocks: [],
};

describe('project view models', () => {
  it('counts and searches layers', () => {
    const layers = layersWithCounts(project);
    expect(layers.find((layer) => layer.id === 'Walls')?.entityCount).toBe(1);
    expect(searchLayers(layers, 'lab')).toHaveLength(1);
  });

  it('searches entities by stable id and text content', () => {
    expect(searchEntities(project, 'line-1')).toHaveLength(1);
    expect(searchEntities(project, 'door')).toHaveLength(1);
  });

  it('formats selected entity properties', () => {
    expect(entityProperties(project.entities[0])).toEqual(expect.arrayContaining([['ID', 'line-1'], ['Type', 'line'], ['Layer', 'Walls'], ['Color', '1']]));
  });
});
