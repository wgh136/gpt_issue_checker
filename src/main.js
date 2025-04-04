import * as core from '@actions/core'
import * as github from '@actions/github'
import OpenAI from 'openai'

const defaultPrompt = `You are a repository issue checker. 
You are given an issue content and you need to decide whether to close the issue. 
If you decide to close the issue, you should also provide a comment explaining why you are closing the issue. 
If you decide not to close the issue, you should provide a comment explaining why you are not closing the issue.
You should response with a JSON object with the following keys: should_close, should_comment, comment.
`

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    let model = core.getInput('model')
    let prompt = core.getInput('prompt')
    let apiUrl = core.getInput('api-url')
    const apiKey = core.getInput('api-key')
    const githubToken = core.getInput('github-token')

    if (prompt === '') {
      prompt = defaultPrompt
    }
    if (model === '') {
      model = 'gpt-4o-mini'
    }
    if (apiUrl === '') {
      apiUrl = 'https://api.openai.com'
    }
    if (apiKey === '') {
      core.setFailed('No API key found')
      return
    }
    if (githubToken === '') {
      core.setFailed('No GitHub token found')
      return
    }

    const context = github.context
    if (!context.eventName.startsWith('issue')) {
      core.setFailed('This action can only be run on issue events')
      return
    }
    const issue = context.payload.issue
    if (!issue) {
      core.setFailed('No issue found in the context')
      return
    }
    const issueNumber = issue.number
    const issueTitle = issue.title
    const issueBody = issue.body

    const content = `${issueTitle}\n${issueBody}`
    const { should_close, should_comment, comment } = await checkIssue(
      content,
      apiUrl,
      apiKey,
      prompt,
      model
    )
    const octokit = github.getOctokit(githubToken)
    if (should_close) {
      core.info(`Closing issue ${issueNumber}`)

      await octokit.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        state: 'closed'
      })
    }
    if (should_comment) {
      core.info(`Commenting on issue ${issueNumber}`)
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        body: comment
      })
    }
    core.setOutput('result', should_close ? 'closed' : 'open')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function checkIssue(content, apiUrl, apiKey, prompt, model) {
  let retry = 3
  while (true) {
    try {
      const client = new OpenAI({ baseURL: apiUrl, apiKey: apiKey })
      const completion = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: content }
        ]
      })
      const message = completion.choices[0]?.message.content
      if (!message) {
        throw new Error('No message found in the completion')
      }
      let json
      if (message.startsWith('```')) {
        let lines = message.split('\n')
        if (lines.length < 2) {
          throw new Error('No JSON found in the completion')
        }
        json = JSON.parse(lines.slice(1, lines.length - 1).join('\n'))
      } else {
        json = JSON.parse(message)
      }
      let should_close = json.should_close === true
      let should_comment = false
      if (json.should_comment === true) {
        should_comment = true
      } else if (json !== false) {
        should_comment = typeof json.comment === 'string' && json.comment !== ''
      }

      return {
        should_close: should_close,
        should_comment: should_comment,
        comment: json.comment
      }
    } catch (error) {
      if (error instanceof Error) {
        core.error(error.message)
        if (retry > 0) {
          core.info(`Retrying... ${retry} attempts left`)
          retry -= 1
          continue
        }
        throw error
      }
    }
  }
}
