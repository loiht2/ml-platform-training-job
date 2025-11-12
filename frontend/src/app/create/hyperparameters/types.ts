import type { ComponentType } from "react";

export type HyperparameterValues = Record<string, unknown>;

export type HyperparameterFormProps<T extends HyperparameterValues = HyperparameterValues> = {
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export type HyperparameterConfig<T extends HyperparameterValues = HyperparameterValues> = {
  id: string;
  label: string;
  Form: ComponentType<HyperparameterFormProps<T>>;
  defaultValues: T;
};
