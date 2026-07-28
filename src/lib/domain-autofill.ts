import { getInternalLLM } from "@/lib/llm";

// ============================================================
// FOUND MISSING via direct review of GetCito's actual source code
// (src/lib/get-company-info.ts): their onboarding only asks for a
// domain — everything else (company name, description, category,
// competitors) is auto-filled by an LLM that already has general
// knowledge of many companies. Our onboarding (Part 1/5) required
// the user to manually type brand name, category, AND competitor —
// unnecessary friction for any brand the model already knows about.
//
// This brings that UX improvement in, but keeps OUR stricter honesty
// principle (Part 7): every suggested field is EDITABLE and requires
// the user to review/submit, never auto-created blind. GetCito's
// version silently falls back to a low-quality guess on failure with
// no user-facing warning — ours surfaces confidence honestly instead.
// ============================================================

export type AutofillResult = {
  companyName: string;
  shortDescription: string;
  suggestedCategory: string;
  suggestedCompetitors: string[];
  confidence: "high" | "low"; // "low" = model likely doesn't really know this domain
};

// Returned when the LLM is unavailable (no/invalid API key, provider
// outage, unparseable response). We degrade gracefully — the user still
// gets the onboarding form, just without pre-filled suggestions — rather
// than hard-failing the whole step. Confidence is "low" so the UI never
// implies these blanks are a confident guess.
function emptyResult(): AutofillResult {
  return {
    companyName: "",
    shortDescription: "",
    suggestedCategory: "",
    suggestedCompetitors: [],
    confidence: "low",
  };
}

export async function autofillFromDomain(domain: string): Promise<AutofillResult> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

  try {
    const raw = await getInternalLLM().generate({
      system:
        "You identify a company from its domain name using your general knowledge. Respond ONLY as JSON: " +
        '{"companyName": string, "shortDescription": string, "suggestedCategory": string, ' +
        '"suggestedCompetitors": string[], "confidence": "high"|"low"}. ' +
        'Set confidence to "low" if you are not genuinely confident you know this specific company — ' +
        "do not invent plausible-sounding details for a domain you don't actually recognize. " +
        "suggestedCategory should be a short product category, e.g. 'D2C skincare' or 'B2B SaaS'.",
      prompt: `Domain: ${cleanDomain}`,
      json: true,
    });
    const parsed = JSON.parse(raw) as Partial<AutofillResult>;
    return {
      companyName: parsed.companyName ?? "",
      shortDescription: parsed.shortDescription ?? "",
      suggestedCategory: parsed.suggestedCategory ?? "",
      suggestedCompetitors: Array.isArray(parsed.suggestedCompetitors) ? parsed.suggestedCompetitors : [],
      confidence: parsed.confidence === "high" ? "high" : "low",
    };
  } catch (err) {
    // Invalid/missing API key, provider error, or bad JSON — log for the
    // operator but let onboarding continue with an empty (manual) form.
    console.warn(
      `autofillFromDomain: LLM unavailable for "${cleanDomain}", falling back to manual entry:`,
      err instanceof Error ? err.message : err,
    );
    return emptyResult();
  }
}
