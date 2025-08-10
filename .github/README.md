# GitHub Issues Setup

This directory contains the complete GitHub Issues configuration for the project, including templates, automation, and management tools.

## 📁 File Structure

```
.github/
├── ISSUE_TEMPLATE/           # Issue creation templates
│   ├── bug_report.md        # Bug reporting template
│   ├── feature_request.md   # Feature request template
│   ├── performance_issue.md # Performance issue template
│   ├── documentation.md     # Documentation issue template
│   └── config.yml          # Template configuration
├── workflows/               # GitHub Actions workflows
│   └── issue-automation.yml # Issue automation workflow
├── labels.yml              # Label definitions
├── labeler.yml             # Auto-labeling configuration
├── ISSUE_MANAGEMENT.md     # Issue management guide
├── setup-labels.sh         # Label setup script
└── README.md               # This file
```

## 🚀 Quick Setup

### 1. Apply Labels
Run the setup script to create all labels:
```bash
./.github/setup-labels.sh
```

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Repository access permissions

### 2. Update Configuration
Edit these files with your specific information:
- `.github/ISSUE_TEMPLATE/config.yml` - Update contact links
- `CONTRIBUTING.md` - Update project-specific information

### 3. Test Templates
Create test issues using each template to ensure they work correctly.

## 🏷️ Label System

### Priority Labels
- `priority: critical` - Immediate attention needed
- `priority: high` - High priority issues
- `priority: medium` - Medium priority issues
- `priority: low` - Low priority issues

### Component Labels
- `component: web-app` - Web application
- `component: mobile-app` - Mobile app (Android TWA)
- `component: api` - API endpoints
- `component: rss-feeds` - RSS feed system
- `component: music-tracks` - Music track management
- `component: admin-panel` - Admin panel
- `component: caching` - Caching system
- `component: images` - Image optimization

### Status Labels
- `needs-triage` - Initial review needed
- `in-progress` - Work in progress
- `blocked` - Blocked by dependencies
- `ready-for-review` - Ready for review
- `needs-feedback` - Waiting for feedback

## 🔄 Automation Features

### Auto-Labeling
- Issues are automatically labeled based on content and file paths
- Component labels are assigned based on issue content
- Type labels are applied based on template selection

### Issue Triage
- New issues automatically get `needs-triage` label
- Component detection for better organization
- Auto-assignment suggestions for maintainers

### Stale Issue Management
- Issues inactive for 30 days are marked as stale
- Stale issues are closed after 7 more days
- Critical and high-priority issues are exempt

## 📋 Issue Templates

### Available Templates
1. **🐛 Bug Report** - For reporting bugs and issues
2. **✨ Feature Request** - For suggesting new features
3. **🚀 Performance Issue** - For performance problems
4. **📚 Documentation** - For documentation improvements

### Template Features
- Pre-filled labels and assignees
- Structured information gathering
- Component-specific checkboxes
- Priority and impact assessment

## 🛠️ Customization

### Adding New Labels
1. Update `.github/labels.yml`
2. Update `.github/labeler.yml` if auto-labeling is needed
3. Update `.github/ISSUE_MANAGEMENT.md`
4. Consider adding to issue templates

### Modifying Templates
1. Edit files in `.github/ISSUE_TEMPLATE/`
2. Test changes by creating test issues
3. Update documentation as needed

### Workflow Adjustments
1. Modify `.github/workflows/issue-automation.yml`
2. Test in development environment
3. Monitor automation behavior

## 📊 Monitoring

### Key Metrics
- Time to triage
- Issue resolution time
- Label distribution
- Component-specific trends

### Reports
- Weekly issue summaries
- Monthly trend analysis
- Component performance tracking

## 🔗 Useful Links

- **Labels**: `https://github.com/{owner}/{repo}/labels`
- **Issues**: `https://github.com/{owner}/{repo}/issues`
- **Discussions**: `https://github.com/{owner}/{repo}/discussions`
- **Actions**: `https://github.com/{owner}/{repo}/actions`

## 📚 Documentation

- **Issue Management Guide**: `.github/ISSUE_MANAGEMENT.md`
- **Contributing Guide**: `CONTRIBUTING.md`
- **Project README**: `README.md`

## 🆘 Support

For issues with the issue management system itself:
1. Check this README and related documentation
2. Review the issue management guide
3. Create an issue using the bug report template
4. Contact maintainers directly if urgent

---

**Note**: This setup is designed for a Next.js project with RSS feeds, music tracks, admin panels, and mobile app components. Adjust labels and templates as needed for your specific project structure.
