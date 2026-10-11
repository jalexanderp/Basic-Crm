# Basic-Crm — Project Instructions

## Project overview

This repository contains a Google Apps Script CRM application. The project uses server-side `.gs` files, HTML templates for the user interface, and `appsscript.json` for Apps Script configuration.

## Architecture

* `.gs` files contain server-side JavaScript and business logic.
* `.html` files contain UI templates, styles, and client-side JavaScript.
* `appsscript.json` defines the Google Apps Script project configuration.
* The application includes customer, event, sales, calendar, spreadsheet, API, and shared utility functionality.

Treat the existing source code as the authoritative description of the architecture. Do not assume functions, data structures, or integrations exist without inspecting the relevant files.

## Development rules

1. Before modifying code, inspect the relevant files and trace related function calls.
2. Reuse existing functions and conventions whenever possible. Avoid unnecessary rewrites.
3. Keep changes focused on the requested task.
4. Preserve existing behavior unless the user explicitly requests a behavior change.
5. Consider both server-side `.gs` code and client-side `.html` code when a change crosses the frontend/backend boundary.
6. For Google Apps Script HTML templates, preserve the correct use of template scriptlets such as `<? ... ?>`, `<?= ... ?>`, and `<?!= ... ?>`.
7. Respect Apps Script service constraints, authorization requirements, quotas, and execution limits.
8. Do not introduce external libraries, dependencies, services, or infrastructure without explaining why and obtaining approval.
9. Do not invent spreadsheet IDs, sheet names, column indexes, API endpoints, configuration keys, or deployment identifiers. Inspect the existing implementation first.
10. Follow the current project's naming, formatting, and error-handling conventions.

## Safety and permissions

* Never deploy the application, publish a new version, change deployment settings, or modify production data without explicit user authorization.
* Never execute destructive spreadsheet operations or bulk data changes without explaining their impact and obtaining approval.
* Do not expose passwords, API keys, OAuth tokens, or other secrets in source code, logs, or Git commits.
* Do not overwrite user changes or revert unrelated work.
* Ask before changing authentication, authorization scopes, or access permissions.

## Git workflow

* Inspect `git status` before making changes.
* Keep modifications limited to the requested task.
* Review the diff before considering a task complete.
* Do not commit, push, or create a pull request unless the user explicitly requests it.
* Explain any relevant testing limitations, especially when Google services cannot be tested locally.

## Working style

* Explain the intended change before making substantial edits.
* Prefer small, reviewable changes.
* Report the files changed, the reason for each change, and the checks performed.
* If requirements are ambiguous or important implementation details are missing, ask before making assumptions.

## Local development

* Prefer local inspection and validation before interacting with Google services.
* Treat synchronization through `clasp` and deployment to Google Apps Script as separate operations.
* Never assume that a local code change has been uploaded or deployed.
