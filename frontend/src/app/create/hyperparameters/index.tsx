import type { HyperparameterConfig, HyperparameterValues } from "./types";
import { XGBOOST_HYPERPARAMETER_CONFIG } from "./xgboost-form";
import { LIGHTGBM_HYPERPARAMETER_CONFIG } from "./lightgbm-form";
import { TENSORFLOW_CNN_HYPERPARAMETER_CONFIG } from "./tensorflow-cnn-form";
import { TENSORFLOW_TRANSFORMER_HYPERPARAMETER_CONFIG } from "./tensorflow-transformer-form";
import { TF_DISTRIBUTED_HYPERPARAMETER_CONFIG } from "./tf-distributed-form";
import { HOROVOD_MPI_HYPERPARAMETER_CONFIG } from "./horovod-mpi-form";
import { DEEPSPEED_ZERO3_HYPERPARAMETER_CONFIG } from "./deepspeed-zero3-form";
import { JAX_PJIT_HYPERPARAMETER_CONFIG } from "./jax-pjit-form";
import { TORCH_MPI_HYPERPARAMETER_CONFIG } from "./torch-mpi-form";

const hyperparameterRegistry: Record<string, HyperparameterConfig> = {
  [XGBOOST_HYPERPARAMETER_CONFIG.id]: XGBOOST_HYPERPARAMETER_CONFIG as unknown as HyperparameterConfig,
  [LIGHTGBM_HYPERPARAMETER_CONFIG.id]: LIGHTGBM_HYPERPARAMETER_CONFIG,
  [TENSORFLOW_CNN_HYPERPARAMETER_CONFIG.id]: TENSORFLOW_CNN_HYPERPARAMETER_CONFIG,
  [TENSORFLOW_TRANSFORMER_HYPERPARAMETER_CONFIG.id]: TENSORFLOW_TRANSFORMER_HYPERPARAMETER_CONFIG,
  [TF_DISTRIBUTED_HYPERPARAMETER_CONFIG.id]: TF_DISTRIBUTED_HYPERPARAMETER_CONFIG,
  [HOROVOD_MPI_HYPERPARAMETER_CONFIG.id]: HOROVOD_MPI_HYPERPARAMETER_CONFIG,
  [DEEPSPEED_ZERO3_HYPERPARAMETER_CONFIG.id]: DEEPSPEED_ZERO3_HYPERPARAMETER_CONFIG,
  [JAX_PJIT_HYPERPARAMETER_CONFIG.id]: JAX_PJIT_HYPERPARAMETER_CONFIG,
  [TORCH_MPI_HYPERPARAMETER_CONFIG.id]: TORCH_MPI_HYPERPARAMETER_CONFIG,
};

function cloneValues<T extends HyperparameterValues>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

export function getHyperparameterConfig(id: string): HyperparameterConfig | undefined {
  return hyperparameterRegistry[id];
}

export function getDefaultHyperparameters(id: string): HyperparameterValues {
  const config = getHyperparameterConfig(id);
  return config ? cloneValues(config.defaultValues) : {};
}

export type { HyperparameterValues, HyperparameterFormProps } from "./types";
