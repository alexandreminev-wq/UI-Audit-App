# Computed Style Keys (MVP)

Purpose:
- Keep capture payload small, stable, and explainable
- Enable grouping/variants later without dumping full getComputedStyle output

## v1 STYLE_KEYS
Typography:
- fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
- textTransform, textDecorationLine, textAlign, whiteSpace

Color/surface:
- color, backgroundColor, opacity

Spacing:
- paddingTop, paddingRight, paddingBottom, paddingLeft
- marginTop, marginRight, marginBottom, marginLeft

Border/shape:
- borderTopWidth, borderTopStyle, borderTopColor
- borderTopLeftRadius, borderTopRightRadius, borderBottomRightRadius, borderBottomLeftRadius

Focus ring:
- outlineStyle, outlineWidth, outlineColor

Elevation:
- boxShadow

Layout essentials:
- display, position, alignItems, justifyContent, gap, zIndex
- overflow, textOverflow

## Notes
- We intentionally avoid pseudo-states (:hover/:focus) in MVP.
- We intentionally avoid full computed style dumps.
