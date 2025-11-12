import React from "react";

import type { HyperparameterConfig, HyperparameterFormProps, HyperparameterValues } from "./types";

type PlaceholderConfig = HyperparameterConfig<HyperparameterValues>;

export function createPlaceholderHyperparameterConfig(id: string, label: string): PlaceholderConfig {
  const PlaceholderForm: React.FC<HyperparameterFormProps> = ({ disabled }) => (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
      <p className="font-semibold text-slate-700">{label} hyperparameters</p>
      <p className="mt-1">
        No inputs are defined yet. Edit <code>src/app/create/hyperparameters/{id}-form.tsx</code> to add fields specific to this algorithm.
      </p>
      {disabled && <p className="mt-2 text-xs text-slate-500">(This form is currently read-only.)</p>}
    </div>
  );

  return {
    id,
    label,
    Form: PlaceholderForm,
    defaultValues: {},
  };
}
