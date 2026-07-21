import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dxf = `0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
Walls
62
7
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
5
line-1
8
Walls
10
0
20
0
11
10
21
0
0
TEXT
5
text-1
8
Walls
10
1
20
1
1
Door Label
0
ENDSEC
0
`;

test('Open DXF → render drawing → toggle layer → select entity', async ({ page }) => {
  await page.goto('/');
  const path = join(tmpdir(), 'cad-viewer-e2e.dxf');
  await writeFile(path, dxf, 'utf8');
  await page.getByLabel('Open ASCII DXF').setInputFiles(path);
  await expect(page.getByText('cad-viewer-e2e.dxf')).toBeVisible();
  await expect(page.getByText('Walls')).toBeVisible();
  await page.getByLabel('Layer panel').getByRole('checkbox').uncheck();
  await page.getByLabel('Layer panel').getByRole('checkbox').check();
  await page.getByRole('button', { name: /text-1 · text/ }).click();
  await expect(page.getByText('Door Label')).toBeVisible();
});
