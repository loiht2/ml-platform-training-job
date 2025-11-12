# UI Design Specifications

## Color Palette

### Primary Colors
- **Blue**: `blue-50` to `blue-900` - Primary actions, Step 1
- **Purple**: `purple-50` to `purple-700` - Step 2 (Algorithm)
- **Emerald**: `emerald-50` to `emerald-900` - Success states, Step 3
- **Indigo**: `indigo-50` to `indigo-700` - Step 4 (Data)
- **Amber**: `amber-50` to `amber-900` - Warnings, Pending states
- **Red**: `red-50` to `red-700` - Errors, Failed states

### Neutral Colors
- **Slate**: `slate-50` to `slate-900` - Base UI, text, borders
- **White**: `#ffffff` - Card backgrounds, main background

## Typography Scale

### Headings
- **Page Title**: `text-4xl font-bold` (2.25rem / 36px)
- **Section Title**: `text-2xl font-bold` (1.5rem / 24px)  
- **Subsection**: `text-lg font-semibold` (1.125rem / 18px)
- **Card Title**: `text-base font-semibold` (1rem / 16px)

### Body Text
- **Primary**: `text-base` (1rem / 16px)
- **Secondary**: `text-sm text-slate-600` (0.875rem / 14px)
- **Small**: `text-xs text-slate-500` (0.75rem / 12px)

### Font Weights
- **Bold**: `font-bold` (700)
- **Semibold**: `font-semibold` (600)
- **Medium**: `font-medium` (500)
- **Normal**: `font-normal` (400)

## Spacing System

### Padding
- **Extra Large**: `p-6` (1.5rem / 24px) - Card content
- **Large**: `p-5` (1.25rem / 20px) - Channel cards
- **Medium**: `p-4` (1rem / 16px) - Nested sections
- **Small**: `p-3` (0.75rem / 12px) - Badges

### Margins
- **Section Spacing**: `mb-12` (3rem / 48px) - Between major sections
- **Card Spacing**: `mb-6` (1.5rem / 24px) - Between cards
- **Element Spacing**: `mb-2` to `mb-4` (0.5-1rem) - Between elements

### Gaps
- **Large**: `gap-6` (1.5rem / 24px) - Form grids
- **Medium**: `gap-4` (1rem / 16px) - Flex containers
- **Small**: `gap-3` (0.75rem / 12px) - Button groups

## Component Specifications

### Cards
```
Base Card:
- Background: white
- Border: 1px solid slate-200
- Border Radius: 0.5rem (8px)
- Shadow: shadow-sm
- Hover: hover:shadow-md transition-shadow
```

### Badges
```
Step Badges:
- Padding: px-3 py-1
- Font: text-xs font-semibold
- Border Radius: rounded-full
- Colors: {color}-700 text on {color}-50 background

Status Badges:
- Use native Badge component
- Include symbol prefix (✓, ●, ○, ✕)
- Variants: secondary, default, outline, destructive
```

### Buttons
```
Primary (CTA):
- Background: gradient from blue-600 to indigo-600
- Text: white, font-semibold
- Padding: px-8 (for large)
- Hover: darker gradient (blue-700 to indigo-700)

Secondary:
- Border: 1px solid slate-300
- Background: white
- Text: slate-700
- Hover: bg-slate-50
```

### Input Fields
```
Text Input:
- Border: 1px solid slate-300
- Border Radius: 0.375rem (6px)
- Padding: px-3 py-2
- Font: text-base
- Focus: ring-2 ring-blue-500

Label:
- Font: text-base font-semibold
- Color: slate-900
- Margin: mb-2
```

## Layout Structure

### Page Container
```tsx
<div className="min-h-screen bg-white">
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto max-w-{6xl|7xl} px-6 py-8">
      {/* Header Content */}
    </div>
  </header>
  
  <main className="mx-auto max-w-{6xl|7xl} px-6 py-{10|12}">
    {/* Main Content */}
  </main>
</div>
```

### Create Page Sections
```tsx
<section>
  <div className="mb-6">
    <div className="inline-block px-3 py-1 text-xs font-semibold {color}-700 bg-{color}-50 rounded-full mb-3">
      STEP {n}
    </div>
    <h2 className="text-2xl font-bold text-slate-900">{Title}</h2>
    <p className="mt-1 text-slate-600">{Description}</p>
  </div>
  
  <Card className="shadow-sm">
    <CardContent className="pt-6 space-y-6">
      {/* Form Fields */}
    </CardContent>
  </Card>
</section>
```

### List Page Cards
```tsx
<Card className="shadow-sm hover:shadow-md transition-shadow">
  <CardContent className="p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex-1 min-w-0">
        {/* Job Info */}
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        {/* Meta Info */}
      </div>
    </div>
  </CardContent>
</Card>
```

## Responsive Breakpoints

### Mobile First Approach
- **Base**: 0px - 639px (mobile)
- **md**: 640px+ (tablet)
- **lg**: 1024px+ (desktop)
- **xl**: 1280px+ (large desktop)

### Grid Adjustments
```
Stats: grid-cols-2 md:grid-cols-4
Form: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
Header: flex-col md:flex-row
```

## Accessibility

### Color Contrast
- All text meets WCAG AA standards
- Status colors have sufficient contrast ratios
- Focus states clearly visible

### Interactive Elements
- Minimum touch target: 44x44px
- Clear hover states
- Focus indicators on all interactive elements
- Screen reader support via sr-only labels

### Semantic HTML
- Proper heading hierarchy (h1 → h2 → h3)
- Form labels associated with inputs
- Descriptive button text
- ARIA labels where needed

## Animation & Transitions

### Hover Effects
- Shadow transitions: `transition-shadow`
- Duration: 150ms (Tailwind default)
- Ease: ease-in-out

### Interactive States
- Buttons: Slightly darker background on hover
- Cards: Subtle shadow increase on hover
- Links: Color change on hover

## Icon Usage (Functional Only)

### Retained Icons
- **ChevronUp/Down**: Reordering items
- **Copy**: Duplicate/copy actions
- **Plus**: Add new items
- **Trash2**: Delete actions
- **FileJson2**: JSON/data related actions

### Removed Decorative Icons
- ~~Settings2~~ - Replaced with text headings
- ~~Cpu~~ - Removed, section clear from context
- ~~Database~~ - Removed, section clear from context
- ~~Clock~~ - Removed, "Stopping Condition" is clear
- ~~Folder~~ - Removed, "Output" is clear
- ~~Sparkles, AlertCircle, CheckCircle2~~ - Replaced with text/colored dots

## Empty States

### Design Pattern
```tsx
<Card className="border-2 border-dashed border-slate-300">
  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
      <span className="text-3xl text-slate-400">+</span>
    </div>
    <h3 className="text-xl font-semibold text-slate-900 mb-2">{Title}</h3>
    <p className="text-slate-600 mb-6 max-w-md">{Description}</p>
    <Button>{Action}</Button>
  </CardContent>
</Card>
```

## Status Indicators

### Visual Symbols
- **Success/Succeeded**: ✓ (checkmark)
- **Running/Active**: ● (filled circle)
- **Pending/Waiting**: ○ (empty circle)
- **Failed/Error**: ✕ (x mark)

### Color Coding
- **Success**: emerald-500/emerald-700
- **Running**: blue-500/blue-700
- **Pending**: amber-500/amber-700
- **Failed**: red-500/red-700

## Form Validation

### Error States
- Red border on invalid fields
- Error message in red-600
- Clear, actionable error text

### Success States
- No visual indicator during input
- Green status indicator when form valid
- Summary of configuration when ready
