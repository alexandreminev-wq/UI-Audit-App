# Architecture (MVP)

## Contexts
- Popup UI: user controls only
- Service Worker: orchestration + persistence + screenshots (no DOM)
- Content Script: DOM inspection + overlay + style extraction

## Messaging rules
- All communication via chrome.runtime.sendMessage
- Content script does not use DOM-unsafe Chrome APIs
- Service worker never touches the DOM

## Current message types (high level)
- AUDIT/TOGGLE (popup -> SW -> CS)
- AUDIT/GET_STATE -> AUDIT/STATE (popup/CS -> SW)
- AUDIT/ELEMENT_SELECTED (CS -> SW, stored per tab)
- AUDIT/CAPTURE_REQUEST / AUDIT/PING (legacy milestone 0 ping)

## Known MV3 behavior
- Popup closes on page click (expected)
- After extension reload, refresh page to re-inject content script
