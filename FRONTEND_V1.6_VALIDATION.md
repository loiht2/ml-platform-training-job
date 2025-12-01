# Frontend v1.6 - Feature & Label Name Validation

## Update Summary

Added validation and visual error indicators for **Feature name(s)** and **Label name** fields when users select the "Upload file" option for input data channels.

---

## Changes Made

### 1. Validation Logic (`validateForm` function)

Added validation to check that when a file is uploaded, both Feature name(s) and Label name must be provided:

```typescript
} else if (sourceType === "upload") {
  if (!c.uploadFileName) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Upload file is required. Please click 'Upload CSV File' button to select a file.`);
  if (c.uploadFileName) {
    if (!c.featureNames || c.featureNames.length === 0) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Feature name(s) is required when uploading a file.`);
    if (!c.labelName) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Label name is required when uploading a file.`);
  }
}
```

**Behavior**:
- Only validates Feature name(s) and Label name **after** a file has been uploaded
- If upload file is missing, shows upload file error first
- Once file is uploaded, validates both feature and label selections

---

### 2. Component Interface Update

Updated `ChannelEditor` component to accept error props:

```typescript
function ChannelEditor({ 
  value, 
  onChange, 
  hasError, 
  bucketError, 
  prefixError,
  featureError,    // NEW
  labelError       // NEW
}: { 
  value: Channel; 
  onChange: (c: Channel) => void; 
  hasError?: boolean; 
  bucketError?: string; 
  prefixError?: string;
  featureError?: string;    // NEW
  labelError?: string;      // NEW
})
```

---

### 3. Visual Error Indicators

#### Feature name(s) Field

**Red Border**:
```typescript
<div
  className={`flex min-h-9 w-full items-center justify-between rounded-md border ${featureError ? 'border-red-600' : 'border-slate-200'} bg-white px-3 py-2 text-sm cursor-pointer`}
  onClick={() => setFeatureDropdownOpen(!featureDropdownOpen)}
>
```

**Error Message**:
```typescript
{featureError && (
  <p className="text-sm text-red-600 ml-36 mt-1">Feature name(s) is required</p>
)}
```

#### Label name Field

**Red Border**:
```typescript
<SelectTrigger className={labelError ? 'border-red-600' : ''}>
  <SelectValue placeholder={availableForLabel.length === 0 ? "No columns available" : "Select label column"} />
</SelectTrigger>
```

**Error Message**:
```typescript
{labelError && (
  <p className="text-sm text-red-600 ml-36 mt-1">Label name is required</p>
)}
```

---

### 4. Error Extraction & Passing

In the channel rendering loop, extract the new errors:

```typescript
const channelErrors = errors.filter(err => 
  err.includes(`#${idx + 1}`) || (channel.channelName && err.includes(`'${channel.channelName}`))
);
const uploadFileError = channelErrors.find(err => err.includes('Upload file'));
const bucketError = channelErrors.find(err => err.includes('Bucket'));
const prefixError = channelErrors.find(err => err.includes('Prefix'));
const featureError = channelErrors.find(err => err.includes('Feature name'));   // NEW
const labelError = channelErrors.find(err => err.includes('Label name'));       // NEW
```

Pass them to `ChannelEditor`:

```typescript
<ChannelEditor
  value={channel}
  hasError={uploadFileError !== undefined}
  bucketError={bucketError}
  prefixError={prefixError}
  featureError={featureError}    // NEW
  labelError={labelError}        // NEW
  onChange={(next) => {
    const nextChannels = [...form.inputDataConfig];
    nextChannels[idx] = next;
    update("inputDataConfig", nextChannels);
  }}
/>
```

---

## User Experience

### Before Validation

1. User selects "Upload file" option
2. User uploads CSV file
3. File is parsed, columns are detected
4. User can submit **without** selecting features or label
5. ❌ Job might fail or use wrong columns

### After Validation (v1.6)

1. User selects "Upload file" option
2. User uploads CSV file
3. File is parsed, columns are detected
4. User tries to submit **without** selecting features or label
5. ✅ **Error appears**: Red border on dropdown/select
6. ✅ **Error message**: "Feature name(s) is required" / "Label name is required"
7. User selects required fields
8. ✅ Submit succeeds

---

## Error Display Examples

### Feature name(s) Error

```
┌─────────────────────────────────────────────┐
│ Feature name(s)  [Select features ▼] 🔴     │  ← Red border
└─────────────────────────────────────────────┘
                    🔴 Feature name(s) is required  ← Error message
```

### Label name Error

```
┌─────────────────────────────────────────────┐
│ Label name      [Select label column ▼] 🔴  │  ← Red border
└─────────────────────────────────────────────┘
                    🔴 Label name is required  ← Error message
```

---

## Testing Steps

1. **Navigate to**: `http://192.168.40.246:32269` → Login → Training Jobs → Create Training Job

2. **Test Case 1: Upload file without selections**
   - Add input channel
   - Select "Upload file" option
   - Click "Upload CSV File" and select a file
   - Try to submit
   - **Expected**: 
     - Red border on Feature name(s) dropdown
     - Red border on Label name select
     - Error messages displayed below each field
     - Submit button shows validation errors

3. **Test Case 2: Select features only**
   - Upload file
   - Select features from dropdown
   - DO NOT select label
   - Try to submit
   - **Expected**:
     - Feature name(s) error cleared ✅
     - Label name error still shown 🔴
     - Cannot submit

4. **Test Case 3: Complete all fields**
   - Upload file
   - Select features
   - Select label
   - Submit
   - **Expected**:
     - No validation errors ✅
     - Form submits successfully ✅

5. **Test Case 4: Object storage (no validation)**
   - Select "Object storage" option
   - Configure S3/MinIO
   - Submit
   - **Expected**:
     - Feature/Label validation NOT applied (object storage doesn't need them)
     - Only bucket/prefix validation applies

---

## File Modified

- **File**: `frontend/src/pages/CreateTrainingJobPage.tsx`
- **Lines Changed**: ~10 additions/modifications
- **Functions Modified**:
  - `validateForm()` - Added feature/label validation
  - `ChannelEditor()` - Added error props and visual indicators
  - Channel rendering loop - Extract and pass errors

---

## Deployment

```bash
# Build
cd frontend
docker build -t loihoangthanh1411/ml-platform-frontend:kubeflow-v1.6 .

# Push
docker push loihoangthanh1411/ml-platform-frontend:kubeflow-v1.6

# Deploy
kubectl set image deployment/ml-platform-frontend -n kubeflow \
  frontend=loihoangthanh1411/ml-platform-frontend:kubeflow-v1.6

# Verify
kubectl rollout status deployment/ml-platform-frontend -n kubeflow
kubectl get pods -n kubeflow -l app=ml-platform,component=frontend
```

**Status**: ✅ Deployed successfully

```
Pods: 2/2 Running
Image: loihoangthanh1411/ml-platform-frontend:kubeflow-v1.6
```

---

## Consistency with Existing Validation

The new validation follows the same pattern as existing field validations:

| Field | Error Style | Message Location | Border Color |
|-------|-------------|------------------|--------------|
| Upload file | Red text below | `ml-36 mt-1` | N/A (button) |
| Bucket/Container | Red text below | `ml-36 mt-1` | `border-red-600` |
| Prefix/Path | Red text below | `ml-36 mt-1` | `border-red-600` |
| **Feature name(s)** | Red text below | `ml-36 mt-1` | `border-red-600` ✅ |
| **Label name** | Red text below | `ml-36 mt-1` | `border-red-600` ✅ |

All fields use consistent styling:
- ✅ Red border (`border-red-600`) on invalid fields
- ✅ Red error text (`text-red-600`) below field
- ✅ Left margin (`ml-36`) to align with field content
- ✅ Top margin (`mt-1`) for spacing

---

## Summary

✅ **Validation added** for Feature name(s) and Label name when uploading files  
✅ **Red borders** appear on invalid fields (consistent with other errors)  
✅ **Error messages** displayed below fields (consistent with other errors)  
✅ **User-friendly**: Only validates after file is uploaded  
✅ **Deployed**: Frontend v1.6 running in production

**Result**: Users can no longer submit training jobs with uploaded files that are missing feature or label selections. The UI clearly indicates what's missing with visual cues matching the existing error patterns.
