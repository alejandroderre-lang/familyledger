import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// npm: specifier rather than esm.sh — esm.sh's generated .d.mts files fail to
// resolve under Deno and the worker refuses to boot.
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0"

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")

const anthropic = new Anthropic({ apiKey: anthropicApiKey })

// The vision API accepts these four types only. HEIC is allowed by the storage
// bucket but must be converted client-side before it reaches here.
const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const

type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number]

function toSupportedMediaType(mime: string): SupportedMediaType | null {
  const normalized = mime.toLowerCase().split(";")[0].trim()
  const alias = normalized === "image/jpg" ? "image/jpeg" : normalized
  return SUPPORTED_MEDIA_TYPES.includes(alias as SupportedMediaType)
    ? (alias as SupportedMediaType)
    : null
}

// Constrains the model's response so it is always parseable — no markdown
// fences, no prose, no truncated JSON to recover from.
const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    date: { type: ["string", "null"], description: "YYYY-MM-DD as printed" },
    amount: { type: ["number", "null"], description: "Final total paid" },
    currency: { type: ["string", "null"], description: "ISO 4217 code" },
    store_name: { type: ["string", "null"] },
    // anyOf rather than type:["string","null"] with an enum — the API rejects
    // an enum alongside a union type.
    category: {
      anyOf: [
        {
          type: "string",
          enum: [
            "Groceries",
            "Dining & Restaurants",
            "Gas & Petrol",
            "Transport & Travel",
            "Pharmacy & Health",
            "Clothing & Accessories",
            "Electronics",
            "Entertainment",
            "Utilities",
            "Other",
          ],
        },
        { type: "null" },
      ],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "number" },
          total_price: { type: "number" },
        },
        required: ["description", "quantity", "unit_price", "total_price"],
        additionalProperties: false,
      },
    },
  },
  required: ["date", "amount", "currency", "store_name", "category", "items"],
  additionalProperties: false,
} as const

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Without a key every request fails deep inside the SDK and surfaces to the
    // app as an unreadable-image error. Fail loudly and specifically instead.
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({
          error: "ANTHROPIC_API_KEY is not set for this function",
          code: "missing_api_key",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { receipt_id, image_url } = await req.json()

    // Fetch image from Supabase Storage and convert to base64
    const { data: imageData, error: imageError } = await supabase
      .storage
      .from("receipts")
      .download(image_url)

    if (imageError) throw imageError

    const arrayBuffer = await imageData.arrayBuffer()
    // Encode in chunks — spreading a ~1MB byte array into String.fromCharCode
    // at once overflows the call stack.
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ""
    const CHUNK_SIZE = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
    }
    const base64Image = btoa(binary)
    const mediaType = toSupportedMediaType(imageData.type || "image/jpeg")

    if (!mediaType) {
      return new Response(
        JSON.stringify({
          error: `Unsupported image type: ${imageData.type}. Convert to JPEG or PNG before upload.`,
          code: "unsupported_media_type",
        }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Call Claude with vision
    const message = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      output_config: { format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `Transcribe this receipt. These are photographs of real printed receipts — often thermal paper, frequently creased, curled, angled, or unevenly lit. Work with the image you have: zoom your attention into each region rather than reading the whole receipt at a glance, and read faded or low-contrast print character by character before deciding it is illegible.

Reading the total:
- Report the total that is PRINTED on the receipt. Do not compute it by summing line items, and do not "correct" a printed total that disagrees with your sum — receipts legitimately include tax, deposits, rounding, and discounts that the line items do not show.
- Take the final amount actually paid, after discounts and loyalty deductions. If several candidates appear (SUBTOTAL, TAX, TOTAL, AMOUNT DUE, CASH, CHANGE), take TOTAL / AMOUNT DUE — never CHANGE or CASH TENDERED.

Reading line items:
- Transcribe descriptions exactly as printed, including abbreviations and truncations. Do not expand "MLK 2% 1L" into "Milk 2% 1 Litre" — keep what the receipt says.
- Quantity lines often appear as a separate row ("2 x 1,50" or "0,684 kg x 3,99"). Fold these into the item: quantity 2, unit_price 1.50, total_price 3.00.
- A line with no explicit quantity has quantity 1 and unit_price equal to total_price.
- Discounts, coupons, and deposit refunds are items with a negative total_price.
- Mandatory charges the customer actually paid ARE items: service charge, cover charge, delivery fee, city or tourist tax, container deposits. Include them as ordinary lines so the breakdown accounts for the total.
- A suggested or optional gratuity is NOT an item. Receipts often print "Suggested: 10% = ... 15% = ..." below the total; those are prompts for the customer, not charges, and must be ignored. Only a tip that was actually added to the bill counts.
- Skip non-item rows: subtotals, tax lines that merely restate VAT already included in the prices, payment method, change, loyalty points, barcodes, footer text.

Decimal and date conventions:
- Many receipts use a comma as the decimal separator ("12,50" = 12.50) and a period as the thousands separator. Always emit numbers in JSON form: 12.50, never "12,50".
- Dates appear as DD/MM/YYYY, DD.MM.YY, MM/DD/YYYY and others. Use the store's locale and currency to disambiguate — a European receipt in EUR is DD/MM. Emit YYYY-MM-DD.

Other fields:
- currency: ISO 4217, inferred from the symbol (€=EUR, $=USD, £=GBP) or country context. Default to EUR.
- store_name: the merchant name as printed, title case.
- category: infer from the merchant and the items.

Accuracy over completeness: if a specific character or field is genuinely unreadable, emit null for that field rather than guessing. An empty items array is a valid answer when the item block is illegible — but only after you have actually tried to read it. Partial transcription is far more useful than none, so never abandon the whole receipt because one region is unclear.`,
            },
          ],
        },
      ],
    })

    // Find the text block rather than assuming index 0 — thinking blocks can
    // precede it, and indexing blindly yields an empty string.
    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    )
    const rawResponse = textBlock?.text ?? ""

    if (message.stop_reason === "max_tokens") {
      await supabase
        .from("receipts")
        .update({ status: "error", raw_ai_response: rawResponse })
        .eq("id", receipt_id)

      return new Response(
        JSON.stringify({
          error: "Response was truncated before the receipt was fully read",
          code: "max_tokens",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (message.stop_reason === "refusal") {
      return new Response(
        JSON.stringify({ error: "The model declined this image", code: "refusal" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Parse AI response
    let parsed
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      await supabase
        .from("receipts")
        .update({ status: "error", raw_ai_response: rawResponse })
        .eq("id", receipt_id)

      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: rawResponse }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get user_id from receipt
    const { data: receipt } = await supabase
      .from("receipts")
      .select("user_id")
      .eq("id", receipt_id)
      .single()

    // Insert expense row
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        receipt_id,
        user_id: receipt.user_id,
        date: parsed.date || new Date().toISOString().split("T")[0],
        amount: parsed.amount || 0,
        currency: parsed.currency || "EUR",
        store_name: parsed.store_name || "Unknown Store",
        category: parsed.category || "Other",
      })
      .select()
      .single()

    if (expenseError) throw expenseError

    // Insert line items
    if (parsed.items && parsed.items.length > 0) {
      const items = parsed.items.map((item: any) => ({
        expense_id: expense.id,
        description: item.description || "Unknown item",
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0,
      }))
      await supabase.from("expense_items").insert(items)
    }

    // Update receipt status
    await supabase
      .from("receipts")
      .update({ status: "parsed", raw_ai_response: rawResponse })
      .eq("id", receipt_id)

    return new Response(
      JSON.stringify({ success: true, expense_id: expense.id, parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
