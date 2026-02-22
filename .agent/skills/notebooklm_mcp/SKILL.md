---
name: NotebookLM Expert
description: Expert skill for interacting with NotebookLM via MCP for deeply researched, context-aware analysis and content generation.
---

# NotebookLM Expert Skill

## Overview
This skill defines the standard operating procedure for using the NotebookLM MCP server. It ensures all interactions are context-aware, research-backed, and efficiently managed.

## When to Use
- **Deep Research**: When you need to gather extensive information on a specific topic.
- **Complex Q&A**: When answering questions that require synthesizing multiple sources or understanding large documents.
- **Content Generation**: When creating content based on researched material or specific documents.
- **Contextual Analysis**: When you need to analyze information in the context of the user's specific situation (using local context files).

## Core Behaviors

### 1. Creating New Notebooks
**Rule**: Always ground new notebooks in the user's specific context.
- **Action**: Before or immediately after creating a new notebook, strictly reference the user's business context files (e.g., `jack.md`, `me.md`, or other "about me" documents in the workspace).
- **Goal**: Ensure the notebook's AI understands *who* the user is, their niche, goals, and limitations.

### 2. Deep Research Workflow
**Rule**: Isolate topics and maximize source quality.
- **Action**: Create a **separate notebook** for each distinct research topic.
- **Configuration**: Configure the research tool to gather approximately **40 high-quality sources** per notebook.
- **Process**:
    1.  Initiate the deep research task.
    2.  **Wait approximately 5 minutes** for the research to complete.
    3.  **Open the notebook in the browser** using the `open_browser_url` tool (or by providing the link to the user) to verify completion.
    4.  **Import all suggested resources** automatically. Do *not* ask the user to manually click to add sources if you can trigger the import via tools.

### 3. Answering Questions
**Rule**: Local Context + NotebookLM Context = Complete Answer.
- **Sequence**:
    1.  **Check Local Context**: First, read local files in the current workspace to understand the immediate constraints, goals, and identity of the user.
    2.  **Consult NotebookLM**: Query the most relevant NotebookLM notebook via MCP.
    3.  **Synthesize**: Combine the immediate local context with the broad/deep knowledge from NotebookLM to formulate the answer.

### 4. Adding Local Files
**Rule**: Pre-process local files for optimal ingestion.
- **Action**:
    1.  **Detect File Type**: Identify if the file is Markdown, Text, PDF, etc.
    2.  **Convert if Necessary**: If the format is not directly supported or optimal for the MCP tool, convert the content to plain text.
    3.  **Add to Notebook**: Use the appropriate MCP tool to upload/add the processed text to the relevant NotebookLM notebook.

## Maintenance
**Rule**: Keep this skill evolving.
- **Action**: Whenever you identify a new, better way to work with NotebookLM (e.g., a new effective prompting strategy, a better way to organize folders, or a new constraint), **update this `SKILL.md` file immediately**.
- **Goal**: Ensure future sessions automatically benefit from these improvements without relearning guidelines.
