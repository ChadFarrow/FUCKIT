# 🔒 Security Guidelines

## API Key Protection

### ✅ **DO:**
- Store API keys in `.env.local` (already gitignored)
- Use environment variables in production (Vercel)
- Rotate API keys regularly
- Use different keys for development and production

### ❌ **DON'T:**
- Commit API keys to Git repository
- Include API keys in documentation files
- Share API keys in public repositories
- Use the same key across multiple projects

## Current Security Status

### Protected Files:
- ✅ `.env.local` - Local environment variables
- ✅ `.env.example` - Template without real keys
- ✅ `SECURITY.md` - This security guide
- ✅ All environment files (`.env*`)
- ✅ All key files (`*.key`, `*.pem`, `*.p12`, etc.)
- ✅ All credential files (`secrets.json`, `credentials.json`, etc.)
- ✅ SSH keys and certificates
- ✅ Cloud service credentials (AWS, GCP, Azure)
- ✅ Database files with potential credentials
- ✅ Docker and Kubernetes secrets

### Files with Placeholder Keys:
- ⚠️ `BUILD_LOG.md` - Contains placeholder for reference
- ⚠️ `vercel.json` - Contains production key (needs Vercel secrets)

## Emergency Response

If an API key is exposed:

1. **IMMEDIATELY** revoke the exposed key
2. Generate a new API key
3. Update all environment variables
4. Check Git history for other exposures
5. Consider using Git filter-branch to remove from history

## Best Practices

### Environment Variables
```bash
# ✅ Correct - in .env.local (not committed)
BUNNY_CDN_API_KEY=your-actual-key-here

# ❌ Wrong - in committed files
BUNNY_CDN_API_KEY=your-actual-key-here
```

### Vercel Deployment
```json
// ✅ Use Vercel environment variables
{
  "env": {
    "BUNNY_CDN_API_KEY": "@bunny_cdn_api_key"
  }
}
```

## Monitoring

- Enable GitGuardian alerts
- Regular security audits
- Monitor API usage for unusual activity
- Keep dependencies updated
- Pre-commit security checks (automatic)
- Enhanced pattern detection for sensitive data

## Pre-commit Security Checks

The `scripts/security-check.sh` script automatically checks for:
- API keys and secrets
- Database connection strings
- Cloud service credentials (AWS, GCP, Azure)
- Email addresses (with warnings)
- Common sensitive data patterns
- UUID format keys

Run manually: `./scripts/security-check.sh`

---

**Last Updated:** January 2025  
**Security Status:** ✅ Protected 