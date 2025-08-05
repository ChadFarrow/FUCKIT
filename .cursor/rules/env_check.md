# Environment Variables Check Rule

## **Main Points in Bold**
- **Always check `.env.local` file existence and contents when starting a new chat**
- **Verify required API keys and configuration are present**
- **Alert user if critical environment variables are missing**
- **Provide guidance on setting up missing variables**

## **Automatic Environment Check Process**

When a new chat session begins, automatically:

1. **Check for `.env.local` file existence**
   - If file doesn't exist, inform user and provide setup instructions
   - If file exists, proceed to content verification

2. **Verify required environment variables**
   - Check for Podcast Index API credentials:
     - `PODCAST_INDEX_API_KEY`
     - `PODCAST_INDEX_API_SECRET`
   - Check for other common API keys used in the project
   - Verify database connection strings if applicable

3. **Provide status report**
   - List found environment variables (without exposing values)
   - Highlight any missing critical variables
   - Suggest next steps for configuration

## **Common Environment Variables to Check**

- **Podcast Index API**: `PODCAST_INDEX_API_KEY`, `PODCAST_INDEX_API_SECRET`
- **Database**: `DATABASE_URL`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`
- **Authentication**: `JWT_SECRET`, `SESSION_SECRET`
- **External APIs**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- **CDN/Storage**: `CDN_URL`, `STORAGE_BUCKET`

## **Security Considerations**

- **Never expose actual environment variable values**
- **Only show variable names and presence/absence**
- **Remind users to keep `.env.local` in `.gitignore`**
- **Suggest using environment-specific files (`.env.development`, `.env.production`)**

## **Integration with Project Workflow**

- **Check environment before running scripts or commands**
- **Validate configuration before API calls**
- **Provide fallback suggestions for missing variables**
- **Integrate with existing project setup documentation**

## **Available Scripts**

- `node scripts/check-env.js` - Check environment variables status
- Use this script to verify configuration before running other commands 