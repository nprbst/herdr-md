# herdr-md

Markdown rendered natively in a Herdr pane: real type, your theme's colors,
images, math and Mermaid diagrams, with APIs for AI to read, highlight and
annotate the document alongside you.

```mermaid
flowchart LR
  A[Agent edits a doc] --> B{herdr-md}
  B -->|diff| C[Changed blocks marked]
  B -->|mdh hl| D[Highlight + note]
  C --> E[You reread only what changed]
  D --> E
```

![A line fitted through the data](hero-fit.png)
