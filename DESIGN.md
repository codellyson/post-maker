---
name: Post maker
description: Today's best few posts for each product, as live tiles under a giant product name.
colors:
  cyan: "#00bde3"
  magenta: "#e6007e"
  lime: "#a4e600"
  orange: "#f09609"
  purple: "#a259ff"
  ground: "#000000"
  ink: "#ffffff"
  ink-2: "#b9b9b9"
  ink-3: "#8a8a8a"
  ink-dim: "#5a5a5a"
  outline-quiet: "#4a4a4a"
  line: "#2a2a2a"
  raise: "#111111"
typography:
  display:
    fontFamily: "Noto Sans Display, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(84px, 11.5vw, 184px)"
    fontWeight: 200
    lineHeight: 1.08
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Noto Sans Display, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(40px, 4.4vw, 64px)"
    fontWeight: 300
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Noto Sans Display, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(30px, 2.8vw, 42px)"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Noto Sans Display, Segoe UI, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 300
    lineHeight: 1
  body-lg:
    fontFamily: "Noto Sans Display, Segoe UI, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 300
    lineHeight: 1.4
  body:
    fontFamily: "Noto Sans Display, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 300
    lineHeight: 1.5
  button:
    fontFamily: "Noto Sans Display, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 300
  label:
    fontFamily: "Noto Sans Display, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.05em"
rounded:
  square: "0px"
spacing:
  tile-gap: "10px"
  sm: "8px"
  md: "18px"
  lg: "26px"
  column: "36px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ground}"
    typography: "{typography.button}"
    rounded: "{rounded.square}"
    padding: "0 18px"
    height: "52px"
  button-ghost:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.square}"
    padding: "0 18px"
    height: "52px"
  button-ghost-hover:
    textColor: "{colors.cyan}"
  button-done:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ground}"
  nav-square:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.square}"
    size: "52px"
  nav-square-active:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ground}"
  tile:
    textColor: "{colors.ground}"
    rounded: "{rounded.square}"
    padding: "18px 20px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "12px 14px"
  pill-draft:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    padding: "5px 8px"
  pill-ok:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    padding: "5px 8px"
  toast:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ground}"
    padding: "12px 18px"
---

# Design System: Post maker

## Overview

**Creative North Star: "The Live Tile Board"**

Post maker is a black board of flat colour fields and huge light lowercase type. The product name sits across the top so large it crops at the right edge, with the next product peeking in; today's posts sit under it as square tiles that slowly flip between the post's visual and its first line. Everything else is quiet: white and grey text on black, thin square outlines, and one cyan that marks whatever is live, chosen or next.

The density is low on purpose. A visit lasts five minutes, so the screen leads with very few, very large things: one name, a handful of tiles, one cyan button. Type does the structural work that cards, panels and shadows do elsewhere. Colour is used at full strength or not at all.

The system has two outer borders it must respect. The post visuals inside the feed previews belong to the customer's product and are drawn in that product's own brand (for Passalong: a dark brown radial ground, Inter, Instrument Serif italic, an orange accent). The feed frames around them copy the light X, LinkedIn and Instagram chrome. Neither is Post maker's look, and none of their values are tokens here.

**Key Characteristics:**
- Pure black ground, white ink, five flat fills (cyan, magenta, lime, orange, purple).
- One typeface, Noto Sans Display, in light weights and lowercase, giant at the top.
- Square everything: no rounded corners anywhere in the app chrome.
- Flat colour tiles with black type, a dot-matrix patch and a slow flip.
- Cyan is the one colour that means "live": the current page, the main action, focus, section headings.

## Colors

Five saturated flat fills on pure black, with a short grey scale for text and rules.

### Primary
- **Live Cyan** (cyan): the one state colour. The current nav square, the primary copy button, focus outlines, the toast, the current setup step, checkboxes, section headings and their underline, counts in the product list, the "my products" label. It also appears as an ordinary tile fill.

### Secondary
- **Hot Magenta** (magenta): a tile and product fill; also the over-limit character count, its only text use.
- **Signal Lime** (lime): a tile and product fill; also means done or approved (the done button, the "approved" pill, finished setup steps).
- **Warm Orange** (orange): a tile and product fill; also means draft or warning (the draft pill, the warning strip, the mock flag).

### Tertiary
- **Bright Purple** (purple): a tile and product fill only. It carries no state meaning.

### Neutral
- **Ground Black** (ground): the page ground, and the type colour on every coloured fill.
- **Ink White** (ink): headings, the current product name, selected text, ghost button outlines.
- **Soft Grey** (ink-2): secondary text, nav labels, status line, field outlines.
- **Muted Grey** (ink-3): timestamps, hints, small notes, struck-out posts.
- **Dim Grey** (ink-dim): the products and platforms you are not on (pivot names, unselected platform tabs), placeholders. Large text only.
- **Quiet Outline** (outline-quiet): the outline of nav squares at rest. Not for text.
- **Rule Grey** (line): dividers in the rail and table headers.
- **Raise** (raise): the hover wash on editable text and the empty screenshot well.

### Named Rules
**The One Live Colour Rule.** Cyan is the only colour that marks state: current, focused, primary, in progress. Other hues may mark meaning (lime done, orange draft, magenta over limit) but never "you are here".

**The Flat Fill Rule.** Fills are flat at full strength: no gradients, no tints, no bevels, no outlines around a coloured field. Type on a fill is always black.

**The Not Our Brand Rule.** Post visuals render in the customer product's own brand, and feed frames copy the platform's light chrome. Never pull their fonts, radii, shadows or colours into the app, and never push Post maker's into them.

## Typography

**Display Font:** Noto Sans Display (with Segoe UI, system-ui)
**Body Font:** Noto Sans Display (with Segoe UI, system-ui)

**Character:** One humanist display sans at light weights (200 to 300), set lowercase. Size and weight contrast do all the work; there is no second family in the chrome.

### Hierarchy
- **Display** (200, clamp 84 to 184px, 68px on phones, line-height 1.08, tight tracking): the pivot header. One product name per screen, cropped by the right edge, the next one in Dim Grey.
- **Headline** (300, clamp 40 to 64px, 0.98): the title on the wide best tile; product tiles use 40px.
- **Title** (300, clamp 30 to 42px, 1.05): the open post's title.
- **Section** (300, 30px, 1): section headings in Live Cyan with a 1.5px cyan rule under them.
- **Body large** (300, 21px, 1.4): editable knowledge text, setup steps (22px).
- **Body** (300, 15px, 1.5): everything else; 400 for emphasis (`b`), 600 only for the selected product in the rail.
- **Button** (300, 20px; 16px small).
- **Label** (400, 12px, 0.05em tracking, uppercase): status pills only (draft, approved, format).

### Named Rules
**The Lowercase Voice Rule.** Names, headings, nav and buttons are lowercase. Uppercase is reserved for small status pills.

**The Crop Rule.** The pivot header is meant to run off the right edge. Do not shrink it to fit.

## Layout

A 248px left rail beside a fluid main column. The main column opens with the pivot header, a one-line status row (ready count, sort, date, a link to dropped posts), then the work. On Today the tiles (up to 600px wide) sit beside the open post with a 36px gutter; below 1180px the open post drops under the tiles.

Tiles sit on a 3-column grid with a 10px gutter: the best post spans all three columns at 1.75:1, the others are square. Product tiles auto-fill at a 260px minimum, 1.3:1. Sections stack 40px apart. Reading text stops at 62ch.

Below 820px the rail becomes a sticky top bar holding the wordmark and the four 42px nav squares (labels hidden); the product list and last post hide; the pivot drops to 68px; two-column screens stack; the posted table turns into stacked rows.

## Elevation & Depth

The chrome is flat. Depth comes from the black ground against full-strength fills, from size, and from the 3D flip of the tiles, not from shadows. The one shadow in the system sits under the product screenshot crop that pokes out of the wide tile's corner, so the crop reads as a card laid on the colour.

### Shadow Vocabulary
- **Crop lift** (`box-shadow: -8px -8px 24px rgba(0,0,0,.22)`): only on a screenshot crop inside a tile.

### Named Rules
**The Flat Chrome Rule.** No shadows on buttons, tiles, inputs, panels or the rail. If something needs to stand out, give it a fill or make it bigger.

## Shapes

Every app shape is a square-cornered rectangle (0px radius): tiles, buttons, nav squares, inputs, pills, the toast, swatches, the product dot. Outlines are 1.5px (2px on inputs and the selected-tile frame) and appear only on black, never around a coloured fill. The dot-matrix texture (a small grid of dots) appears in two places: the wordmark's mark and the top-right patch of the wide tile.

## Components

### Buttons
Big, flat, square blocks with the label left and a small play arrow right.
- **Shape:** square (0px), 52px tall, 18px side padding, 28px between label and arrow.
- **Primary:** Live Cyan fill, black label. One per view: the copy action.
- **Ghost:** black with a 1.5px white outline and white label; on hover the outline and label turn cyan.
- **Done:** Lime fill, shown after a post is marked posted.
- **Small:** 40px tall, 16px label, for approve, ask and similar.

### Nav squares
- **Style:** a 52px square with a 1.5px Quiet Outline and a 22px line icon (1.6 stroke, square caps), label to the right in Soft Grey.
- **Hover:** outline and label go white.
- **Current:** square fills Live Cyan with a black icon; label turns cyan.

### Live tiles (signature)
- **Fill:** one flat colour per post or product, black type, 18 to 20px padding (14px on small tiles).
- **Front:** the post title, with a format note at the bottom; the wide tile adds the dot patch and a screenshot crop at its lower right.
- **Back:** the post's first line. Tiles flip on the X axis every 9 seconds, staggered; they tilt and shrink slightly when pressed.
- **Selected:** a 2px white frame 6px outside the tile.
- **Posted:** the face is desaturated and darkened, with a black "posted" tag.
- **Add product:** a tile with no fill and a 1.5px white outline; cyan on hover.

### Inputs / Fields
- **Style:** black ground, 2px Soft Grey outline, square, 26px light text (17px in the add-rule row), Dim Grey placeholder.
- **Focus:** the outline turns cyan.
- **Editable text:** no frame at rest, Raise wash on hover, a 2px inset cyan line when editing.

### Pills
- **Style:** 12px uppercase label, black text on a flat fill: orange for draft, lime for approved, Rule Grey with white text for format.

### Pivot header (signature)
The current product name in white at display size, the other products after it in Dim Grey, all on one line that runs off the right edge. Picking another product slides the line sideways (0.5s, a fast-out ease).

### Toast
A cyan block with black 16px text, fixed at the bottom centre.

### Motion
Tiles and the open post slide in 28px from the right, 60ms apart. All movement (flip, slide, pulse, pivot) runs only when the user has not asked for reduced motion.

## Do's and Don'ts

### Do:
- **Do** keep the ground pure black (#000000) and every fill flat at full strength, with black type on it.
- **Do** use cyan for every "current", "focused" and "do this next" state, and keep one cyan block button per view.
- **Do** set names, headings, nav and buttons in light lowercase Noto Sans Display.
- **Do** let the pivot header crop at the right edge, with the next product showing.
- **Do** keep every app shape square (0px radius).
- **Do** render post visuals in the customer product's own brand, inside feed frames that copy the platform.

### Don't:
- **Don't** add gradients, bevels or tints to a fill, or outline a coloured field.
- **Don't** put shadows on chrome; the only shadow is the screenshot crop inside a tile.
- **Don't** round corners in the app chrome.
- **Don't** use Dim Grey or Quiet Outline for small text.
- **Don't** take the Passalong post look (brown ground, Inter, Instrument Serif italic, orange accent) as Post maker's style.
