# Issue Management Guide

This guide provides comprehensive information for managing issues in the repository.

## 🏷️ Label System

### Priority Labels
- **`priority: critical`** - Immediate attention required, affects core functionality
- **`priority: high`** - Important issues that should be addressed soon
- **`priority: medium`** - Standard priority issues
- **`priority: low`** - Nice-to-have improvements

### Type Labels
- **`bug`** - Something isn't working as expected
- **`enhancement`** - New feature or improvement request
- **`documentation`** - Documentation improvements needed
- **`performance`** - Performance issues or optimizations
- **`security`** - Security vulnerabilities or improvements

### Status Labels
- **`needs-triage`** - Initial review and categorization needed
- **`in-progress`** - Work has started on this issue
- **`blocked`** - Blocked by other issues or dependencies
- **`ready-for-review`** - Ready for code review
- **`needs-feedback`** - Waiting for user feedback or clarification

### Component Labels
- **`component: web-app`** - Web application related
- **`component: mobile-app`** - Mobile app (Android TWA) related
- **`component: api`** - API endpoints and backend
- **`component: rss-feeds`** - RSS feed system
- **`component: music-tracks`** - Music track management
- **`component: admin-panel`** - Admin panel functionality
- **`component: caching`** - Caching system
- **`component: images`** - Image optimization and handling

## 🔄 Issue Lifecycle

### 1. Issue Creation
- Users create issues using templates
- Issues automatically get `needs-triage` label
- Component labels are auto-assigned based on content

### 2. Triage Process
- Review issue for completeness and clarity
- Add appropriate priority and type labels
- Assign to relevant team members if needed
- Add component labels if missing

### 3. Development
- Change status to `in-progress` when work begins
- Update issue with progress updates
- Link related PRs to the issue

### 4. Review
- Change status to `ready-for-review` when complete
- Request reviews from team members
- Address feedback and make necessary changes

### 5. Resolution
- Close issue when resolved
- Add resolution notes if needed
- Link to related documentation updates

## 📋 Triage Checklist

### For Bug Reports
- [ ] Issue is reproducible
- [ ] Steps to reproduce are clear
- [ ] Expected vs actual behavior is documented
- [ ] Device/browser information is provided
- [ ] Screenshots or error logs are included

### For Feature Requests
- [ ] Problem statement is clear
- [ ] Proposed solution is well-defined
- [ ] Use cases are documented
- [ ] Impact assessment is provided
- [ ] Related issues are linked

### For Performance Issues
- [ ] Performance metrics are provided
- [ ] Device/network context is documented
- [ ] Performance screenshots are included
- [ ] Issue affects user experience significantly

## 🚀 Automation Features

### Auto-Labeling
- Issues are automatically labeled based on file paths
- Component labels are assigned based on content
- Priority labels can be auto-assigned based on keywords

### Issue Triage
- New issues automatically get `needs-triage` label
- Component detection based on issue content
- Auto-assignment suggestions for maintainers

### Stale Issue Management
- Issues inactive for 30 days are marked as stale
- Stale issues are closed after 7 more days
- Critical and high-priority issues are exempt

## 📊 Issue Metrics

### Key Performance Indicators
- **Time to Triage**: Average time from creation to first response
- **Resolution Time**: Average time from creation to resolution
- **Issue Volume**: Number of issues created per week/month
- **Label Distribution**: Breakdown of issues by type and priority

### Reporting
- Weekly issue summary reports
- Monthly trend analysis
- Component-specific issue tracking
- Priority distribution monitoring

## 🎯 Best Practices

### For Maintainers
- **Respond Quickly**: Acknowledge new issues within 24 hours
- **Be Clear**: Use clear, actionable language in responses
- **Set Expectations**: Communicate timelines and next steps
- **Follow Up**: Check in on long-running issues regularly

### For Contributors
- **Use Templates**: Always use the appropriate issue template
- **Provide Context**: Include relevant information and screenshots
- **Be Specific**: Describe the problem clearly and concisely
- **Follow Up**: Respond to questions and requests for information

### For Issue Creation
- **Search First**: Check for existing issues before creating new ones
- **Be Descriptive**: Provide enough detail for others to understand
- **Use Labels**: Apply appropriate labels to help with organization
- **Link Related**: Reference related issues, PRs, or discussions

## 🔧 Customization

### Adding New Labels
1. Update `.github/labels.yml`
2. Update `.github/labeler.yml` if auto-labeling is needed
3. Update this guide with label descriptions
4. Consider adding to issue templates if relevant

### Modifying Templates
1. Edit the appropriate template file in `.github/ISSUE_TEMPLATE/`
2. Test the template by creating a test issue
3. Update this guide if workflow changes

### Workflow Adjustments
1. Modify `.github/workflows/issue-automation.yml`
2. Test changes in a development environment
3. Monitor automation behavior after deployment

## 📞 Support

### Getting Help
- **Documentation**: Check this guide and other project docs
- **Team Chat**: Reach out to the development team
- **GitHub Discussions**: Use the project's discussion board
- **Email**: Contact maintainers directly for urgent issues

### Feedback
- **Suggestions**: Create issues for workflow improvements
- **Bug Reports**: Report automation or tooling issues
- **Feature Requests**: Suggest new automation features

---

**Remember**: The goal is to make issue management efficient and user-friendly while maintaining high-quality communication and organization.
