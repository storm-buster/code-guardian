import { Finding, Severity } from "./types";

interface VulnPattern {
  regex: RegExp;
  title: string;
  severity: Severity;
  category: string;
  cwe: string;
  raw_description: string;
}

const VULN_PATTERNS: VulnPattern[] = [
  // SQL Injection
  {
    regex: /(?:execute|query|cursor\.execute|db\.query|sequelize\.query|knex\.raw)\s*\(\s*(?:f['"`]|['"`].*?\+|`.*?\$\{|.*?%s|.*?\.format)/gi,
    title: "SQL Injection via String Interpolation",
    severity: "critical",
    category: "Injection",
    cwe: "CWE-89",
    raw_description: "User-controlled input is concatenated directly into an SQL query string without parameterization."
  },
  {
    regex: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\s+.*?(?:\+\s*\w+|\$\{|\bformat\b|%[sd])/gi,
    title: "Potential SQL Injection",
    severity: "critical",
    category: "Injection",
    cwe: "CWE-89",
    raw_description: "SQL statement constructed with string concatenation or template literals, potentially injectable."
  },
  // XSS
  {
    regex: /(?:innerHTML|outerHTML|document\.write|\.html\()\s*[=(]\s*(?!['"`]\s*$)/gi,
    title: "Cross-Site Scripting (XSS) via DOM Manipulation",
    severity: "high",
    category: "XSS",
    cwe: "CWE-79",
    raw_description: "Unsanitized content assigned to innerHTML or similar DOM property."
  },
  {
    regex: /dangerouslySetInnerHTML/gi,
    title: "React dangerouslySetInnerHTML Usage",
    severity: "high",
    category: "XSS",
    cwe: "CWE-79",
    raw_description: "dangerouslySetInnerHTML bypasses React's XSS protections."
  },
  // Hardcoded Secrets
  {
    regex: /(?:api[_-]?key|apikey|secret[_-]?key|password|passwd|token|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*['"`](?!(?:process\.env|os\.environ|ENV|None|null|undefined|TODO|xxx|your|CHANGE|<|{{|\$\{))[A-Za-z0-9+/=_\-]{8,}['"`]/gi,
    title: "Hardcoded Secret / API Key",
    severity: "critical",
    category: "Secrets",
    cwe: "CWE-798",
    raw_description: "Sensitive credential found hardcoded in source code."
  },
  {
    regex: /(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{35}|sk-[a-zA-Z0-9]{40,}|ghp_[a-zA-Z0-9]{36})/g,
    title: "Cloud Provider API Key Detected",
    severity: "critical",
    category: "Secrets",
    cwe: "CWE-798",
    raw_description: "Known cloud provider API key pattern detected in source."
  },
  // Command Injection
  {
    regex: /(?:os\.system|subprocess\.call|subprocess\.run|subprocess\.Popen|exec\(|child_process\.exec|shell_exec|system\()\s*\(?\s*(?:f['"`]|['"`].*?\+|`.*?\$\{|.*?%s|.*?\.format)/gi,
    title: "OS Command Injection",
    severity: "critical",
    category: "Injection",
    cwe: "CWE-78",
    raw_description: "User input passed directly to OS command execution function."
  },
  // Path Traversal
  {
    regex: /(?:open|readFile|readFileSync|createReadStream|fs\.read)\s*\(\s*(?:req\.|request\.|params\.|query\.|body\.)/gi,
    title: "Path Traversal / Local File Inclusion",
    severity: "high",
    category: "Path Traversal",
    cwe: "CWE-22",
    raw_description: "File operation uses user-controlled path without sanitization."
  },
  // Insecure Deserialization
  {
    regex: /(?:pickle\.loads?|yaml\.load\s*\((?!.*Loader)|eval\s*\(\s*(?:req|request|input|data|body|params))/gi,
    title: "Insecure Deserialization / Eval",
    severity: "critical",
    category: "Deserialization",
    cwe: "CWE-502",
    raw_description: "Untrusted data passed to deserialization or eval function."
  },
  // Weak Crypto
  {
    regex: /(?:md5|sha1|DES|RC4)\s*\(/gi,
    title: "Weak Cryptographic Algorithm",
    severity: "medium",
    category: "Cryptography",
    cwe: "CWE-327",
    raw_description: "Deprecated or weak cryptographic algorithm in use."
  },
  // CORS Misconfiguration
  {
    regex: /(?:Access-Control-Allow-Origin|cors)\s*[:({]\s*['"`]\*['"`]/gi,
    title: "Overly Permissive CORS Configuration",
    severity: "medium",
    category: "Misconfiguration",
    cwe: "CWE-942",
    raw_description: "CORS allows all origins (*), enabling cross-origin attacks."
  },
  // Missing Auth (Python routes)
  {
    regex: /(?:@app\.route|@blueprint\.route)\s*\([^)]+\)\s*\n(?:(?!@login_required|@auth|@authenticate|@protected|@jwt_required).)*?\ndef\s/gis,
    title: "Endpoint Missing Authentication",
    severity: "high",
    category: "Authentication",
    cwe: "CWE-306",
    raw_description: "Route handler has no apparent authentication check."
  },
  // Missing Auth (Express/JS routes)
  {
    regex: /(?:router|app)\.(?:get|post|put|delete|patch)\s*\(\s*['"`]\/[^'"]*['"`]\s*,\s*(?:async\s+)?\(?(?:req|ctx)/gi,
    title: "Express Route Without Middleware Guard",
    severity: "high",
    category: "Authentication",
    cwe: "CWE-306",
    raw_description: "Express route handler appears to accept requests directly without auth middleware."
  },
  // Debug/Dev leftovers
  {
    regex: /(?:DEBUG\s*=\s*True|FLASK_DEBUG\s*=\s*1|app\.debug\s*=\s*True|console\.log\s*\(.*(?:password|secret|token|key))/gi,
    title: "Debug Mode / Sensitive Logging",
    severity: "medium",
    category: "Misconfiguration",
    cwe: "CWE-215",
    raw_description: "Debug mode enabled or sensitive data logged in production code."
  },
  // SSRF
  {
    regex: /(?:requests\.get|fetch|axios|http\.get|urllib)\s*\(\s*(?:req\.|request\.|params\.|query\.|body\.|user)/gi,
    title: "Server-Side Request Forgery (SSRF)",
    severity: "high",
    category: "SSRF",
    cwe: "CWE-918",
    raw_description: "Server-side HTTP request uses user-controlled URL."
  },
  // JWT None Algorithm
  {
    regex: /(?:algorithm\s*[:=]\s*['"`]none['"`]|verify\s*[:=]\s*(?:false|False)|jwt\.decode\s*\([^)]*verify\s*=\s*False)/gi,
    title: "JWT Verification Bypass",
    severity: "critical",
    category: "Authentication",
    cwe: "CWE-347",
    raw_description: "JWT signature verification disabled or 'none' algorithm accepted."
  },

  // ─── BROADER PATTERNS (trigger on real-world repos) ───

  // eval() usage (any)
  {
    regex: /\beval\s*\([^)]+\)/gi,
    title: "Dangerous eval() Usage",
    severity: "high",
    category: "Injection",
    cwe: "CWE-95",
    raw_description: "eval() executes arbitrary code and should be avoided in production."
  },
  // subprocess / os.system (any usage, not just with interpolation)
  {
    regex: /(?:subprocess\.(?:call|run|Popen|check_output)|os\.system|os\.popen)\s*\(/gi,
    title: "Shell Command Execution",
    severity: "medium",
    category: "Injection",
    cwe: "CWE-78",
    raw_description: "Shell command execution detected. Ensure user input is never passed unsanitized."
  },
  // Bare except (Python)
  {
    regex: /\bexcept\s*:/g,
    title: "Bare Exception Handler",
    severity: "low",
    category: "Error Handling",
    cwe: "CWE-396",
    raw_description: "Bare 'except:' catches all exceptions including SystemExit and KeyboardInterrupt, masking bugs."
  },
  // assert used for validation (stripped in -O mode)
  {
    regex: /\bassert\s+(?:request|req|data|body|params|user|input)/gi,
    title: "Assert Used for Input Validation",
    severity: "medium",
    category: "Error Handling",
    cwe: "CWE-617",
    raw_description: "assert statements are stripped in optimized Python builds (-O flag), bypassing validation."
  },
  // HTTP URLs (non-HTTPS)
  {
    regex: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[a-zA-Z0-9._-]+/g,
    title: "Insecure HTTP Connection",
    severity: "medium",
    category: "Transport Security",
    cwe: "CWE-319",
    raw_description: "Non-HTTPS URL detected. Data transmitted over plain HTTP can be intercepted."
  },
  // Disabled SSL verification
  {
    regex: /(?:verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"`]?0|rejectUnauthorized\s*:\s*false|InsecureRequestWarning)/gi,
    title: "SSL/TLS Verification Disabled",
    severity: "high",
    category: "Transport Security",
    cwe: "CWE-295",
    raw_description: "SSL certificate verification is disabled, enabling man-in-the-middle attacks."
  },
  // Hardcoded IP addresses
  {
    regex: /['"`]\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?['"`]/g,
    title: "Hardcoded IP Address",
    severity: "low",
    category: "Misconfiguration",
    cwe: "CWE-547",
    raw_description: "Hardcoded IP address found. Use environment variables or DNS for production deployments."
  },
  // TODO/FIXME/HACK security notes
  {
    regex: /(?:TODO|FIXME|HACK|XXX|SECURITY)\s*:?\s*.*(?:vulnerab|auth|password|secret|inject|sanitiz|escap|xss|csrf|exploit)/gi,
    title: "Security-Related TODO/FIXME",
    severity: "low",
    category: "Code Quality",
    cwe: "CWE-546",
    raw_description: "Developer note indicates known security concern that has not been addressed."
  },
  // Broad file permission (chmod 777 / 0o777)
  {
    regex: /(?:chmod|os\.chmod)\s*\(.*(?:0?o?777|0?o?666)|permissions?\s*[:=]\s*['"`]?(?:777|666)/gi,
    title: "Overly Permissive File Permissions",
    severity: "medium",
    category: "Misconfiguration",
    cwe: "CWE-732",
    raw_description: "File permissions set to world-readable/writable, which is a security risk."
  },
  // Regex DoS (nested quantifiers)
  {
    regex: /new\s+RegExp\s*\(.*(?:\+|\$\{|concat)/gi,
    title: "Dynamic Regex Construction",
    severity: "medium",
    category: "Injection",
    cwe: "CWE-1333",
    raw_description: "Regex built from dynamic input may be vulnerable to ReDoS (Regular Expression Denial of Service)."
  },
];

function getLineNumber(code: string, index: number): number {
  return code.substring(0, index).split("\n").length;
}

function getCodeSnippet(code: string, line: number): string {
  const lines = code.split("\n");
  const start = Math.max(0, line - 3);
  const end = Math.min(lines.length, line + 2);
  return lines
    .slice(start, end)
    .map((l, i) => `${start + i + 1} | ${l}`)
    .join("\n");
}

// Scan a single code block (one file or combined)
function scanSingleBlock(code: string, filename: string): Omit<Finding, "ai_explanation" | "ai_fix" | "confidence">[] {
  const findings: Omit<Finding, "ai_explanation" | "ai_fix" | "confidence">[] = [];
  let idCounter = 0;

  for (const pattern of VULN_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const line = getLineNumber(code, match.index);
      idCounter++;
      findings.push({
        id: `VLN-${String(idCounter).padStart(3, "0")}`,
        title: pattern.title,
        severity: pattern.severity,
        line,
        file: filename,
        code_snippet: getCodeSnippet(code, line),
        raw_description: pattern.raw_description,
        category: pattern.category,
        cwe: pattern.cwe,
      });
    }
  }

  return findings;
}

export function scanCode(code: string, filename: string = "code.py"): Omit<Finding, "ai_explanation" | "ai_fix" | "confidence">[] {
  // Check if code contains file markers (multi-file from GitHub)
  const fileMarkerRegex = /^# ══════ FILE: (.+?) ══════$/gm;
  const markers: { path: string; startIndex: number }[] = [];
  let markerMatch: RegExpExecArray | null;
  
  while ((markerMatch = fileMarkerRegex.exec(code)) !== null) {
    markers.push({ path: markerMatch[1], startIndex: markerMatch.index });
  }

  let allFindings: Omit<Finding, "ai_explanation" | "ai_fix" | "confidence">[] = [];

  if (markers.length > 0) {
    // Multi-file mode: scan each file separately for better pattern matching
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].startIndex;
      const end = i + 1 < markers.length ? markers[i + 1].startIndex : code.length;
      const fileCode = code.substring(start, end);
      const filePath = markers[i].path;

      const fileFindings = scanSingleBlock(fileCode, filePath);
      
      // Adjust line numbers to be relative to the full combined code
      const lineOffset = code.substring(0, start).split("\n").length - 1;
      for (const f of fileFindings) {
        f.line += lineOffset;
      }
      
      allFindings.push(...fileFindings);
    }
  } else {
    // Single file mode
    allFindings = scanSingleBlock(code, filename);
  }

  // Re-number IDs sequentially
  allFindings.forEach((f, i) => {
    f.id = `VLN-${String(i + 1).padStart(3, "0")}`;
  });

  // Deduplicate by line + title
  const seen = new Set<string>();
  return allFindings.filter((f) => {
    const key = `${f.file}:${f.line}:${f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
