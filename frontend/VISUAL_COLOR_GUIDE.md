# Visual Color Scheme Guide

## Quick Color Reference

### 🎨 Color Themes by Section

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER                                                          │
│  Background: slate-50 → white → blue-50                         │
│  Status Ready: emerald-50 → teal-50 (with animation)           │
│  Status Issues: amber-50 → orange-50 (with animation)          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [STEP 1] BLUE                                                   │
│  Basic Information                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Card: white → blue-50/30                                  │  │
│  │ Border: blue-100                                          │  │
│  │ Shadow: md → lg on hover                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [STEP 2] PURPLE                                                 │
│  Algorithm Selection                                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Card: white → purple-50/30                                │  │
│  │ Border: purple-100                                        │  │
│  │ Radio hover: purple-50/50                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Custom Hyperparameters (if container selected)                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Card: blue-50 → white → indigo-50                         │  │
│  │ Border: blue-200                                          │  │
│  │ Parameters: slate-50 → hover border slate-300             │  │
│  │ Add Button: blue-600 → indigo-600 gradient               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [STEP 3] EMERALD                                                │
│  Compute Resources                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Card: white → emerald-50/30                               │  │
│  │ Border: emerald-100                                       │  │
│  │ Theme: Fresh green for computational power                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [STEP 4] INDIGO                                                 │
│  Data & Storage                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Main Card: white → indigo-50/30                           │  │
│  │ Border: indigo-100                                        │  │
│  │                                                           │  │
│  │ Channel Cards:                                            │  │
│  │ ┌─────────────────────────────────────────────────────┐  │  │
│  │ │ Background: slate-50 → indigo-50/40                 │  │  │
│  │ │ Border: indigo-200/50 → indigo-300 on hover         │  │  │
│  │ └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │ Empty State:                                              │  │
│  │ ┌ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┐  │  │
│  │ │  slate-50 → indigo-50 (dashed border)             │  │  │
│  │ └ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┘  │  │
│  │                                                           │  │
│  │ [+ Add channel] indigo-600 → violet-600 gradient         │  │
│  │ [Quick add validation] outlined with indigo theme        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Stopping Condition (PINK)                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Card: white → pink-50/30                                  │  │
│  │ Border: pink-100                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Output Configuration (ROSE)                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Card: white → rose-50/30                                  │  │
│  │ Border: rose-100                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SUBMIT BAR (Sticky Bottom)                                      │
│  Background: white → slate-50 → white                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Error Icon: amber-100 → orange-100 gradient              │  │
│  │ Success Icon: emerald-100 → teal-100 gradient            │  │
│  │ [Review & Submit] blue-600 → indigo-600 gradient         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Color Palette Details

### Primary Gradients

**Blue Theme (Step 1, Headers, Actions)**
- Light: `from-white to-blue-50/30`
- Medium: `from-blue-50 to-blue-100`
- Dark: `from-blue-600 to-indigo-600`
- Border: `border-blue-100` to `border-blue-200`

**Purple Theme (Step 2)**
- Light: `from-white to-purple-50/30`
- Medium: `from-purple-50 to-purple-100`
- Dark: `from-purple-600 to-violet-600`
- Border: `border-purple-100`

**Emerald Theme (Step 3)**
- Light: `from-white to-emerald-50/30`
- Medium: `from-emerald-50 to-teal-50`
- Dark: `from-emerald-600 to-teal-600`
- Border: `border-emerald-100`

**Indigo Theme (Step 4)**
- Light: `from-white to-indigo-50/30`
- Medium: `from-slate-50 to-indigo-50/40`
- Dark: `from-indigo-600 to-violet-600`
- Border: `border-indigo-100` to `border-indigo-200`

**Pink/Rose Theme (Output)**
- Light: `from-white to-pink-50/30` and `from-white to-rose-50/30`
- Medium: `from-pink-50 to-rose-50`
- Border: `border-pink-100` and `border-rose-100`

### Status Colors

**Success**
```
Background: from-emerald-50 to-teal-50
Border: border-emerald-200
Text: text-emerald-700
Icon: bg-gradient-to-br from-emerald-100 to-teal-100
```

**Warning**
```
Background: from-amber-50 to-orange-50
Border: border-amber-200
Text: text-amber-700
Icon: bg-gradient-to-br from-amber-100 to-orange-100
```

**Error**
```
Background: from-red-50 to-rose-50
Border: border-red-200
Text: text-red-700
Icon: bg-gradient-to-br from-red-100 to-rose-100
```

## Interactive States

### Buttons

**Primary Action**
```tsx
// Default
bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md

// Hover
hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg

// Transition
transition-all
```

**Secondary Action (Indigo)**
```tsx
// Default
bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-sm

// Hover
hover:from-indigo-700 hover:to-violet-700 hover:shadow-md

// Transition
transition-all
```

**Outlined Button**
```tsx
// Default
border-indigo-300 text-indigo-700

// Hover
hover:bg-indigo-50 hover:border-indigo-400

// Transition
transition-colors
```

### Cards

**Default State**
```tsx
shadow-md border-[color]-100 bg-gradient-to-br from-white to-[color]-50/30
```

**Hover State**
```tsx
hover:shadow-lg transition-shadow
```

### Channel Cards

**Default**
```tsx
border-indigo-200/50 bg-gradient-to-br from-slate-50 to-indigo-50/40
```

**Hover**
```tsx
hover:border-indigo-300 transition-colors
```

## Typography Colors

```
Headers (h1, h2):  text-slate-900
Subheadings (h3):  text-slate-900
Body text:         text-slate-600
Muted text:        text-slate-500
Labels:            text-base font-semibold (inherits slate-900)
```

## Badge Colors

```
Step 1: text-blue-700 bg-blue-50
Step 2: text-purple-700 bg-purple-50
Step 3: text-emerald-700 bg-emerald-50
Step 4: text-indigo-700 bg-indigo-50
```

## Shadow Scale

```
sm:  Small elements (icons, small buttons)
md:  Default cards
lg:  Hover state cards, sticky elements
xl:  Active/focused elements (optional)
```

## Border Styles

**Solid Borders**
- Cards: `border-[color]-100` to `border-[color]-200`
- Inputs: `border-slate-300`
- Hover: Darker shade of theme color

**Dashed Borders**
- Empty states: `border-dashed border-[color]-200`

## Opacity Levels

```
/10:  Very subtle (10%)
/20:  Light (20%)
/30:  Card backgrounds (30%) ← Most common
/40:  Channel cards (40%)
/50:  Hover states (50%)
/75:  Semi-transparent overlays (75%)
/95:  Nearly opaque (95%)
```

## Animation Classes

```
animate-ping:       Pulsing status indicators
animate-pulse:      Issue count badge
transition-all:     Buttons, comprehensive transitions
transition-shadow:  Cards shadow changes
transition-colors:  Border and background colors
transition-transform: Back button hover
```

## Timing Functions

All transitions use default easing (ease) with duration:
- Colors: ~200ms
- Shadows: ~300ms
- Transforms: ~200ms

## Usage Examples

### Creating a New Section Card
```tsx
<Card className="shadow-md border-[your-color]-100 bg-gradient-to-br from-white to-[your-color]-50/30 hover:shadow-lg transition-shadow">
  <CardContent className="pt-6">
    {/* Your content */}
  </CardContent>
</Card>
```

### Creating an Action Button
```tsx
<Button className="bg-gradient-to-r from-[color1]-600 to-[color2]-600 hover:from-[color1]-700 hover:to-[color2]-700 text-white font-semibold shadow-sm hover:shadow-md transition-all">
  <Icon className="mr-2 h-4 w-4" />
  Action Text
</Button>
```

### Creating a Status Badge
```tsx
<div className="inline-block px-3 py-1 text-xs font-semibold text-[color]-700 bg-[color]-50 rounded-full">
  STEP X
</div>
```

### Creating a Channel/Item Card
```tsx
<div className="rounded-lg border border-[color]-200/50 bg-gradient-to-br from-slate-50 to-[color]-50/40 hover:border-[color]-300 transition-colors p-5">
  {/* Item content */}
</div>
```

## Accessibility Notes

### Contrast Ratios (WCAG AA Compliant)

✅ `text-slate-900` on white/light backgrounds: >7:1
✅ `text-slate-600` on white/light backgrounds: >4.5:1
✅ `text-[color]-700` on `bg-[color]-50`: >4.5:1
✅ White text on `bg-[color]-600`: >4.5:1

### Focus States
All interactive elements inherit browser focus styles or have custom `focus-visible:` states.

### Motion Preferences
Consider adding `prefers-reduced-motion` media queries for users with motion sensitivity:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Browser Support

All gradients and effects are supported in:
- ✅ Chrome/Edge 26+
- ✅ Firefox 16+
- ✅ Safari 7+
- ✅ Opera 12.1+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Tips

1. **Use GPU-accelerated properties**: `transform`, `opacity`
2. **Avoid animating**: `width`, `height`, `padding`, `margin`
3. **Keep transitions short**: 150-300ms is ideal
4. **Limit simultaneous animations**: Fewer than 5 at once
5. **Use `will-change` sparingly**: Only for critical animations

---

**Quick Start**: All color utilities are from Tailwind CSS 4
**Customization**: Modify theme colors in `tailwind.config.js`
**Testing**: View at http://localhost:3002/
