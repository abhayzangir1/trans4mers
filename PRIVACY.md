# Privacy Policy

Trans4mers is built with **privacy-first** principles. Your data is yours.

## Core Privacy Guarantees

### ✅ What Stays on Your Computer

When running Trans4mers locally, the following **NEVER** leave your system:

- Conversations and chat history
- Agent memories and embeddings
- Project files and workspace data
- Personal information or sensitive documents
- Analysis results and generated content
- System prompts and agent configurations
- File contents and database records

### ❌ What Does NOT Stay Local

The following require external connections (user-controlled):

- **LLM API Calls**: If you use OpenAI, Anthropic, or Groq APIs, prompts are sent to those services
  - Solution: Use free local models via Ollama
  - You control: Disable internet access, use air-gapped setup
  
- **File Uploads**: If you intentionally upload files to external services
  - Solution: Keep everything local
  - You control: Choose not to use upload features

### 🔒 What We Collect (Zero by Default)

Trans4mers **never collects**:

- ❌ Usage analytics or telemetry
- ❌ Crash reports (without your explicit consent)
- ❌ Performance metrics
- ❌ Personal identification information
- ❌ IP addresses for tracking
- ❌ Device information
- ❌ Behavioral data

All data stays on **your computer**, in **your databases**, under **your control**.

## Configuration & Control

### Disable Telemetry

Telemetry is **OFF by default**:

```bash
# Environment variable (should be set)
NEXT_TELEMETRY_DISABLED=1
```

### Control Network Access

Every external network call requires your approval:

```typescript
// Before any external request:
const approved = await requestUserApproval({
  url: "https://example.com/api",
  method: "POST",
  preview: "Sending 500 characters to external service"
});

if (!approved) {
  throw new Error("User denied network access");
}
```

### Review What's Stored

All data is stored locally in transparent formats:

```
~/.trans4mers/
├── data/
│   ├── state.db          # SQLite database (human-readable schema)
│   └── embeddings/       # Vector store (queryable)
├── workspaces/           # Your projects
└── config/               # Your settings (TOML format)
```

You can inspect, backup, or delete any data anytime.

### Export Your Data

All data can be exported:

```bash
# Export project
trans4mers export project-id > my-project.json

# Export conversations
trans4mers export conversations --format=json

# Export agent memory
trans4mers export memory agent-id > agent-memory.json

# Backup entire workspace
cp -r ~/.trans4mers ~/backups/trans4mers-backup
```

## Data Storage

### Local Storage

Data stored on your computer:

| Data | Storage | Encryption |
|------|---------|------------|
| Conversations | SQLite | Optional (user-controlled) |
| Embeddings | LanceDB | Optional (user-controlled) |
| Projects | Filesystem | Optional (user-controlled) |
| Agent memory | Vector DB | Optional (user-controlled) |
| Config | TOML files | Optional (user-controlled) |

### Cloud Storage (Optional)

If you choose to backup to cloud:

- You control where it goes
- You control the encryption key
- You control the retention policy
- We do not have access to your backups

Supported providers:
- Google Cloud Storage (your GCS bucket)
- AWS S3 (your S3 bucket)
- Azure Blob Storage (your storage account)
- Manual encrypted backups

## API Usage & BYOK

### Bring Your Own Keys (BYOK)

You provide your own API credentials:

```env
# Your keys, your control
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GROQ_API_KEY=...
```

- You manage API quotas and billing
- You control which services to use
- You can revoke access anytime
- Your keys are stored **locally only** (never sent to us)

### What Happens When Using External APIs

When you use OpenAI/Anthropic/etc.:

1. Your prompt is sent to that service
2. That service processes and responds
3. The response stays on your computer
4. Trans4mers does **NOT** log or store the prompt

**You are responsible for that service's privacy terms.**

## Third-Party Services

### Ollama (Local LLM)

- Runs on your computer
- No external calls
- No logging
- No tracking

### Google Cloud (Optional)

If deployed to Cloud Run:

- Service itself can access files it needs
- Google Cloud Platform privacy terms apply
- You control: Can deploy to your own infrastructure instead

### Browserbase (Optional)

If using web automation:

- For authenticated access to websites
- You provide the API key
- Credentials stored locally only
- Usage subject to Browserbase terms

## Security & Encryption

### At-Rest Encryption (Optional)

You can encrypt stored data:

```bash
# Enable encryption
trans4mers config set encryption.enabled=true
trans4mers config set encryption.key="your-secure-key"

# All data now encrypted at rest
# SQLite: Transparent encryption via SQLCipher
# Files: AES-256-GCM
```

### In-Transit Encryption

- Local connections: Unencrypted (no network exposure)
- External APIs: Always HTTPS/TLS
- Cloud backups: You control encryption

### Key Management

- You own all encryption keys
- Keys never sent to external services
- We cannot decrypt your data even if requested
- Lost keys = permanent data loss (so back them up!)

## User Rights

### Right to Access

You can access all your data:

```bash
# View database schema
sqlite3 ~/.trans4mers/data/state.db ".schema"

# Export conversations
sqlite3 ~/.trans4mers/data/state.db "SELECT * FROM messages;"

# View file storage
ls -la ~/.trans4mers/workspaces/
```

### Right to Delete

You can delete all your data:

```bash
# Delete everything
rm -rf ~/.trans4mers/

# Delete project
trans4mers delete project-id

# Delete conversation
trans4mers delete conversation-id
```

### Right to Portability

You can move your data:

```bash
# Export to standard formats
trans4mers export --format=json --output=my-data.json

# Move to another computer
cp -r ~/.trans4mers /mnt/usb/backup/
```

### Right to Privacy

We:
- Do not track you
- Do not profile you
- Do not sell your data
- Do not share with third parties
- Do not require accounts or login
- Do not require email or personal info

## Transparency & Audit

### Open Source

Trans4mers is open source (MIT license):

- You can review the code
- You can verify we don't collect data
- You can build from source
- You can audit dependencies

### Security Audits

Regular security audits:

- Code review for telemetry
- Dependency vulnerability scanning
- Network traffic analysis
- Third-party security assessment

### Incident Response

If a security issue is discovered:

1. Immediate response (within 24 hours)
2. Root cause analysis
3. Fix development
4. Public disclosure (after fix is available)
5. Notification to affected users

## Comparison with Alternatives

| Feature | Trans4mers | OpenAI | Anthropic | Google |
|---------|-----------|--------|-----------|--------|
| **Data stored locally** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **End-to-end encrypted** | ✅ Optional | ❌ No | ❌ No | ❌ No |
| **Requires login** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Collects telemetry** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Open source code** | ✅ Yes | ❌ No | ❌ No | ⚠️ Partial |
| **Offline operation** | ✅ Yes (local LLMs) | ❌ No | ❌ No | ❌ No |
| **BYOK support** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Free to use** | ✅ Yes | ❌ No | ❌ No | ❌ No |

## Changes to This Policy

We may update this policy. When we do:

1. **Notification**: Announced in GitHub releases
2. **Waiting period**: 30 days before changes take effect
3. **Opt-out**: You can opt out and keep previous version
4. **No degradation**: We never reduce privacy by default

Current version: **2024-12-19**

## Questions?

If you have privacy concerns:

1. **Read the source code**: https://github.com/abhayzangir1/trans4mers
2. **Open an issue**: Ask on GitHub (public)
3. **Email**: privacy@trans4mers.dev (when available)
4. **Discussion**: Start a discussion on GitHub

## Privacy Checklist

Before using Trans4mers, you should know:

- [ ] Your data stays on your computer
- [ ] You own your API credentials
- [ ] You control what gets backed up
- [ ] You can delete everything anytime
- [ ] We collect zero telemetry
- [ ] You can inspect the source code
- [ ] External API usage is your choice
- [ ] Encryption is optional but recommended

---

**Trans4mers: Privacy First, Always.**

Because your data is yours.
