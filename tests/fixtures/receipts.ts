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
  /* Business documents: wider, proportional type, more generous padding. */
  .doc { padding: 28px 30px 34px; font-size: 13px; }
  .doc .store { letter-spacing: 0; }
  .doc table th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #333; }
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

/** A4 business invoice: tabular columns, written-out date, GBP, VAT block. */
const ukInvoice: ReceiptFixture = {
  id: 'invoice-uk-vat',
  tests: 'formal invoice layout (table columns), GBP, written-out date, VAT gap',
  html: `
    <div class="receipt doc" style="width:620px; font-family:Helvetica, Arial, sans-serif;">
      <div class="row" style="align-items:flex-start;">
        <div>
          <div style="font-size:20px; font-weight:bold;">NORTHGATE DESIGN LTD</div>
          <div class="small">41 Bowling Green Lane<br/>London EC1R 0BJ<br/>VAT Reg. GB 412 7786 21</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px; font-weight:bold;">INVOICE</div>
          <div class="small">No. INV-2026-0188<br/>Date: 18 October 2026<br/>Terms: Net 30</div>
        </div>
      </div>
      <div class="rule" style="border-top:2px solid #222; margin:16px 0 0;"></div>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <tr style="border-bottom:1px solid #999;">
          <th style="text-align:left; padding:8px 0;">Description</th>
          <th style="text-align:right; width:48px;">Qty</th>
          <th style="text-align:right; width:88px;">Unit</th>
          <th style="text-align:right; width:88px;">Amount</th>
        </tr>
        <tr><td style="padding:7px 0;">Brand identity workshop</td><td style="text-align:right;">1</td><td style="text-align:right;">450.00</td><td style="text-align:right;">450.00</td></tr>
        <tr><td style="padding:7px 0;">Logo design &amp; artwork</td><td style="text-align:right;">1</td><td style="text-align:right;">1,200.00</td><td style="text-align:right;">1,200.00</td></tr>
        <tr><td style="padding:7px 0;">Print-ready file prep</td><td style="text-align:right;">3</td><td style="text-align:right;">85.00</td><td style="text-align:right;">255.00</td></tr>
      </table>
      <div class="rule"></div>
      <div class="row small"><span>Subtotal</span><span>£1,905.00</span></div>
      <div class="row small"><span>VAT @ 20%</span><span>£381.00</span></div>
      <div class="row total" style="margin-top:6px;"><span>TOTAL DUE</span><span>£2,286.00</span></div>
    </div>`,
  expected: {
    date: '2026-10-18',
    amount: 2286.0,
    currency: 'GBP',
    store_name: 'Northgate Design Ltd',
    category: 'Other',
    items: [
      { description: 'Brand identity workshop', quantity: 1, unit_price: 450.0, total_price: 450.0 },
      { description: 'Logo design & artwork', quantity: 1, unit_price: 1200.0, total_price: 1200.0 },
      { description: 'Print-ready file prep', quantity: 3, unit_price: 85.0, total_price: 255.0 },
    ],
  },
}

/** German locale: SUMME/MwSt vocabulary, DD.MM.YYYY, Pfand deposit line. */
const germanSupermarket: ReceiptFixture = {
  id: 'rewe-german-locale',
  tests: 'German vocabulary (SUMME/MwSt), DD.MM.YYYY, Pfand deposit as a positive item',
  html: `
    <div class="receipt">
      <div class="center store">REWE</div>
      <div class="center small">Friedrichstr. 95, 10117 Berlin</div>
      <div class="rule"></div>
      <div class="row"><span>07.08.2026</span><span>17:22</span></div>
      <div class="rule"></div>
      <div class="row"><span>VOLLMILCH 3,5%</span><span>1,29</span></div>
      <div class="row"><span>ROGGENBROT</span><span>2,49</span></div>
      <div class="row"><span>MINERALWASSER 6x1L</span><span>3,54</span></div>
      <div class="row"><span>PFAND 6 x 0,25</span><span>1,50</span></div>
      <div class="row"><span>BIO EIER 10ER</span><span>3,99</span></div>
      <div class="rule"></div>
      <div class="row total"><span>SUMME</span><span>EUR 12,81</span></div>
      <div class="row small"><span>MwSt A 7,0%</span><span>0,84</span></div>
      <div class="row small"><span>GEGEBEN EC-CARD</span><span>12,81</span></div>
    </div>`,
  expected: {
    date: '2026-08-07',
    amount: 12.81,
    currency: 'EUR',
    store_name: 'Rewe',
    category: 'Groceries',
    items: [
      { description: 'VOLLMILCH 3,5%', quantity: 1, unit_price: 1.29, total_price: 1.29 },
      { description: 'ROGGENBROT', quantity: 1, unit_price: 2.49, total_price: 2.49 },
      { description: 'MINERALWASSER 6x1L', quantity: 1, unit_price: 3.54, total_price: 3.54 },
      // Printed as "PFAND 6 x 0,25" on one line. The quantity belongs in the
      // qty/unit fields, so the description is just the item name.
      { description: 'PFAND', quantity: 6, unit_price: 0.25, total_price: 1.5 },
      { description: 'BIO EIER 10ER', quantity: 1, unit_price: 3.99, total_price: 3.99 },
    ],
  },
}

/** Service charge is part of the bill; suggested gratuity lines are not. */
const bistroService: ReceiptFixture = {
  id: 'bistro-service-tip',
  tests: 'included service charge vs suggested-gratuity lines that must be ignored',
  html: `
    <div class="receipt">
      <div class="center store">BISTRO SEVENTEEN</div>
      <div class="center small">Table 6 · Covers 2 · Server: Marta</div>
      <div class="rule"></div>
      <div class="row"><span>29/05/2026</span><span>21:38</span></div>
      <div class="rule"></div>
      <div class="row"><span>SOUP OF THE DAY</span><span>13.00</span></div>
      <div class="qty small">2 x 6.50</div>
      <div class="row"><span>RIBEYE 300G</span><span>28.50</span></div>
      <div class="row"><span>SEA BASS</span><span>22.00</span></div>
      <div class="row"><span>HOUSE RED 500ML</span><span>19.00</span></div>
      <div class="rule"></div>
      <div class="row small"><span>Food &amp; drink</span><span>82.50</span></div>
      <div class="row"><span>SERVICE CHARGE 12.5%</span><span>10.31</span></div>
      <div class="rule"></div>
      <div class="row total"><span>TOTAL</span><span>£92.81</span></div>
      <div class="rule"></div>
      <div class="center small">Gratuity is not included beyond service.<br/>
        Suggested: 10% = £9.28 &nbsp; 15% = £13.92 &nbsp; 20% = £18.56</div>
    </div>`,
  expected: {
    date: '2026-05-29',
    amount: 92.81,
    currency: 'GBP',
    store_name: 'Bistro Seventeen',
    category: 'Dining & Restaurants',
    items: [
      { description: 'SOUP OF THE DAY', quantity: 2, unit_price: 6.5, total_price: 13.0 },
      { description: 'RIBEYE 300G', quantity: 1, unit_price: 28.5, total_price: 28.5 },
      { description: 'SEA BASS', quantity: 1, unit_price: 22.0, total_price: 22.0 },
      { description: 'HOUSE RED 500ML', quantity: 1, unit_price: 19.0, total_price: 19.0 },
      { description: 'SERVICE CHARGE 12.5%', quantity: 1, unit_price: 10.31, total_price: 10.31 },
    ],
  },
}

/** Multi-buy promotions printed as separate saving lines. */
const promoSupermarket: ReceiptFixture = {
  id: 'supermarket-promos',
  tests: 'multi-buy savings printed as separate negative lines; line totals diverge from qty x unit',
  html: `
    <div class="receipt">
      <div class="center store">SAINSBURY'S</div>
      <div class="center small">Holborn Circus, London</div>
      <div class="rule"></div>
      <div class="row"><span>12/06/2026</span><span>10:05</span></div>
      <div class="rule"></div>
      <div class="row"><span>PASTA FUSILLI 500G</span><span>3.60</span></div>
      <div class="qty small">3 x 1.20</div>
      <div class="row"><span>3 FOR 2 SAVING</span><span>-1.20</span></div>
      <div class="row"><span>CHEDDAR MATURE 400G</span><span>4.75</span></div>
      <div class="row"><span>TOMATOES VINE</span><span>2.21</span></div>
      <div class="qty small">0.590 kg x 3.75</div>
      <div class="row"><span>NECTAR OFFER</span><span>-0.50</span></div>
      <div class="rule"></div>
      <div class="row total"><span>TOTAL TO PAY</span><span>£8.86</span></div>
      <div class="row small"><span>BALANCE DUE</span><span>0.00</span></div>
    </div>`,
  expected: {
    date: '2026-06-12',
    amount: 8.86,
    currency: 'GBP',
    store_name: "Sainsbury's",
    category: 'Groceries',
    items: [
      { description: 'PASTA FUSILLI 500G', quantity: 3, unit_price: 1.2, total_price: 3.6 },
      { description: '3 FOR 2 SAVING', quantity: 1, unit_price: -1.2, total_price: -1.2 },
      { description: 'CHEDDAR MATURE 400G', quantity: 1, unit_price: 4.75, total_price: 4.75 },
      { description: 'TOMATOES VINE', quantity: 0.59, unit_price: 3.75, total_price: 2.21 },
      { description: 'NECTAR OFFER', quantity: 1, unit_price: -0.5, total_price: -0.5 },
    ],
  },
}

/** Hotel folio: dated charge lines, an explicit invoice date, room-night maths. */
const hotelFolio: ReceiptFixture = {
  id: 'hotel-folio',
  tests: 'folio layout with per-date charge lines; invoice date must win over stay dates',
  html: `
    <div class="receipt doc" style="width:560px; font-family:Helvetica, Arial, sans-serif;">
      <div class="center store">HOTEL ARRIBAS</div>
      <div class="center small">Passeig de Gràcia 71, Barcelona</div>
      <div class="rule"></div>
      <div class="row small"><span>Guest: A. de Remedios</span><span>Room 412</span></div>
      <div class="row small"><span>Arrival: 03/04/2026</span><span>Departure: 05/04/2026</span></div>
      <div class="row small"><span>Invoice date: 05/04/2026</span><span>Folio 88213</span></div>
      <div class="rule"></div>
      <div class="row"><span>ROOM — DOUBLE SUPERIOR</span><span>190,00</span></div>
      <div class="qty small">2 nights x 95,00</div>
      <div class="row"><span>BREAKFAST BUFFET</span><span>36,00</span></div>
      <div class="qty small">4 x 9,00</div>
      <div class="row"><span>MINIBAR</span><span>7,50</span></div>
      <div class="row"><span>CITY TAX</span><span>8,80</span></div>
      <div class="qty small">4 x 2,20</div>
      <div class="rule"></div>
      <div class="row total"><span>TOTAL</span><span>242,30</span></div>
    </div>`,
  expected: {
    date: '2026-04-05',
    amount: 242.3,
    currency: 'EUR',
    store_name: 'Hotel Arribas',
    category: 'Transport & Travel',
    items: [
      { description: 'ROOM — DOUBLE SUPERIOR', quantity: 2, unit_price: 95.0, total_price: 190.0 },
      { description: 'BREAKFAST BUFFET', quantity: 4, unit_price: 9.0, total_price: 36.0 },
      { description: 'MINIBAR', quantity: 1, unit_price: 7.5, total_price: 7.5 },
      { description: 'CITY TAX', quantity: 4, unit_price: 2.2, total_price: 8.8 },
    ],
  },
}

/** Long receipt: 18 items, tests completeness rather than any single trick. */
const longGrocery: ReceiptFixture = {
  id: 'long-grocery-18-items',
  tests: 'completeness over a long item list (18 lines); no single trick',
  html: `
    <div class="receipt">
      <div class="center store">CARREFOUR MARKET</div>
      <div class="center small">Av. Diagonal 557, Barcelona</div>
      <div class="rule"></div>
      <div class="row"><span>19/07/2026</span><span>18:41</span></div>
      <div class="rule"></div>
      ${[
        ['ARROZ REDONDO 1KG', '1,45'],
        ['LENTEJAS 500G', '1,15'],
        ['ATUN CLARO 3P', '3,29'],
        ['YOGUR NATURAL 8U', '2,10'],
        ['QUESO MANCHEGO', '6,95'],
        ['JAMON SERRANO 100G', '4,40'],
        ['PECHUGA POLLO', '7,12'],
        ['SALMON FRESCO', '9,80'],
        ['BROCOLI', '1,89'],
        ['ZANAHORIAS 1KG', '0,99'],
        ['CEBOLLA 1KG', '1,20'],
        ['PLATANO CANARIO', '2,34'],
        ['NARANJA ZUMO 2KG', '3,15'],
        ['CAFE MOLIDO 250G', '3,75'],
        ['GALLETAS MARIA', '1,60'],
        ['PAPEL COCINA 2R', '2,45'],
        ['DETERGENTE 1,5L', '5,40'],
        ['BOLSA PLASTICO', '0,15'],
      ]
        .map(([d, p]) => `<div class="row"><span>${d}</span><span>${p}</span></div>`)
        .join('')}
      <div class="rule"></div>
      <div class="row total"><span>TOTAL</span><span>59,18</span></div>
    </div>`,
  expected: {
    date: '2026-07-19',
    amount: 59.18,
    currency: 'EUR',
    store_name: 'Carrefour Market',
    category: 'Groceries',
    items: [
      ['ARROZ REDONDO 1KG', 1.45],
      ['LENTEJAS 500G', 1.15],
      ['ATUN CLARO 3P', 3.29],
      ['YOGUR NATURAL 8U', 2.1],
      ['QUESO MANCHEGO', 6.95],
      ['JAMON SERRANO 100G', 4.4],
      ['PECHUGA POLLO', 7.12],
      ['SALMON FRESCO', 9.8],
      ['BROCOLI', 1.89],
      ['ZANAHORIAS 1KG', 0.99],
      ['CEBOLLA 1KG', 1.2],
      ['PLATANO CANARIO', 2.34],
      ['NARANJA ZUMO 2KG', 3.15],
      ['CAFE MOLIDO 250G', 3.75],
      ['GALLETAS MARIA', 1.6],
      ['PAPEL COCINA 2R', 2.45],
      ['DETERGENTE 1,5L', 5.4],
      ['BOLSA PLASTICO', 0.15],
    ].map(([description, price]) => ({
      description: description as string,
      quantity: 1,
      unit_price: price as number,
      total_price: price as number,
    })),
  },
}

export const RECEIPT_FIXTURES: ReceiptFixture[] = [
  mercadona,
  pharmacy,
  diner,
  fadedFuel,
  ukInvoice,
  germanSupermarket,
  bistroService,
  promoSupermarket,
  hotelFolio,
  longGrocery,
]

export function fixtureHtml(fixture: ReceiptFixture): string {
  return `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>${fixture.html}`
}
