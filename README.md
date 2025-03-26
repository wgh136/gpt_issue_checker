# Gpt Issue Checker

Use gpt to check issue. Close issue with a comment if it is not a valid issue.

## Usage

```yaml
name: Check Issue

on:
  issues:
    types: [opened]

permissions:
  contents: read
  issues: write

jobs:
  check:
    name: Check Issue
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        id: checkout
        uses: actions/checkout@v4

      - name: Check Issue
        id: check
        uses: wgh136/issue-checker@v1
        with:
          api-url: ${{ secrets.API_URL }} # Optional. default: https://api.openai.com/v1
          api-key: ${{ secrets.API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          prompt: 'You are a repository issue checker. Please ...' # Optional.
          model: 'gpt-4o-mini' # Optional. default: 'gpt-4o-mini'
```

The default prompt is:

> You are a repository issue checker.
> You are given an issue content and you need to decide whether to close the issue.
> If you decide to close the issue, you should also provide a comment explaining why you are closing the issue.
> If you decide not to close the issue, you should provide a comment explaining why you are not closing the issue.
> You should response with a JSON object with the following keys: should_close, should_comment, comment.

