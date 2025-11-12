# Visual Guide: Custom Hyperparameters Feature

## Overview
This document provides a visual description of the new custom hyperparameters editor and enhanced UI design.

## 1. Header Section (Enhanced)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Jobs                                                  │
│                                                                   │
│  Create Training Job                                            │
│  (gradient text: slate-900 → blue-900 → indigo-900)             │
│  Configure and submit a new machine learning training job with  │
│  customizable hyperparameters                                    │
│                                                      ╭──────────╮│
│                                                      │ ●  Ready ││
│                                                      │to Submit ││
│                                                      ╰──────────╯│
└─────────────────────────────────────────────────────────────────┘
```

**Design Features:**
- Background: Gradient from slate-50 → white → blue-50
- Backdrop blur effect on header
- Animated pulsing dot when ready
- Hover effect on "Back to Jobs" with left translation

## 2. Basic Information Section

```
┌─────────────────────────────────────────────────────────────────┐
│  [STEP 1]  Blue badge                                           │
│  Basic Information                                              │
│  Set the job name and execution priority                        │
│                                                                  │
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  Job Name                              Priority           ║  │
│  ║  ┌─────────────────────┐               ┌──────┐          ║  │
│  ║  │ train-20251108...   │ [Generate]    │ 500  │          ║  │
│  ║  └─────────────────────┘               └──────┘          ║  │
│  ║                                         Range: 1-1000      ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

**Design Features:**
- Gradient: white → blue-50/30
- Border: border-blue-100
- Shadow with hover enhancement
- Responsive 2-column layout on desktop

## 3. Algorithm Selection Section

```
┌─────────────────────────────────────────────────────────────────┐
│  [STEP 2]  Purple badge                                         │
│  Algorithm Selection                                             │
│  Choose your machine learning algorithm                          │
│                                                                  │
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  Source                                                    ║  │
│  ║                                                            ║  │
│  ║  ┌──────────────────────┐  ┌──────────────────────┐      ║  │
│  ║  │ ⦿ Built-in algorithm │  │ ○ Custom container   │      ║  │
│  ║  └──────────────────────┘  └──────────────────────┘      ║  │
│  ║                                                            ║  │
│  ║  [If Built-in selected:]                                  ║  │
│  ║  Built-in algorithm                                       ║  │
│  ║  ▼ XGBoost                                                ║  │
│  ║                                                            ║  │
│  ║  [If Container selected:]                                 ║  │
│  ║  Container image URI                                      ║  │
│  ║  registry.example.com/ml/training:latest                  ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

**Design Features:**
- Gradient: white → purple-50/30
- Border: border-purple-100
- Enhanced radio buttons with hover states
- Smooth transition between options

## 4A. Built-in Hyperparameters (Existing)

```
┌─────────────────────────────────────────────────────────────────┐
│  Hyperparameters                    [Reset to defaults]          │
│  Fine-tune settings for XGBoost                                  │
│                                                                  │
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  Training strategy                                         ║  │
│  ║  Control overall training length, logging...                ║  │
│  ║                                                             ║  │
│  ║  Boosting rounds (num_round)    Early stopping rounds      ║  │
│  ║  ┌──────┐                        ┌──────┐                  ║  │
│  ║  │ 300  │                        │      │                  ║  │
│  ║  └──────┘                        └──────┘                  ║  │
│  ║  ...                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

## 4B. Custom Hyperparameters (NEW!)

```
┌─────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  Custom Hyperparameters          [Reset to defaults]      ║  │
│  ║  Define key-value pairs for your custom container          ║  │
│  ║  ─────────────────────────────────────────────────────────║  │
│  ║                                                             ║  │
│  ║  Current Parameters                                         ║  │
│  ║                                                             ║  │
│  ║  ┌─────────────────────────────────────────────────────┐  ║  │
│  ║  │ Key                Value                            🗑  │  ║  │
│  ║  │ learning_rate      0.001          (number)             │  ║  │
│  ║  └─────────────────────────────────────────────────────┘  ║  │
│  ║                                                             ║  │
│  ║  ┌─────────────────────────────────────────────────────┐  ║  │
│  ║  │ Key                Value                            🗑  │  ║  │
│  ║  │ batch_size         32             (number)             │  ║  │
│  ║  └─────────────────────────────────────────────────────┘  ║  │
│  ║                                                             ║  │
│  ║  ┌─────────────────────────────────────────────────────┐  ║  │
│  ║  │ Key                Value                            🗑  │  ║  │
│  ║  │ use_amp            true           (boolean)            │  ║  │
│  ║  └─────────────────────────────────────────────────────┘  ║  │
│  ║                                                             ║  │
│  ║  Add New Parameter                                          ║  │
│  ║  ┌────────────────────┐  ┌────────────────┐  ┌───────────┐║  │
│  ║  │ Parameter key...   │  │ Value (0.001)  │  │ + Add     │║  │
│  ║  └────────────────────┘  └────────────────┘  │Parameter  │║  │
│  ║                                               └───────────┘║  │
│  ║  Values are automatically typed: numbers, booleans, or    ║  │
│  ║  strings                                                   ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

**Design Features:**
- Gradient card: blue-50 → white → indigo-50
- Border: border-blue-200
- Each parameter row has:
  - Light gray background (slate-50)
  - Hover state (border changes to slate-300)
  - Type indicator (number/boolean/string)
  - Delete button in red theme
- Add button: Gradient blue-600 → indigo-600
- Font: Mono for keys and values
- Empty state when no parameters defined

### Empty State

```
┌─────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  Custom Hyperparameters                                    ║  │
│  ║  Define key-value pairs for your custom container          ║  │
│  ║  ─────────────────────────────────────────────────────────║  │
│  ║                                                             ║  │
│  ║  ┌ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┐  ║  │
│  ║  │                                                         │  ║  │
│  ║  │           No parameters defined yet                     │  ║  │
│  ║  │           Add your first parameter below                │  ║  │
│  ║  │                                                         │  ║  │
│  ║  └ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┘  ║  │
│  ║                                                             ║  │
│  ║  Add New Parameter                                          ║  │
│  ║  ┌────────────────────┐  ┌────────────────┐  ┌───────────┐║  │
│  ║  │ Parameter key...   │  │ Value (0.001)  │  │ + Add     │║  │
│  ║  └────────────────────┘  └────────────────┘  │Parameter  │║  │
│  ║                                               └───────────┘║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

## Color Scheme

### Primary Colors
- **Blue/Indigo**: Main theme, professional and modern
  - Blue-50: Light backgrounds
  - Blue-100/200: Borders
  - Blue-600/700: Primary buttons
  - Indigo-600/700: Accent buttons

### Section Accent Colors
- **STEP 1 (Basic Info)**: Blue theme
- **STEP 2 (Algorithm)**: Purple theme
- **STEP 3 (Resources)**: Emerald theme
- **STEP 4 (Data)**: Orange theme
- **STEP 5 (Output)**: Pink theme

### Status Colors
- **Success/Ready**: Emerald-50, emerald-700
- **Warning/Issues**: Amber-50, amber-700
- **Danger/Delete**: Red-50, red-600

## Interactive Elements

### Hover States
1. **Cards**: 
   - Default: `shadow-md`
   - Hover: `shadow-lg` + slight scale
   
2. **Radio Buttons**:
   - Default: `border-slate-200`
   - Hover: `border-purple-300 bg-purple-50/50`
   
3. **Delete Buttons**:
   - Default: `text-red-600`
   - Hover: `text-red-700 bg-red-50`

4. **Add Parameter Button**:
   - Gradient: `from-blue-600 to-indigo-600`
   - Hover: `from-blue-700 to-indigo-700`

### Animations
1. **Ready Status**: Pulsing dot with ping animation
2. **Issue Status**: Pulsing dot only
3. **Back Button**: Left translation on hover (-4px)
4. **Cards**: Shadow transition (300ms)
5. **All Borders**: Color transition (200ms)

## Type Inference Examples

| Input Value | Inferred Type | Result |
|-------------|---------------|--------|
| `0.001` | number | `0.001` |
| `100` | number | `100` |
| `-3.14` | number | `-3.14` |
| `true` | boolean | `true` |
| `false` | boolean | `false` |
| `True` | boolean | `true` |
| `FALSE` | boolean | `false` |
| `hello` | string | `"hello"` |
| `3e8` | number | `300000000` |
| `adam` | string | `"adam"` |

## Responsive Behavior

### Desktop (≥1024px)
- 2-column layout for Basic Info
- 3-column layout for Resources
- Full-width hyperparameters section
- Side-by-side parameter key/value

### Tablet (768px-1023px)
- 2-column layout maintained
- Narrower side panels
- Parameter rows stack at smaller sizes

### Mobile (<768px)
- Single column stack
- Full-width inputs
- Vertical parameter layout
- Larger touch targets

## Keyboard Shortcuts

- **Enter** in parameter inputs: Add parameter
- **Tab**: Navigate between fields
- **Escape**: (Future: Cancel edit mode)

## Accessibility Features

- Semantic HTML structure
- ARIA labels on all inputs
- Proper contrast ratios (WCAG AA)
- Focus visible states
- Keyboard navigation support
- Screen reader friendly labels

## Usage Flow

### Adding a Custom Hyperparameter

1. Select "Custom container" radio button
2. Enter container image URI
3. Scroll to Custom Hyperparameters section
4. Enter parameter key (e.g., `learning_rate`)
5. Enter value (e.g., `0.001`)
6. Click "Add Parameter" or press Enter
7. Parameter appears in list with type indicator
8. Repeat for additional parameters

### Editing a Parameter

1. Locate parameter in list
2. Click in the Value field
3. Modify the value
4. Type is automatically re-inferred
5. Changes saved immediately

### Removing a Parameter

1. Locate parameter in list
2. Click the trash icon (🗑) on the right
3. Parameter is removed with smooth transition

### Resetting All Parameters

1. Click "Reset to defaults" button in header
2. All parameters cleared immediately
3. Empty state displayed

## Performance Notes

- No re-renders on input typing (local state)
- Batch updates on parameter add/remove
- CSS transitions offloaded to GPU
- Minimal JavaScript execution
- No external dependencies for core functionality

This visual guide should help you understand the new custom hyperparameters feature and the enhanced UI design!
