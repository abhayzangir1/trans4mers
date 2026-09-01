# Security Policy

Trans4mers takes security seriously. This document outlines our security practices and how to report vulnerabilities.

## Security Principles

1. **No Hardcoded Secrets**: All credentials are managed via environment variables or Google Cloud Secret Manager
2. **Least Privilege**: Components run with minimal required permissions
3. **Defense in Depth**: Multiple layers of protection for critical operations
4. **Transparency**: Security practices are documented and auditable

## Credential Management

### Local Development

1. **Never commit `.env.local`** to Git
2. Use `.env.example` as a template
3. Keep separate credentials for dev/staging/production

```bash
# Setup
cp .env.example .env.local
# Edit .env.local with YOUR credentials (not committed)
```

### Production Deployment

All production credentials are stored in **Google Cloud Secret Manager**:

```bash
# Create a secret
echo "your-value" | gcloud secrets create trans4mers-database-url \
  --replication-policy=automatic \
  --data-file=-

# Reference in deployment (do NOT expose values)
gcloud run deploy trans4mers \
  --set-secrets="DATABASE_URL=trans4mers-database-url:latest"
```

**Why not environment variables?**
- Visible in Cloud Run UI
- Logged in deployment history
- Exposed in container inspection
- Compromised if logging is not secure

**Why Secret Manager?**
- Secrets never appear in logs or UI
- Audit trail of access attempts
- Automatic rotation support
- IAM-based access control

## Sensitive Information

The following should **NEVER** be committed to Git:

- ❌ `.env.local` (use `.env.example`)
- ❌ API keys (OpenAI, Anthropic, Browserbase)
- ❌ Database URLs with credentials
- ❌ Google Cloud credentials files
- ❌ Private deployment scripts
- ❌ Production configuration

## Code Security

### Shell Injection Prevention

All terminal commands are validated:

```typescript
// BLOCK shell metacharacters
const BLOCKLIST_CHARS = /[&|;$><`\n\r]/;
if (BLOCKLIST_CHARS.test(cmd)) {
  throw new SecurityError("Shell injection detected");
}

// WHITELIST safe commands
const ALLOWED_COMMANDS = ['npm', 'git', 'node', 'python'];
if (!ALLOWED_COMMANDS.includes(cmd.split(' ')[0])) {
  throw new SecurityError("Command not allowed");
}
```

### Path Traversal Prevention

All file operations are sandboxed:

```typescript
const basePath = `/workspaces/${sessionId}/${projectId}`;
const requestedPath = path.resolve(basePath, userPath);

// Ensure requested path is within sandbox
if (!requestedPath.startsWith(basePath)) {
  throw new SecurityError("Path traversal attempt detected");
}
```

### SQL Injection Prevention

All database queries use prepared statements:

```typescript
// ✅ SAFE: Parameterized query
const result = await prisma.message.findMany({
  where: { conversationId: conversationId }
});

// ❌ UNSAFE: String concatenation
const result = await db.$queryRaw(`SELECT * FROM messages WHERE id = ${id}`);
```

## Authentication & Sessions

- Sessions are tracked via **HTTP-only cookies** (cannot be accessed via JavaScript)
- Cookies have **Secure** flag (only sent over HTTPS)
- Cookies have **SameSite=Strict** (prevents CSRF attacks)
- Session data is validated on every request

```typescript
const sessionCookie = {
  httpOnly: true,      // ✅ Prevents XSS attacks
  secure: true,        // ✅ HTTPS only
  sameSite: 'Strict',  // ✅ Prevents CSRF
  maxAge: 3600,        // ✅ 1 hour expiry
  signed: true         // ✅ Cryptographically signed
}
```

## API Security

### Rate Limiting

API endpoints implement rate limiting to prevent abuse:

```typescript
// Example: 100 requests per 15 minutes per session
const rateLimit = await checkRateLimit(sessionId, "100 per 15 minutes");
if (!rateLimit.allowed) {
  return res.status(429).json({ error: "Rate limit exceeded" });
}
```

### CORS Configuration

Cross-Origin Resource Sharing is configured conservatively:

```typescript
// Only allow same-origin requests
const corsOptions = {
  origin: 'http://localhost:3000', // Or your deployed domain
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};
```

### Input Validation

All user inputs are validated and sanitized:

```typescript
const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  model: z.enum(['gemini-pro', 'claude-3-sonnet'])
});

const validated = schema.parse(userInput); // Throws if invalid
```

## Dependency Security

### Regular Updates

Dependencies are kept up-to-date:

```bash
# Check for vulnerabilities
npm audit

# Update packages
npm update

# Review and commit changes
git add package.json package-lock.json
git commit -m "chore: update dependencies"
```

### Minimal Dependencies

We avoid unnecessary dependencies to reduce attack surface:

- ❌ Avoid "do-everything" packages
- ❌ Avoid packages with known security issues
- ✅ Prefer standard library when possible
- ✅ Regularly audit dependency trees

## Logging & Monitoring

### What We Log

- ✅ Failed authentication attempts
- ✅ Authorization failures
- ✅ System errors and exceptions
- ✅ Security policy violations

### What We DON'T Log

- ❌ API keys or tokens
- ❌ User passwords
- ❌ Personal data
- ❌ File contents

```typescript
// ✅ SAFE: Log only metadata
logger.info("File uploaded", { 
  fileSize: bytes, 
  userId: id, 
  timestamp: now 
});

// ❌ UNSAFE: Logging sensitive data
logger.info("User data", { 
  password: user.password,  // NEVER!
  apiKey: config.apiKey     // NEVER!
});
```

## Reporting Vulnerabilities

If you discover a security vulnerability, **please report it responsibly**:

1. **DO NOT** create a public GitHub issue
2. **DO NOT** publish the vulnerability on social media
3. **DO** email: security@trans4mers.dev (when we have this)
4. **DO** include details:
   - Type of vulnerability
   - Affected component
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

### Security Disclosure Timeline

- **Day 1**: Report received and acknowledged
- **Day 7**: Initial assessment completed
- **Day 30**: Fix developed and tested
- **Day 45**: Patch released (public disclosure after fix)

We appreciate responsible disclosure and will credit researchers in our security acknowledgments.

## Infrastructure Security

### Google Cloud Run

- Services run as non-root user (`uid 1001`)
- Memory limits enforced (2GB per instance)
- CPU limits enforced (2 vCPU per instance)
- No public source code access
- Automatic scaling with concurrency limits

### Google Cloud Storage

- Versioning enabled on all buckets
- Server-side encryption enabled
- Public access blocked by default
- Audit logging enabled
- Regular backups configured

### PostgreSQL Database

- SSL/TLS encryption required
- Backups automated daily
- Access restricted to Cloud Run service
- No public internet access
- Connection pooling to prevent resource exhaustion

## Compliance & Standards

Trans4mers follows these security standards:

- **OWASP Top 10**: Defense against common vulnerabilities
- **CWE Top 25**: Prevention of critical weaknesses
- **Google Cloud Security Best Practices**: Cloud-native security
- **Node.js Security Best Practices**: Runtime hardening

## Security Checklist

Before each deployment:

- [ ] All tests pass (`npm test`)
- [ ] No vulnerable dependencies (`npm audit`)
- [ ] No hardcoded secrets in code
- [ ] No plaintext credentials in commits
- [ ] All environment variables are set correctly
- [ ] HTTPS is enforced
- [ ] Rate limiting is configured
- [ ] Input validation is in place
- [ ] Logging does not contain sensitive data
- [ ] Secrets are in Google Cloud Secret Manager

## Questions?

If you have questions about security practices:

1. Check this document
2. Search GitHub issues
3. Create a discussion (non-security questions only)
4. Email security report (security vulnerabilities only)

---

**Last Updated**: 2024-12-19
**Next Review**: 2025-03-19
