import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

export type CustomHyperparameters = Record<string, string | number | boolean>;

interface CustomHyperparametersEditorProps {
  value: CustomHyperparameters;
  onChange: (value: CustomHyperparameters) => void;
}

export function CustomHyperparametersEditor({ value, onChange }: CustomHyperparametersEditorProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const entries = Object.entries(value || {});
  const hasParams = entries.length > 0;

  function addParameter() {
    const trimmedKey = newKey.trim();
    if (!trimmedKey) return;
    
    // Try to infer type from value
    let parsedValue: string | number | boolean = newValue;
    
    // Check if it's a boolean
    if (newValue.toLowerCase() === "true") {
      parsedValue = true;
    } else if (newValue.toLowerCase() === "false") {
      parsedValue = false;
    } else {
      // Check if it's a number
      const numValue = Number(newValue);
      if (!isNaN(numValue) && newValue.trim() !== "") {
        parsedValue = numValue;
      }
    }
    
    onChange({
      ...value,
      [trimmedKey]: parsedValue,
    });
    
    setNewKey("");
    setNewValue("");
  }

  function removeParameter(key: string) {
    const updated = { ...value };
    delete updated[key];
    onChange(updated);
  }

  function updateParameter(key: string, newVal: string) {
    // Try to infer type from value
    let parsedValue: string | number | boolean = newVal;
    
    // Check if it's a boolean
    if (newVal.toLowerCase() === "true") {
      parsedValue = true;
    } else if (newVal.toLowerCase() === "false") {
      parsedValue = false;
    } else {
      // Check if it's a number
      const numValue = Number(newVal);
      if (!isNaN(numValue) && newVal.trim() !== "") {
        parsedValue = numValue;
      }
    }
    
    onChange({
      ...value,
      [key]: parsedValue,
    });
  }

  function resetToDefaults() {
    onChange({});
  }

  return (
    <div className="space-y-6">
      {/* Header with reset button */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Custom Hyperparameters</h3>
          <p className="text-sm text-slate-600 mt-1">
            Define key-value pairs for your custom container
          </p>
        </div>
        {hasParams && (
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={resetToDefaults}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            Reset to defaults
          </Button>
        )}
      </div>

      {/* Existing parameters */}
      {hasParams ? (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-slate-700">Current Parameters</Label>
          <div className="grid gap-3">
            {entries.map(([key, val]) => (
              <div 
                key={key} 
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-slate-600">Key</Label>
                    <Input
                      value={key}
                      disabled
                      className="bg-white font-mono text-sm"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-slate-600">
                      Value
                      <span className="ml-2 text-xs text-slate-400">
                        ({typeof val})
                      </span>
                    </Label>
                    <Input
                      value={String(val)}
                      onChange={(e) => updateParameter(key, e.target.value)}
                      className="bg-white font-mono text-sm"
                      placeholder="Enter value"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeParameter(key)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 h-9 w-9 p-0"
                  title="Remove parameter"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
          <p className="text-sm text-slate-500 mb-4">No parameters defined yet</p>
          <p className="text-xs text-slate-400">Add your first parameter below</p>
        </div>
      )}

      {/* Add new parameter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">Add New Parameter</Label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 grid gap-3 sm:grid-cols-2">
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newKey.trim()) {
                  e.preventDefault();
                  addParameter();
                }
              }}
              placeholder="Parameter key (e.g., learning_rate)"
              className="font-mono text-sm"
            />
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newKey.trim()) {
                  e.preventDefault();
                  addParameter();
                }
              }}
              placeholder="Value (e.g., 0.001)"
              className="font-mono text-sm"
            />
          </div>
          <Button
            type="button"
            onClick={addParameter}
            disabled={!newKey.trim()}
            className="whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Parameter
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Values are automatically typed: numbers (0.001), booleans (true/false), or strings
        </p>
      </div>
    </div>
  );
}
