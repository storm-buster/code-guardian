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
    "Path Traversal": {
      ai_explanation: `**The Analogy:** Imagine giving someone the key to your guest bathroom, but they figure out how to use a master skeleton key to unlock the master bedroom and steal your jewelry. Path Traversal works the same way but with your server's files.

**What's happening here:** At line ${finding.line}, the application takes a file name directly from user input and uses it to read or write a file on the server. The code never checks if the user typed directory navigation characters like \`../\` (dot-dot-slash).

**Why it's dangerous:** An attacker can input a file path like \`../../../../etc/passwd\` to break out of the intended directory. This allows them to read sensitive internal operating system files, application source code, or configuration files that contain database passwords.

**Real-world impact:** This is a devastating and very common vulnerability. In 2018, hackers exploited a path traversal flaw in the PlayStation Network to access internal server configuration files, leading to a massive compromise.`,
      ai_fix: `// Sanitize the input to ensure it only contains the filename, not path separators:\nconst safeFilename = path.basename(userInput);\nconst fullPath = path.join(BASE_DIR, safeFilename);`,
      confidence: 85,
    },
    Cryptography: {
      ai_explanation: `**The Analogy:** This is the digital equivalent of using a flimsy, plastic padlock from a dollar store to secure a massive bank vault. Technically the vault is locked, but anyone with a cheap hammer can break it in one second.

**What's happening here:** At line ${finding.line}, the code is using an outdated, mathematically broken cryptographic algorithm (like MD5, SHA1, or DES) to encrypt data or hash passwords.

**Why it's dangerous:** Modern computers, and especially cloud computing clusters, are so powerful that they can mathematically reverse or "crack" these weak algorithms in a matter of seconds. If an attacker steals your database, they will easily recover all the original plain-text passwords or decrypt the data.

**Real-world impact:** In 2012, LinkedIn's database was hacked. Because they used the weak, unsalted SHA1 algorithm to protect user passwords, hackers were able to quickly crack and publish the passwords of 117 million users.`,
      ai_fix: `// Use a strong, modern hashing algorithm with salt (like Argon2 or bcrypt):\nimport bcrypt from 'bcrypt';\nconst hash = await bcrypt.hash(password, 12);`,
      confidence: 85,
    },
    CORS: {
      ai_explanation: `**The Analogy:** Imagine a bouncer at a highly exclusive VIP club who was told to check the guest list, but instead just looks at everyone who walks up and says, "Sure, come on in!" That's exactly what a CORS misconfiguration does.

**What's happening here:** At line ${finding.line}, the server is configured to send an \`Access-Control-Allow-Origin: *\` header, or it blindly echoes back whatever website origin the user requested.

**Why it's dangerous:** Cross-Origin Resource Sharing (CORS) is a security feature built into web browsers to prevent malicious websites from reading data from your site. If it's disabled or misconfigured, an attacker can create a malicious website. When a victim visits that site, the attacker's website can silently make requests to your API, logging in as the victim, and reading all their private data.

**Real-world impact:** This is an extremely common misconfiguration that often leads to total account takeover or massive data scraping, especially in poorly configured internal corporate APIs.`,
      ai_fix: `// Restrict CORS to explicitly trusted domains:\napp.use(cors({\n  origin: ['https://my-trusted-site.com']\n}));`,
      confidence: 80,
    },
    Authentication: {
      ai_explanation: `**The Analogy:** Imagine an exclusive VIP lounge that has a giant sign reading "Staff Only," but there is no actual door or security guard. Anyone who ignores the sign can just walk right in.

**What's happening here:** At line ${finding.line}, an endpoint that performs sensitive actions or returns private data is completely missing an authentication check. The code simply assumes the user is supposed to be there.

**Why it's dangerous:** Attackers do not use normal web browsers; they use automated tools that scan thousands of URLs. If they find this endpoint, they can access it directly without needing a username, password, or session token. They can instantly view all the private data or trigger the administrative actions.

**Real-world impact:** In 2018, a massive flaw in the United States Postal Service (USPS) API allowed anyone to query the personal details of 60 million users because the API endpoint simply did not check if the person making the request was actually logged in.`,
      ai_fix: `// Add authentication middleware to the route:\napp.get('/api/sensitive-data', requireAuth, (req, res) => { ... });`,
      confidence: 90,
    },
    SSRF: {
      ai_explanation: `**The Analogy:** Imagine a criminal calling a bank teller and tricking the teller into calling the bank manager to authorize a massive wire transfer. The manager approves it because they trust the teller. This is Server-Side Request Forgery.

**What's happening here:** At line ${finding.line}, the server takes a URL provided by a user and makes an outbound HTTP request to that URL. 

**Why it's dangerous:** The attacker can provide an internal IP address (like \`127.0.0.1\` or the AWS metadata IP \`169.254.169.254\`). The server will fetch the data from that highly sensitive internal location and return it to the attacker. This completely bypasses all firewalls because the request comes from inside the trusted network.

**Real-world impact:** In 2019, the Capital One data breach was caused by an SSRF vulnerability. A hacker tricked the bank's server into requesting internal AWS credentials, leading to the theft of over 100 million credit card applications.`,
      ai_fix: `// Validate and sanitize outbound URLs. Never allow internal IPs.\nif (isInternalIp(userUrl)) throw new Error("Invalid URL");\nawait fetch(userUrl);`,
      confidence: 88,
    },
    JWT: {
      ai_explanation: `**The Analogy:** Imagine a nightclub where the bouncer checks for a VIP hand stamp. However, the stamp washes off easily, and the bouncer never actually checks if the stamp is real or if you just drew it yourself with a marker.

**What's happening here:** At line ${finding.line}, the code receives a JSON Web Token (JWT) and decodes it to read the user information, but completely fails to verify the cryptographic signature of the token.

**Why it's dangerous:** Because the signature isn't checked, an attacker can simply decode their own token, change their \`user_id\` to the \`admin_id\`, re-encode it, and send it to your server. Your server will blindly trust this fake token and grant the attacker full administrative access.

**Real-world impact:** Failing to verify JWT signatures is a critical logic flaw that immediately results in complete privilege escalation and administrative account takeover.`,
      ai_fix: `// Do not just decode the token. You MUST verify the signature:\nconst payload = jwt.verify(token, process.env.JWT_SECRET);`,
      confidence: 95,
    },
    Debug: {
      ai_explanation: `**The Analogy:** Imagine a mechanic leaving the car's hood wide open and the engine diagnostic manual sitting on the driver's seat after returning the car to the customer. 

**What's happening here:** At line ${finding.line}, the application is running with debug mode enabled, or it is configured to print highly detailed error stack traces directly to the user's screen.

**Why it's dangerous:** While this is helpful for developers, when a hacker intentionally breaks your application to see these errors, the stack traces leak massive amounts of internal information. This includes exact folder paths on the server, framework versions, and sometimes even database passwords or API keys that were involved in the crash.

**Real-world impact:** This is a severe information leak. It gives attackers a perfect, detailed blueprint of your system's internal architecture, making it incredibly easy for them to plan a targeted, devastating attack.`,
      ai_fix: `// Ensure debug mode is off in production and errors are masked:\nif (process.env.NODE_ENV === 'production') { \n  res.status(500).send('An internal error occurred.');\n}`,
      confidence: 60,
    },
    TODO: {
      ai_explanation: `**The Analogy:** Imagine having a massive bank vault, but someone left a bright yellow sticky note on the vault door that says: "Remind me to actually install the lock on this door tomorrow."

**What's happening here:** At line ${finding.line}, a developer left a code comment (like a TODO or FIXME) explicitly pointing out a missing security check or a known vulnerability that was never resolved.

**Why it's dangerous:** Attackers often scan source code (if it's open source or leaked) specifically looking for these keywords. These comments literally do the hacker's job for them by pointing out the exact file and line number where the application is vulnerable or incomplete.

**Real-world impact:** While the comment itself doesn't cause a breach, it highlights severe technical debt. Hackers actively search GitHub and leaked repositories for phrases like "TODO: fix security" and immediately target those systems.`,
      ai_fix: `// Remove the comment and actually implement the required security fix before deploying to production.`,
      confidence: 50,
    },
  };

  const fallback = templates[finding.category] || {
    ai_explanation: `**${finding.title}** detected at line ${finding.line} in \`${finding.file}\`. This is a ${finding.category} vulnerability that should be reviewed and remediated.`,
    ai_fix: `// Review and fix the vulnerability at line ${finding.line}.\n// Consult OWASP guidelines for ${finding.category} remediation.`,
    confidence: 75,
  };

  return fallback;
}
