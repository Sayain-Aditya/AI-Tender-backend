import { GoogleGenerativeAI } from "@google/generative-ai";

let client;
const getClient = () => {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
};

const chat = async (prompt) => {
  const model = getClient().getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const analyzeTender = async (rawText) => {
  const prompt = `You are a government tender analysis expert in India.
Analyze the following tender document and extract structured information.

Tender Document:
"""
${rawText.slice(0, 4000)}
"""

Respond ONLY with a valid JSON object — no markdown, no extra text:
{
  "title": "tender title",
  "department": "issuing department/ministry",
  "tenderValue": "value with Rs symbol",
  "emdAmount": "EMD amount with Rs symbol",
  "deadline": "YYYY-MM-DD",
  "category": "Civil | Electrical | Infrastructure | Road | Water | Other",
  "summary": "2-3 sentence plain English summary of the tender",
  "eligibility": <number 0-100>,
  "requirements": ["requirement 1", "requirement 2", "requirement 3", "requirement 4"],
  "risks": ["risk clause 1", "risk clause 2"]
}`;

  const raw = await chat(prompt);
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
};

export const checkEligibility = async (tenderText, companyProfile) => {
  const prompt = `You are a government tender eligibility checker.

Company Profile:
${JSON.stringify(companyProfile, null, 2)}

Tender Requirements:
"""
${tenderText.slice(0, 3000)}
"""

Respond ONLY with JSON:
{
  "score": <number 0-100>,
  "met": ["requirement met 1", "requirement met 2"],
  "missing": ["missing requirement 1", "missing requirement 2"],
  "recommendation": "One sentence advice on whether to bid"
}`;

  const raw = await chat(prompt);
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
};

export const getBOQInsight = async (boq) => {
  const itemsSummary = boq.items
    .map((i) => `${i.description}: ${i.qty} ${i.unit} @ Rs${i.rate} = Rs${i.amount?.toLocaleString()}`)
    .join("\n");

  const prompt = `You are a construction cost analysis expert in India. Analyze this BOQ for a government tender bid.

BOQ Items:
${itemsSummary}

Financial Summary:
- Base Cost: Rs${boq.baseCost?.toLocaleString()}
- Overhead (${boq.overhead}%): Rs${boq.overheadAmount?.toLocaleString()}
- Contingency (${boq.contingency}%): Rs${boq.contingencyAmount?.toLocaleString()}
- Transport: Rs${boq.transport?.toLocaleString()}
- Labor: Rs${boq.labor?.toLocaleString()}
- Subtotal before markup: Rs${boq.subtotal?.toLocaleString()}
- Markup (${boq.markup}%): Rs${boq.markupAmount?.toLocaleString()}
- GST (${boq.gst}%): Rs${boq.gstAmount?.toLocaleString()}
- Final Bid Price: Rs${boq.totalBid?.toLocaleString()}
- Net Profit Margin: ${boq.profitPct}%

Provide a 4-point analysis:
1. Whether the markup % is competitive for Indian government tenders
2. Any cost items that seem high or low vs current market rates
3. Risk assessment for this bid
4. One recommendation to improve profitability

Keep each point to 1-2 sentences. Plain English only.`;

  return chat(prompt);
};
