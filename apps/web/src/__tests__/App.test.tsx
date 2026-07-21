import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
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
LAYER
2
Labels
62
3
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
Labels
10
1
20
1
1
Door Label
0
SPLINE
8
Other
0
ENDSEC
0
`;

afterEach(() => cleanup());

beforeEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, value: 600 });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, toJSON: () => ({}) }));
});

describe('CAD Viewer MVP', () => {
  it('loads a DXF file and displays statistics, warnings, layers and entities', async () => {
    render(<App />);
    const file = new File([dxf], 'fixture.dxf', { type: 'application/dxf' });
    await userEvent.upload(screen.getByLabelText('Open ASCII DXF'), file);

    expect(await screen.findByText('fixture.dxf')).toBeInTheDocument();
    expect(screen.getByText('2', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Unsupported DXF entity ignored: SPLINE')).toBeInTheDocument();
    expect(screen.getByText('Walls')).toBeInTheDocument();
    expect(screen.getByText('Labels')).toBeInTheDocument();
  });

  it('supports layer search and visibility toggling', async () => {
    render(<App />);
    await userEvent.upload(screen.getByLabelText('Open ASCII DXF'), new File([dxf], 'fixture.dxf'));
    await screen.findByText('Walls');

    await userEvent.type(screen.getByLabelText('Search layers'), 'lab');
    expect(screen.queryByText('Walls')).not.toBeInTheDocument();
    expect(screen.getByText('Labels')).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(checkbox).toBeChecked();
  });

  it('supports entity search, selection and property display', async () => {
    render(<App />);
    await userEvent.upload(screen.getByLabelText('Open ASCII DXF'), new File([dxf], 'fixture.dxf'));
    await screen.findByText('text-1 · text');

    await userEvent.type(screen.getByLabelText('Search entities'), 'door');
    expect(screen.getByText('text-1 · text')).toBeInTheDocument();
    await userEvent.click(screen.getByText('text-1 · text'));
    expect(screen.getByText('Door Label')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('handles mobile-style pointer pan gestures on the viewport', async () => {
    render(<App />);
    await userEvent.upload(screen.getByLabelText('Open ASCII DXF'), new File([dxf], 'fixture.dxf'));
    const canvas = await screen.findByLabelText('CAD drawing canvas');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 130, clientY: 110 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 130, clientY: 110 });
    await waitFor(() => expect(canvas).toBeInTheDocument());
  });
});
