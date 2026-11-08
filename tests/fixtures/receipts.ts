/**
 * Synthetic receipt definitions.
 *
 * Each fixture pairs the rendered receipt with the values a correct parse
 * should produce, so the same data drives two different jobs:
 *   - Playwright E2E, where `expected` is mocked as the parse-receipt response
 *   - Eval runs later, where `expected` is the ground truth the real model is
 *     scored against
 *
 * The set deliberately covers the cases the prompt calls out: comma decimals,
 * separate quantity rows, negative discount lines, a printed total that does
 * NOT equal the sum of items, and ambiguous DD/MM vs MM/DD dates.
 */

export interface ExpectedItem {
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface ExpectedParse {
  date: string
  amount: number
  currency: string
  store_name: string
  category: string
  items: ExpectedItem[]
}

export interface ReceiptFixture {
  /** File-safe id; becomes <id>.png in tests/fixtures/images/ */
  id: string
  /** What this fixture is designed to catch. */
  tests: string
  html: string
  expected: ExpectedParse
}

const STYLE = `
  @font-face { font-family: 'ReceiptMono'; src: local('Courier New'); }
  body { margin: 0; background: #f4f4f0; }
  .receipt {
    width: 360px; padding: 22px 20px 34px; background: #fffef8;
    font-family: 'Courier New', monospace; font-size: 13px; color: #1a1a1a;
    line-height: 1.5;
  }
  .center { text-align: center; }
  .store { font-size: 17px; font-weight: bold; letter-spacing: 1px; }
  .rule { border-top: 1px dashed #555; margin: 9px 0; }
  .row { display: flex; justify-content: space-between; }
  .qty { padding-left: 14px; color: #333; }
  .total { font-weight: bold; font-size: 15px; }
  .small { font-size: 11px; color: #444; }
`

/** Groceries, comma decimals, separate quantity rows, a weighed item. */
const mercadona: ReceiptFixture = {
  id: 'mercadona-groceries',
  tests: 'comma decimals, "2 x 1,50" quantity rows, kg-priced item',
  html: `
    <div class="receipt">
      <div class="center store">MERCADONA</div>
      <div class="center small">C/ Gran Via 42, Madrid<br/>NIF A-46103834</div>
      <div class="rule"></div>
      <div class="row"><span>14/03/2026</span><span>12:47</span></div>
      <div class="rule"></div>
      <div class="row"><span>LECHE ENTERA 1L</span><span>3,00</span></div>
      <div class="qty small">2 x 1,50</div>
      <div class="row"><span>PAN RUSTICO</span><span>1,25</span></div>
      <div class="row"><span>TOMATE PERA</span><span>2,73</span></div>
      <div class="qty small">0,684 kg x 3,99</div>
      <div class="row"><span>ACEITE OLIVA 1L</span><span>8,45</span></div>
      <div class="rule"></div>
      <div class="row total"><span>TOTAL</span><span>15,43</span></div>
      <div class="row small"><span>TARJETA</span><span>15,43</span></div>
    </div>`,
  expected: {
    date: '2026-03-14',
    amount: 15.43,
    currency: 'EUR',
    store_name: 'Mercadona',
    category: 'Groceries',
    items: [
      { description: 'LECHE ENTERA 1L', quantity: 2, unit_price: 1.5, total_price: 3.0 },
      { description: 'PAN RUSTICO', quantity: 1, unit_price: 1.25, total_price: 1.25 },
      { description: 'TOMATE PERA', quantity: 0.684, unit_price: 3.99, total_price: 2.73 },
      { description: 'ACEITE OLIVA 1L', quantity: 1, unit_price: 8.45, total_price: 8.45 },
    ],
  },
}

/** Printed total exceeds the item sum (tax + deposit) — must not be "corrected". */
const pharmacy: ReceiptFixture = {
  id: 'pharmacy-tax-gap',
  tests: 'printed total > sum of items; CHANGE line must not be read as total',
  html: `
    <div class="receipt">
      <div class="center store">FARMACIA CENTRAL</div>
      <div class="center small">Calle Mayor 8 - Valencia</div>
      <div class="rule"></div>
      <div class="row"><span>Fecha: 02/11/2026</span></div>
      <div class="rule"></div>
      <div class="row"><span>IBUPROFENO 600MG</span><span>4,20</span></div>
      <div class="row"><span>VITAMINA D3</span><span>11,90</span></div>
      <div class="rule"></div>
      <div class="row small"><span>SUBTOTAL</span><span>16,10</span></div>
      <div class="row small"><span>IVA 4%</span><span>0,64</span></div>
      <div class="row total"><span>TOTAL</span><span>16,74</span></div>
      <div class="row small"><span>EFECTIVO</span><span>20,00</span></div>
      <div class="row small"><span>CAMBIO</span><span>3,26</span></div>
    </div>`,
  expected: {
    date: '2026-11-02',
    amount: 16.74,
    currency: 'EUR',
    store_name: 'Farmacia Central',
    category: 'Pharmacy & Health',
    items: [
      { description: 'IBUPROFENO 600MG', quantity: 1, unit_price: 4.2, total_price: 4.2 },
      { description: 'VITAMINA D3', quantity: 1, unit_price: 11.9, total_price: 11.9 },
    ],
  },
}

/** Negative discount line + USD, so currency isn't assumed to be EUR. */
const diner: ReceiptFixture = {
  id: 'diner-usd-discount',
  tests: 'USD currency, negative discount line, MM/DD date order',
  html: `
    <div class="receipt">
      <div class="center store">CORNER DINER</div>
      <div class="center small">114 W 23rd St, New York NY</div>
      <div class="rule"></div>
      <div class="row"><span>03/14/2026</span><span>08:12 AM</span></div>
      <div class="rule"></div>
      <div class="row"><span>PANCAKE STACK</span><span>$12.00</span></div>
      <div class="row"><span>COFFEE</span><span>$7.00</span></div>
      <div class="qty small">2 x $3.50</div>
      <div class="row"><span>LOYALTY -10%</span><span>-$1.90</span></div>
      <div class="rule"></div>
      <div class="row total"><span>AMOUNT DUE</span><span>$17.10</span></div>
    </div>`,
  expected: {
    date: '2026-03-14',
    amount: 17.1,
    currency: 'USD',
    store_name: 'Corner Diner',
    category: 'Dining & Restaurants',
    items: [
      { description: 'PANCAKE STACK', quantity: 1, unit_price: 12.0, total_price: 12.0 },
      { description: 'COFFEE', quantity: 2, unit_price: 3.5, total_price: 7.0 },
      { description: 'LOYALTY -10%', quantity: 1, unit_price: -1.9, total_price: -1.9 },
    ],
  },
}

/** Faded, low-contrast thermal print — the "is it really unreadable?" case. */
const fadedFuel: ReceiptFixture = {
  id: 'fuel-faded',
  tests: 'low-contrast faded thermal print; must still be read, not rejected',
  html: `
    <div class="receipt" style="color:#8a8a8a; background:#fdfdf6;">
      <div class="center store" style="color:#999;">REPSOL</div>
      <div class="center small">E.S. A-2 KM 34 - MADRID</div>
      <div class="rule" style="border-color:#bbb;"></div>
      <div class="row"><span>21/09/2026</span><span>19:03</span></div>
      <div class="rule" style="border-color:#bbb;"></div>
      <div class="row"><span>GASOLINA 95 E5</span><span>62,40</span></div>
      <div class="qty small">38,51 L x 1,620</div>
      <div class="rule" style="border-color:#bbb;"></div>
      <div class="row total" style="color:#7a7a7a;"><span>TOTAL</span><span>62,40</span></div>
    </div>`,
  expected: {
    date: '2026-09-21',
    amount: 62.4,
    currency: 'EUR',
    store_name: 'Repsol',
    category: 'Gas & Petrol',
    items: [
      { description: 'GASOLINA 95 E5', quantity: 38.51, unit_price: 1.62, total_price: 62.4 },
    ],
  },
}

export const RECEIPT_FIXTURES: ReceiptFixture[] = [
  mercadona,
  pharmacy,
  diner,
  fadedFuel,
]

export function fixtureHtml(fixture: ReceiptFixture): string {
  return `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>${fixture.html}`
}
