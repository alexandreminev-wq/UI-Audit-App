# Capture Record (MVP)

A capture record is created when the user click-to-captures an element.

## v1 fields (proposed)
- id: string (stable-ish id for our record)
- createdAt: number (ms since epoch)
- url: string
- element:
  - tagName: string
  - id: string
  - classList: string[]
  - role: string | null
  - textPreview: string
  - attributes (minimal):
    - ariaLabel?: string
    - ariaLabelledBy?: string
    - ariaExpanded?: string
    - ariaChecked?: string
    - ariaSelected?: string
    - ariaDisabled?: string
    - ariaCurrent?: string
- boundingBox:
  - left, top, width, height (number)
- viewport:
  - width, height (number)
  - scrollX, scrollY (number)
- styles:
  - computed: Record<STYLE_KEY, string>

## Example record (shape only)
```json
{
  "id": "cap_...",
  "createdAt": 0,
  "url": "https://example.com/page",
  "element": {
    "tagName": "button",
    "id": "save",
    "classList": ["btn", "btn-primary"],
    "role": null,
    "textPreview": "Save",
    "attributes": { "ariaDisabled": "false" }
  },
  "boundingBox": { "left": 10, "top": 20, "width": 120, "height": 40 },
  "viewport": { "width": 1440, "height": 900, "scrollX": 0, "scrollY": 120 },
  "styles": { "computed": { "fontSize": "14px", "backgroundColor": "rgb(...)" } }
}
