# Training Job UI

A feature-rich React SPA for configuring machine-learning training jobs. The UI lets you define algorithms, allocate compute resources, configure input channels, and review the payload JSON before submitting it to your backend.

## Getting Started

```bash
npm install
npm run dev
```

Then open <http://localhost:3000> to interact with the form.

## Core Features

- **Algorithm setup** – choose built-in or custom container images and toggle training metrics.
- **Resource configuration** – specify CPU, memory, GPU, instance counts, storage, and distributed settings.
- **Input data configuration** – manage multiple channels pointing to object stores or file uploads, with a guided side-panel editor.
- **Stopping conditions & output** – set runtime limits and output artifact locations.
- **Payload download** – export the sanitised job payload JSON for API calls.
- **Local persistence** – job payloads are saved to `localStorage`, so you can refresh without losing recent submissions.

## Tech Stack

- React 19 + React Router 6
- Vite 4 (TypeScript)
- Tailwind CSS 4 + shadcn/ui components
- lucide-react icons

## Folder Structure

```
src/
  App.tsx                 # Route configuration
  main.tsx                # Application entry point
  pages/
    CreateTrainingJobPage.tsx
    TrainingJobsListPage.tsx
  app/globals.css         # Global styles (tailwind.css)
  app/create/hyperparameters/ # Hyperparameter form components
  components/ui/          # shadcn/ui primitives
  lib/                    # Local utilities (storage, helpers)
  types/                  # Shared TypeScript types
components.json           # shadcn component registry
```

## Scripts

- `npm run dev` – start the Vite development server
- `npm run build` – type-check and create an optimized production build
- `npm run build:prod` – build with explicit production environment
- `npm run preview` – preview the built app locally
- `npm run lint` – lint the codebase with ESLint
- `npm run lint:fix` – automatically fix linting issues
- `npm run type-check` – run TypeScript type checking without emitting files

## Performance Optimizations

This project includes several performance optimizations:

- **Code splitting** with React.lazy for route-based loading
- **Optimized Vite build** with manual chunk splitting for better caching
- **Memoized components** to prevent unnecessary re-renders
- **Docker multi-stage builds** for smaller production images
- **TypeScript optimizations** for faster type checking

See [OPTIMIZATION.md](./OPTIMIZATION.md) for detailed information about all optimizations and recommendations.

## Preview

![Training Job UI screenshot](./public/preview.png "Training Job UI preview")

## Contributing

1. Fork the repo and create a feature branch.
2. Make your changes and add tests or documentation as needed.
3. Submit a pull request with a clear summary of your work.
