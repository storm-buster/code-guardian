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

  "ai_explanation": "A highly detailed, comprehensive, and beginner-friendly explanation (at least 4-5 paragraphs). Paragraph 1: Start with a simple, non-technical analogy (e.g., comparing the vulnerability to leaving a house key under a doormat). Paragraph 2: Explain exactly what is happening in this specific code (reference the actual line and variable names) in plain English that a non-programmer could understand. Paragraph 3: Explain the technical danger in simple terms. Paragraph 4: Describe the worst-case scenario and real-world impact (mention a famous data breach if relevant). Make it extremely long and easy to read. Use **bold** for key terms and emphasize clarity.",
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
      ai_explanation: `**The Analogy:** Imagine you have a security guard at a bank who blindly follows any instructions written on a piece of paper handed to them. If a customer writes "Give me my $10 balance, and also empty the entire vault," the guard does exactly that without questioning it. This is exactly what SQL Injection is.

**What's happening here:** At line ${finding.line} in \`${finding.file}\`, your code takes input directly from a user and plugs it straight into a database command without checking it first. It assumes the user is just providing normal text.

**Why it's dangerous:** Because the database can't tell the difference between your intended command and the user's input, an attacker can intentionally type in malicious database commands. Instead of just searching for their own profile, they can trick the database into handing over every single user's password, or even permanently deleting the entire database.

**Real-world impact:** This is one of the oldest and most devastating flaws on the internet. In 2023, the MOVEit Transfer SQL injection vulnerability (CVE-2023-34362) allowed hackers to steal sensitive data from thousands of organizations, affecting over 60 million people worldwide. It is a critical, top-priority fix.`,
      ai_fix: `// Use parameterized queries instead:\ncursor.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))\n\n// For Node.js:\ndb.query("SELECT * FROM users WHERE id = ?", [userId])`,
      confidence: 92,
    },
    XSS: {
      ai_explanation: `**The Analogy:** Think of your website as a public bulletin board where anyone can pin a note. Now imagine a malicious person pins a note that magically hypnotizes anyone who reads it, forcing them to hand over their wallet. This is what Cross-Site Scripting (XSS) does to your users' web browsers.

**What's happening here:** At line ${finding.line}, your application takes text provided by a user and displays it directly on the webpage without cleaning it up (sanitizing it) first. 

**Why it's dangerous:** An attacker can submit hidden, malicious JavaScript code instead of a normal comment or name. When an innocent user visits that page, their web browser sees the script and automatically runs it. This invisible script can steal their login cookies, silently redirect them to a fake banking site, or perform actions as if they were the user.

**Real-world impact:** XSS is incredibly common. In 2018, hackers used a sophisticated XSS attack on the British Airways booking website, modifying a script on the payment page to silently steal the credit card details of 380,000 customers as they were typing them in.`,
      ai_fix: `// Use textContent instead of innerHTML:\nelement.textContent = userInput;\n\n// Use DOMPurify:\nimport DOMPurify from 'dompurify';\nconst clean = DOMPurify.sanitize(dirty);`,
      confidence: 88,
    },
    Secrets: {
      ai_explanation: `**The Analogy:** Imagine buying an impenetrable, state-of-the-art safe to protect your valuables, but then taping the combination code directly onto the front door of the safe. That is exactly what hardcoding secrets means in software development.

**What's happening here:** A highly sensitive credential (like an API key, password, or encryption token) is written entirely in plain text at line ${finding.line}. Anyone who can read this source code file can see the secret immediately.

**Why it's dangerous:** Source code gets copied, shared, and backed up in many places. If this code is ever uploaded to a public repository like GitHub, or if a hacker gains even brief access to your internal systems, they instantly obtain the master key. With that key, they can bypass all your security systems, access your databases, and rack up massive bills on your cloud accounts.

**Real-world impact:** In 2022, automobile giant Toyota accidentally exposed an internal access key in a public GitHub repository that was left unnoticed for five years. This single mistake leaked the sensitive personal information of almost 300,000 customers.`,
      ai_fix: `// Move secrets to environment variables:\nAPI_KEY = os.environ.get("API_KEY")\n// Or: process.env.API_KEY`,
      confidence: 95,
    },
    Deserialization: {
      ai_explanation: `**The Analogy:** Imagine you receive a locked, sealed mystery box in the mail from a total stranger. Instead of checking what's inside or scanning it with a metal detector, you immediately open it and blindly follow whatever instructions are written on the card inside. If the card says "set this box on fire," you do it. This is exactly what Insecure Deserialization is.

**What's happening here:** At line ${finding.line}, your code takes data that was packaged up (serialized) by an external user, and unpacks it (deserializes it) directly into the application's memory without verifying if it is safe. 

**Why it's dangerous:** Deserialization doesn't just unpack plain data—it can reconstruct complex program logic and executable objects. An attacker can carefully craft a malicious package so that the absolute second your application unpacks it, the package springs to life and runs a destructive command on your server. This gives the attacker Remote Code Execution (RCE), meaning they completely own your server.

**Real-world impact:** This is an incredibly severe flaw. A famous deserialization vulnerability in Apache Commons Collections led to the catastrophic 2017 Equifax data breach, where hackers exploited the flaw to steal the highly sensitive personal data (including Social Security numbers) of 147 million Americans.`,
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
