import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type AreaPoint, AreaChart } from './area-chart';
import { type Bar, BarChart } from './bar-chart';

@Component({
  imports: [BarChart],
  template: '<th-bar-chart [bars]="bars()" [format]="usd" />',
})
class BarHost {
  readonly bars = signal<Bar[]>([]);
  readonly usd = (v: number): string => `$${String(v)}`;
}

describe('BarChart', () => {
  async function render(bars: Bar[]): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(BarHost);
    fixture.componentInstance.bars.set(bars);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }
  const heights = (el: HTMLElement): string[] =>
    [...el.querySelectorAll<HTMLElement>('.barchart__bar')].map((b) => b.style.height);

  it('sizes each bar relative to the largest value', async () => {
    const el = await render([
      { label: 'Sep', value: 50 },
      { label: 'Oct', value: 200, highlight: true },
    ]);
    expect(heights(el)).toEqual(['25%', '100%']);
    expect(el.querySelector('.barchart__bar--hl')?.parentElement?.textContent).toContain('Oct');
  });

  it('formats the value labels and the accessible summary', async () => {
    const el = await render([
      { label: 'Mon', value: 3 },
      { label: 'Tue', value: 7 },
    ]);
    expect([...el.querySelectorAll('.barchart__value')].map((v) => v.textContent)).toEqual([
      '$3',
      '$7',
    ]);
    const chart = el.querySelector('th-bar-chart');
    expect(chart?.getAttribute('role')).toBe('img');
    expect(chart?.getAttribute('aria-label')).toBe('Mon: $3, Tue: $7');
  });

  it('never draws a negative or NaN bar, and survives all-zero data', async () => {
    expect(
      heights(
        await render([
          { label: 'a', value: -5 },
          { label: 'b', value: 10 },
        ]),
      ),
    ).toEqual(['0%', '100%']);
    expect(
      heights(
        await render([
          { label: 'a', value: Number.NaN },
          { label: 'b', value: 4 },
        ]),
      ),
    ).toEqual(['0%', '100%']);
    expect(heights(await render([{ label: 'a', value: 0 }]))).toEqual(['0%']);
  });
});

@Component({
  imports: [AreaChart],
  template: `
    <svg th-area-chart [points]="points()"></svg>
    <svg th-area-chart [points]="points()"></svg>
  `,
})
class AreaHost {
  readonly points = signal<AreaPoint[]>([
    { label: 'Aug', value: 0 },
    { label: 'Sep', value: 5 },
    { label: 'Oct', value: 10 },
  ]);
}

describe('AreaChart', () => {
  async function render(): Promise<SVGSVGElement[]> {
    const fixture = TestBed.createComponent(AreaHost);
    await fixture.whenStable();
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<SVGSVGElement>('svg.areachart'),
    ];
  }

  it('is a real SVG with a case-sensitive viewBox', async () => {
    const [svg] = await render();
    expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 640 200');
    expect(svg?.viewBox.baseVal.width).toBe(640); // the browser actually parsed it
  });

  it('plots the points left to right, highest value at the top', async () => {
    const [svg] = await render();
    const dots = [...(svg?.querySelectorAll('circle') ?? [])].map((c) => [
      Number(c.getAttribute('cx')),
      Number(c.getAttribute('cy')),
    ]);
    // 24 px padding: x runs 24 → 616, y runs 176 (value 0) → 24 (max).
    expect(dots).toEqual([
      [24, 176],
      [320, 100],
      [616, 24],
    ]);
    expect([...(svg?.querySelectorAll('text') ?? [])].map((t) => t.textContent?.trim())).toEqual([
      'Aug',
      'Sep',
      'Oct',
    ]);
  });

  it('gives every chart its own gradient (React shared one fixed id)', async () => {
    const [a, b] = await render();
    const idA = a?.querySelector('linearGradient')?.id;
    const idB = b?.querySelector('linearGradient')?.id;
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB);
    expect(a?.querySelector('polygon')?.getAttribute('fill')).toBe(`url(#${String(idA)})`);
  });
});
