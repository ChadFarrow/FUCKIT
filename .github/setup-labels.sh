#!/bin/bash

# GitHub Labels Setup Script
# This script helps set up all the labels defined in labels.yml

echo "🚀 Setting up GitHub Labels..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📦 Repository: $REPO"

# Function to create label
create_label() {
    local name="$1"
    local color="$2"
    local description="$3"
    
    echo "🏷️  Creating label: $name"
    gh api repos/$REPO/labels \
        -f name="$name" \
        -f color="$color" \
        -f description="$description" \
        --silent
    
    if [ $? -eq 0 ]; then
        echo "✅ Created: $name"
    else
        echo "❌ Failed to create: $name"
    fi
}

echo ""
echo "📋 Creating Priority Labels..."
create_label "priority: critical" "d73a4a" "Critical issues that need immediate attention"
create_label "priority: high" "d93f0b" "High priority issues"
create_label "priority: medium" "fbca04" "Medium priority issues"
create_label "priority: low" "0e8a16" "Low priority issues"

echo ""
echo "📋 Creating Type Labels..."
create_label "bug" "d73a4a" "Something isn't working"
create_label "enhancement" "a2eeef" "New feature or request"
create_label "documentation" "0075ca" "Improvements or additions to documentation"
create_label "performance" "ff8c00" "Performance improvements or issues"
create_label "security" "ee0701" "Security vulnerabilities or improvements"

echo ""
echo "📋 Creating Status Labels..."
create_label "needs-triage" "d4c5f9" "Issues that need initial review"
create_label "in-progress" "1d76db" "Work in progress"
create_label "blocked" "ff8c00" "Blocked by other issues or dependencies"
create_label "ready-for-review" "0e8a16" "Ready for code review"
create_label "needs-feedback" "fbca04" "Waiting for user feedback"

echo ""
echo "📋 Creating Component Labels..."
create_label "component: web-app" "c2e0c6" "Web application related"
create_label "component: mobile-app" "c2e0c6" "Mobile app (Android TWA) related"
create_label "component: api" "c2e0c6" "API endpoints and backend"
create_label "component: rss-feeds" "c2e0c6" "RSS feed system"
create_label "component: music-tracks" "c2e0c6" "Music track management"
create_label "component: admin-panel" "c2e0c6" "Admin panel functionality"
create_label "component: caching" "c2e0c6" "Caching system"
create_label "component: images" "c2e0c6" "Image optimization and handling"

echo ""
echo "📋 Creating Special Labels..."
create_label "good first issue" "7057ff" "Good for newcomers"
create_label "help wanted" "008672" "Extra attention is needed"
create_label "duplicate" "cfd3d7" "This issue or pull request already exists"
create_label "wontfix" "ffffff" "This will not be worked on"
create_label "invalid" "e4e669" "Something is wrong"
create_label "question" "d876e3" "Further information is requested"

echo ""
echo "🎉 Label setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Review the created labels in your GitHub repository"
echo "2. Test the issue templates by creating a test issue"
echo "3. Check that the automation workflows are working"
echo "4. Update the contact links in .github/ISSUE_TEMPLATE/config.yml"
echo ""
echo "🔗 View your labels: https://github.com/$REPO/labels"
echo "🔗 View your issues: https://github.com/$REPO/issues"
