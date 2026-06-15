const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface LLMResponse {
  ai_explanation: string;
  ai_fix: string;
  confidence: number;
}

export async function getAIAnalysis(finding: {
  title: string;
  severity: string;
  line: number;
  file: string;
  code_snippet: string;
  raw_description: string;
  category: string;
  cwe?: string;
}): Promise<LLMResponse> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const prompt = `You are a senior application security engineer reviewing code vulnerabilities found by a static analysis scanner.

FINDING:
- Title: ${finding.title}
- Severity: ${finding.severity}
- Category: ${finding.category}
- CWE: ${finding.cwe || "N/A"}
- File: ${finding.file}, Line: ${finding.line}
- Scanner Description: ${finding.raw_description}

CODE SNIPPET:
\`\`\`
${finding.code_snippet}
\`\`\`

Respond with a JSON object (no markdown, no code fences, just raw JSON) with exactly these keys:
{
  "ai_explanation": "A 3-paragraph plain-English explanation. Paragraph 1: What's happening in this specific code (reference the actual line/variable names). Paragraph 2: Why it's dangerous with a real-world example. Paragraph 3: The real-world impact (mention a known breach if relevant). Use **bold** for key terms.",
  "ai_fix": "The actual corrected code that fixes this vulnerability. Show the before→after. Include comments explaining why each change was made. Keep it concise but complete.",
  "confidence": <number 0-100 representing how confident you are this is a true positive>
}`;

  try {
    const resp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://code-guardian.vercel.app",
        "X-Title": "Code Guardian",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenRouter error:", resp.status, errText);
      throw new Error(`OpenRouter API error: ${resp.status}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Empty LLM response");
    }

    // Parse JSON — handle potential markdown wrapping
    let cleaned = content;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    return {
      ai_explanation: parsed.ai_explanation || "Analysis unavailable.",
      ai_fix: parsed.ai_fix || "Fix suggestion unavailable.",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 80,
    };
  } catch (error) {
    console.error("LLM analysis error:", error);
    // Fallback to category-based template
    return getFallbackAnalysis(finding);
  }
}

// Batch process findings with concurrency limit
export async function batchAnalyze(
  findings: Array<{
    title: string;
    severity: string;
    line: number;
    file: string;
    code_snippet: string;
    raw_description: string;
    category: string;
    cwe?: string;
  }>
): Promise<LLMResponse[]> {
  // Process max 5 concurrently to avoid rate limits
  const results: LLMResponse[] = [];
  const batchSize = 5;

  for (let i = 0; i < findings.length; i += batchSize) {
    const batch = findings.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((f) => getAIAnalysis(f))
    );
    results.push(...batchResults);
  }

  return results;
}

// Fallback templates when LLM is unavailable
function getFallbackAnalysis(finding: {
  title: string;
  category: string;
  line: number;
  file: string;
}): LLMResponse {
  const templates: Record<string, LLMResponse> = {
    Injection: {
      ai_explanation: `**What's happening:** The code at line ${finding.line} in \`${finding.file}\` directly embeds user input into a query/command string. An attacker can break out of the intended string and inject their own commands.\n\n**Why it's dangerous:** This allows an attacker to read, modify, or delete your entire database, or execute arbitrary system commands. This is consistently rated the #1 web vulnerability by OWASP.\n\n**Real-world impact:** In 2023, MOVEit Transfer SQL injection (CVE-2023-34362) led to data theft affecting 60M+ people worldwide.`,
      ai_fix: `// Use parameterized queries instead:\ncursor.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))\n\n// For Node.js:\ndb.query("SELECT * FROM users WHERE id = ?", [userId])`,
      confidence: 92,
    },
    XSS: {
      ai_explanation: `**What's happening:** At line ${finding.line}, user-controlled content is inserted into the page without sanitization.\n\n**Why it's dangerous:** Attackers can steal session cookies, redirect users to phishing pages, or perform actions on behalf of logged-in users.\n\n**Real-world impact:** XSS in the British Airways booking site (2018) led to theft of 380,000 payment cards.`,
      ai_fix: `// Use textContent instead of innerHTML:\nelement.textContent = userInput;\n\n// Use DOMPurify:\nimport DOMPurify from 'dompurify';\nconst clean = DOMPurify.sanitize(dirty);`,
      confidence: 88,
    },
    Secrets: {
      ai_explanation: `**What's happening:** A sensitive credential is hardcoded at line ${finding.line}. Anyone with source access can extract this key.\n\n**Why it's dangerous:** Leaked API keys grant attackers the same access as the key holder.\n\n**Real-world impact:** In 2022, Toyota exposed a key in a public GitHub repo for 5 years, leaking 296,000 customer records.`,
      ai_fix: `// Move secrets to environment variables:\nAPI_KEY = os.environ.get("API_KEY")\n// Or: process.env.API_KEY`,
      confidence: 95,
    },
    Deserialization: {
      ai_explanation: `**What's happening:** Line ${finding.line} deserializes/evaluates untrusted data, which can execute arbitrary code.\n\n**Why it's dangerous:** Provides Remote Code Execution (RCE) on your server.\n\n**Real-world impact:** Apache Commons deserialization vulnerability affected thousands of enterprise Java applications.`,
      ai_fix: `// Never unpickle untrusted data. Use JSON:\nconfig = json.loads(config_data)\n// For YAML:\nparsed = yaml.safe_load(data)`,
      confidence: 90,
    },
  };

  const fallback = templates[finding.category] || {
    ai_explanation: `**${finding.title}** detected at line ${finding.line} in \`${finding.file}\`. This is a ${finding.category} vulnerability that should be reviewed and remediated.`,
    ai_fix: `// Review and fix the vulnerability at line ${finding.line}.\n// Consult OWASP guidelines for ${finding.category} remediation.`,
    confidence: 75,
  };

  return fallback;
}
